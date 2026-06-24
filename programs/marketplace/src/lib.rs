use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, Token, TokenAccount};

declare_id!("Marke71111111111111111111111111111111111111111");

/// Marketplace fee: 5%
pub const FEE_BPS: u64 = 500;
pub const BPS_DENOMINATOR: u64 = 10000;

#[program]
pub mod solmon_marketplace {
    use super::*;

    /// List a monster for sale
    pub fn list_monster(
        ctx: Context<ListMonster>,
        price: u64,
    ) -> Result<()> {
        require!(price > 0, MarketplaceError::InvalidPrice);

        let listing = &mut ctx.accounts.listing;
        listing.seller = ctx.accounts.seller.key();
        listing.monster = ctx.accounts.monster.key();
        listing.item_mint = Pubkey::default();
        listing.price = price;
        listing.amount = 1;
        listing.is_monster = true;
        listing.is_active = true;
        listing.created_at = Clock::get()?.unix_timestamp;
        listing.bump = ctx.bumps.listing;

        msg!("Monster listed for {} lamports", price);
        Ok(())
    }

    /// List fungible items for sale (potions, evolution stones)
    pub fn list_item(
        ctx: Context<ListItem>,
        price: u64,
        amount: u64,
    ) -> Result<()> {
        require!(price > 0, MarketplaceError::InvalidPrice);
        require!(amount > 0, MarketplaceError::InvalidAmount);

        let listing = &mut ctx.accounts.listing;
        listing.seller = ctx.accounts.seller.key();
        listing.monster = Pubkey::default();
        listing.item_mint = ctx.accounts.item_mint.key();
        listing.price = price;
        listing.amount = amount;
        listing.is_monster = false;
        listing.is_active = true;
        listing.created_at = Clock::get()?.unix_timestamp;
        listing.bump = ctx.bumps.listing;

        msg!("Listed {} items for {} lamports total", amount, price);
        Ok(())
    }

    /// Buy a listed monster
    pub fn buy_monster(ctx: Context<BuyMonster>) -> Result<()> {
        let listing = &ctx.accounts.listing;
        require!(listing.is_active, MarketplaceError::ListingNotActive);
        require!(listing.is_monster, MarketplaceError::NotMonsterListing);

        let price = listing.price;
        let fee = price * FEE_BPS / BPS_DENOMINATOR;
        let seller_receives = price - fee;

        // Transfer SOL: buyer → seller
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &ctx.accounts.seller.key(),
            seller_receives,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.seller.to_account_info(),
            ],
        )?;

        // Transfer fee to treasury
        if fee > 0 {
            let fee_ix = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &ctx.accounts.treasury.key(),
                fee,
            );
            anchor_lang::solana_program::program::invoke(
                &fee_ix,
                &[
                    ctx.accounts.buyer.to_account_info(),
                    ctx.accounts.treasury.to_account_info(),
                ],
            )?;
        }

        // Close listing
        let listing = &mut ctx.accounts.listing;
        listing.is_active = false;

        msg!("Monster bought for {} lamports (fee: {})", price, fee);
        Ok(())
    }

    /// Buy listed items
    pub fn buy_item(
        ctx: Context<BuyItem>,
        quantity: u64,
    ) -> Result<()> {
        let listing = &ctx.accounts.listing;
        require!(listing.is_active, MarketplaceError::ListingNotActive);
        require!(!listing.is_monster, MarketplaceError::NotItemListing);
        require!(quantity > 0 && quantity <= listing.amount, MarketplaceError::InvalidAmount);

        // Pro-rata price
        let total_price = listing.price * quantity / listing.amount;
        let fee = total_price * FEE_BPS / BPS_DENOMINATOR;
        let seller_receives = total_price - fee;

        // Transfer SOL: buyer → seller
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &ctx.accounts.seller.key(),
            seller_receives,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.seller.to_account_info(),
            ],
        )?;

        // Transfer SPL tokens: seller → buyer
        let seeds = &[b"marketplace-authority".as_ref(), &[ctx.bumps.marketplace_authority]];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.seller_token_account.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.marketplace_authority.to_account_info(),
                },
                signer_seeds,
            ),
            quantity,
        )?;

        // Update listing
        let listing = &mut ctx.accounts.listing;
        listing.amount -= quantity;
        if listing.amount == 0 {
            listing.is_active = false;
        }

        msg!("Bought {} items for {} lamports", quantity, total_price);
        Ok(())
    }

    /// Cancel a listing (seller only)
    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        require!(listing.is_active, MarketplaceError::ListingNotActive);

        listing.is_active = false;
        msg!("Listing cancelled");
        Ok(())
    }

    /// Make an offer on a monster
    pub fn make_offer(
        ctx: Context<MakeOffer>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, MarketplaceError::InvalidPrice);

        let offer = &mut ctx.accounts.offer;
        offer.buyer = ctx.accounts.buyer.key();
        offer.listing = ctx.accounts.listing.key();
        offer.amount = amount;
        offer.is_active = true;
        offer.created_at = Clock::get()?.unix_timestamp;
        offer.bump = ctx.bumps.offer;

        // Escrow the offer amount
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &ctx.accounts.offer.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.offer.to_account_info(),
            ],
        )?;

        msg!("Offer of {} lamports placed", amount);
        Ok(())
    }

    /// Accept an offer (seller only)
    pub fn accept_offer(ctx: Context<AcceptOffer>) -> Result<()> {
        let offer = &ctx.accounts.offer;
        require!(offer.is_active, MarketplaceError::OfferNotActive);

        let amount = offer.amount;
        let fee = amount * FEE_BPS / BPS_DENOMINATOR;
        let seller_receives = amount - fee;

        // Transfer from escrow to seller
        **ctx.accounts.offer.to_account_info().try_borrow_mut_lamports()? -= seller_receives;
        **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += seller_receives;

        // Close offer
        let offer = &mut ctx.accounts.offer;
        offer.is_active = false;

        msg!("Offer accepted for {} lamports", amount);
        Ok(())
    }
}

// ─── Contexts ───────────────────────────────────────────────

#[derive(Accounts)]
pub struct ListMonster<'info> {
    #[account(
        init,
        payer = seller,
        space = 8 + Listing::INIT_SPACE,
        seeds = [b"listing", monster.key().as_ref()],
        bump,
    )]
    pub listing: Account<'info, Listing>,

    /// CHECK: Monster account PDA
    pub monster: AccountInfo<'info>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ListItem<'info> {
    #[account(
        init,
        payer = seller,
        space = 8 + Listing::INIT_SPACE,
        seeds = [b"listing", item_mint.key().as_ref(), seller.key().as_ref()],
        bump,
    )]
    pub listing: Account<'info, Listing>,

    pub item_mint: Account<'info, anchor_spl::token::Mint>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyMonster<'info> {
    #[account(
        mut,
        constraint = listing.is_active @ MarketplaceError::ListingNotActive,
    )]
    pub listing: Account<'info, Listing>,

    /// CHECK: Seller wallet
    #[account(mut, constraint = seller.key() == listing.seller)]
    pub seller: AccountInfo<'info>,

    /// CHECK: Treasury wallet for fees
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyItem<'info> {
    #[account(
        mut,
        constraint = listing.is_active @ MarketplaceError::ListingNotActive,
    )]
    pub listing: Account<'info, Listing>,

    /// CHECK: Seller wallet
    #[account(mut, constraint = seller.key() == listing.seller)]
    pub seller: AccountInfo<'info>,

    #[account(mut)]
    pub seller_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub buyer_token_account: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for token transfers
    #[account(seeds = [b"marketplace-authority"], bump)]
    pub marketplace_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(
        mut,
        constraint = listing.seller == seller.key() @ MarketplaceError::NotSeller,
    )]
    pub listing: Account<'info, Listing>,

    pub seller: Signer<'info>,
}

#[derive(Accounts)]
pub struct MakeOffer<'info> {
    #[account(
        init,
        payer = buyer,
        space = 8 + Offer::INIT_SPACE,
        seeds = [b"offer", listing.key().as_ref(), buyer.key().as_ref()],
        bump,
    )]
    pub offer: Account<'info, Offer>,

    pub listing: Account<'info, Listing>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptOffer<'info> {
    #[account(
        mut,
        constraint = offer.is_active @ MarketplaceError::OfferNotActive,
    )]
    pub offer: Account<'info, Offer>,

    #[account(
        constraint = listing.key() == offer.listing @ MarketplaceError::ListingMismatch,
    )]
    pub listing: Account<'info, Listing>,

    #[account(
        mut,
        constraint = seller.key() == listing.seller @ MarketplaceError::NotSeller,
    )]
    pub seller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ─── State ──────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct Listing {
    pub seller: Pubkey,     // 32
    pub monster: Pubkey,    // 32
    pub item_mint: Pubkey,  // 32
    pub price: u64,         // 8
    pub amount: u64,        // 8
    pub is_monster: bool,   // 1
    pub is_active: bool,    // 1
    pub created_at: i64,    // 8
    pub bump: u8,           // 1
}

#[account]
#[derive(InitSpace)]
pub struct Offer {
    pub buyer: Pubkey,      // 32
    pub listing: Pubkey,    // 32
    pub amount: u64,        // 8
    pub is_active: bool,    // 1
    pub created_at: i64,    // 8
    pub bump: u8,           // 1
}

#[error_code]
pub enum MarketplaceError {
    #[msg("Price must be greater than 0")]
    InvalidPrice,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Listing is not active")]
    ListingNotActive,
    #[msg("Not a monster listing")]
    NotMonsterListing,
    #[msg("Not an item listing")]
    NotItemListing,
    #[msg("Not the seller")]
    NotSeller,
    #[msg("Offer is not active")]
    OfferNotActive,
    #[msg("Listing mismatch")]
    ListingMismatch,
}
