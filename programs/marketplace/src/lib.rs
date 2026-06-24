use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, Token, TokenAccount, CloseAccount, Mint};

declare_id!("Marke71111111111111111111111111111111111111111");

// ─── Constants ──────────────────────────────────────────────

/// Marketplace fee: 5%
pub const FEE_BPS: u64 = 500;
pub const BPS_DENOMINATOR: u64 = 10000;

/// Listing fee in $SOLTREAT: 10 tokens (burned)
pub const LISTING_FEE_SOLTREAT: u64 = 10_000_000_000; // 10 * 10^9

/// Offer expiry: 7 days
pub const OFFER_EXPIRY: i64 = 604_800;

#[program]
pub mod solmon_marketplace {
    use super::*;

    // ─── List Monster ───────────────────────────────────────

    /// List a monster NFT for sale — transfers NFT to escrow vault
    pub fn list_monster(
        ctx: Context<ListMonster>,
        price: u64,
    ) -> Result<()> {
        require!(price > 0, MarketplaceError::InvalidPrice);

        let listing = &mut ctx.accounts.listing;
        listing.seller = ctx.accounts.seller.key();
        listing.monster_mint = ctx.accounts.monster_mint.key();
        listing.item_mint = Pubkey::default();
        listing.price = price;
        listing.amount = 1;
        listing.is_monster = true;
        listing.is_active = true;
        listing.created_at = Clock::get()?.unix_timestamp;
        listing.bump = ctx.bumps.listing;

        // Transfer NFT from seller to escrow vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.seller_token_account.to_account_info(),
                    to: ctx.accounts.escrow_vault.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            1, // NFT = 1 token
        )?;

        msg!("Monster listed for {} lamports | NFT escrowed", price);
        Ok(())
    }

    // ─── List Item ──────────────────────────────────────────

    /// List fungible items — transfers tokens to escrow
    pub fn list_item(
        ctx: Context<ListItem>,
        price: u64,
        amount: u64,
    ) -> Result<()> {
        require!(price > 0, MarketplaceError::InvalidPrice);
        require!(amount > 0, MarketplaceError::InvalidAmount);

        // Transfer items to escrow
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.seller_token_account.to_account_info(),
                    to: ctx.accounts.escrow_vault.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            amount,
        )?;

        let listing = &mut ctx.accounts.listing;
        listing.seller = ctx.accounts.seller.key();
        listing.monster_mint = Pubkey::default();
        listing.item_mint = ctx.accounts.item_mint.key();
        listing.price = price;
        listing.amount = amount;
        listing.is_monster = false;
        listing.is_active = true;
        listing.created_at = Clock::get()?.unix_timestamp;
        listing.bump = ctx.bumps.listing;

        msg!("Listed {} items for {} lamports", amount, price);
        Ok(())
    }

    // ─── Buy Monster ────────────────────────────────────────

    /// Buy a listed monster — SOL to seller, NFT to buyer
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
            &[ctx.accounts.buyer.to_account_info(), ctx.accounts.seller.to_account_info()],
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
                &[ctx.accounts.buyer.to_account_info(), ctx.accounts.treasury.to_account_info()],
            )?;
        }

        // Transfer NFT from escrow → buyer
        let seeds = &[
            b"marketplace-authority".as_ref(),
            &[ctx.bumps.marketplace_authority],
        ];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_vault.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.marketplace_authority.to_account_info(),
                },
                signer_seeds,
            ),
            1,
        )?;

        // Close escrow vault, rent back to seller
        token::close_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.escrow_vault.to_account_info(),
                    destination: ctx.accounts.seller.to_account_info(),
                    authority: ctx.accounts.marketplace_authority.to_account_info(),
                },
                signer_seeds,
            ),
        )?;

        // Mark listing inactive
        let listing = &mut ctx.accounts.listing;
        listing.is_active = false;

        msg!("Monster bought for {} lamports (fee: {})", price, fee);
        Ok(())
    }

    // ─── Buy Item ───────────────────────────────────────────

    /// Buy items from listing
    pub fn buy_item(
        ctx: Context<BuyItem>,
        quantity: u64,
    ) -> Result<()> {
        let listing = &ctx.accounts.listing;
        require!(listing.is_active, MarketplaceError::ListingNotActive);
        require!(!listing.is_monster, MarketplaceError::NotItemListing);
        require!(quantity > 0 && quantity <= listing.amount, MarketplaceError::InvalidAmount);

        let total_price = listing.price * quantity / listing.amount;
        let fee = total_price * FEE_BPS / BPS_DENOMINATOR;
        let seller_receives = total_price - fee;

        // SOL: buyer → seller
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &ctx.accounts.seller.key(),
            seller_receives,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[ctx.accounts.buyer.to_account_info(), ctx.accounts.seller.to_account_info()],
        )?;

        // SPL tokens: escrow → buyer
        let seeds = &[b"marketplace-authority".as_ref(), &[ctx.bumps.marketplace_authority]];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_vault.to_account_info(),
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
            // Close escrow vault
            token::close_account(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    CloseAccount {
                        account: ctx.accounts.escrow_vault.to_account_info(),
                        destination: ctx.accounts.seller.to_account_info(),
                        authority: ctx.accounts.marketplace_authority.to_account_info(),
                    },
                    signer_seeds,
                ),
            )?;
        }

        msg!("Bought {} items for {} lamports", quantity, total_price);
        Ok(())
    }

    // ─── Cancel Listing ─────────────────────────────────────

    /// Cancel listing — returns escrowed NFT/items to seller
    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        let listing = &ctx.accounts.listing;
        require!(listing.is_active, MarketplaceError::ListingNotActive);
        require!(listing.seller == ctx.accounts.seller.key(), MarketplaceError::NotSeller);

        let seeds = &[b"marketplace-authority".as_ref(), &[ctx.bumps.marketplace_authority]];
        let signer_seeds = &[&seeds[..]];

        // Return escrowed tokens to seller
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_vault.to_account_info(),
                    to: ctx.accounts.seller_token_account.to_account_info(),
                    authority: ctx.accounts.marketplace_authority.to_account_info(),
                },
                signer_seeds,
            ),
            listing.amount,
        )?;

        // Close escrow vault
        token::close_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.escrow_vault.to_account_info(),
                    destination: ctx.accounts.seller.to_account_info(),
                    authority: ctx.accounts.marketplace_authority.to_account_info(),
                },
                signer_seeds,
            ),
        )?;

        // Mark inactive
        let listing = &mut ctx.accounts.listing;
        listing.is_active = false;

        msg!("Listing cancelled — NFT/items returned to seller");
        Ok(())
    }

    // ─── Update Price ───────────────────────────────────────

    /// Update listing price (seller only)
    pub fn update_price(
        ctx: Context<UpdatePrice>,
        new_price: u64,
    ) -> Result<()> {
        require!(new_price > 0, MarketplaceError::InvalidPrice);

        let listing = &mut ctx.accounts.listing;
        require!(listing.is_active, MarketplaceError::ListingNotActive);
        require!(listing.seller == ctx.accounts.seller.key(), MarketplaceError::NotSeller);

        let old_price = listing.price;
        listing.price = new_price;

        msg!("Price updated: {} → {} lamports", old_price, new_price);
        Ok(())
    }

    // ─── Make Offer ─────────────────────────────────────────

    /// Make an offer on a listing — SOL escrowed in offer PDA
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
        offer.expires_at = Clock::get()?.unix_timestamp + OFFER_EXPIRY;
        offer.bump = ctx.bumps.offer;

        // Escrow SOL
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &ctx.accounts.offer.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[ctx.accounts.buyer.to_account_info(), ctx.accounts.offer.to_account_info()],
        )?;

        msg!("Offer placed: {} lamports (expires in 7 days)", amount);
        Ok(())
    }

    // ─── Accept Offer ───────────────────────────────────────

    /// Accept offer — seller gets SOL, buyer gets NFT
    pub fn accept_offer(ctx: Context<AcceptOffer>) -> Result<()> {
        let offer = &ctx.accounts.offer;
        require!(offer.is_active, MarketplaceError::OfferNotActive);
        require!(
            Clock::get()?.unix_timestamp < offer.expires_at,
            MarketplaceError::OfferExpired
        );

        let listing = &ctx.accounts.listing;
        require!(listing.is_active, MarketplaceError::ListingNotActive);

        let amount = offer.amount;
        let fee = amount * FEE_BPS / BPS_DENOMINATOR;
        let seller_receives = amount - fee;

        // Transfer SOL from escrow to seller
        **ctx.accounts.offer.to_account_info().try_borrow_mut_lamports()? -= seller_receives;
        **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += seller_receives;

        // Transfer fee to treasury
        if fee > 0 {
            **ctx.accounts.offer.to_account_info().try_borrow_mut_lamports()? -= fee;
            **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += fee;
        }

        // Transfer NFT from escrow to buyer
        let seeds = &[b"marketplace-authority".as_ref(), &[ctx.bumps.marketplace_authority]];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_vault.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.marketplace_authority.to_account_info(),
                },
                signer_seeds,
            ),
            1,
        )?;

        // Close escrow vault
        token::close_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.escrow_vault.to_account_info(),
                    destination: ctx.accounts.seller.to_account_info(),
                    authority: ctx.accounts.marketplace_authority.to_account_info(),
                },
                signer_seeds,
            ),
        )?;

        // Mark listing + offer inactive
        let listing = &mut ctx.accounts.listing;
        listing.is_active = false;

        let offer = &mut ctx.accounts.offer;
        offer.is_active = false;

        msg!("Offer accepted for {} lamports (fee: {})", amount, fee);
        Ok(())
    }

    // ─── Cancel Offer ───────────────────────────────────────

    /// Cancel offer — refund escrowed SOL to buyer
    pub fn cancel_offer(ctx: Context<CancelOffer>) -> Result<()> {
        let offer = &ctx.accounts.offer;
        require!(offer.is_active, MarketplaceError::OfferNotActive);
        require!(offer.buyer == ctx.accounts.buyer.key(), MarketplaceError::NotBuyer);

        let refund = offer.amount;

        **ctx.accounts.offer.to_account_info().try_borrow_mut_lamports()? -= refund;
        **ctx.accounts.buyer.to_account_info().try_borrow_mut_lamports()? += refund;

        let offer = &mut ctx.accounts.offer;
        offer.is_active = false;

        msg!("Offer cancelled — {} lamports refunded", refund);
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
        seeds = [b"listing", monster_mint.key().as_ref()],
        bump,
    )]
    pub listing: Account<'info, Listing>,

    pub monster_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = seller_token_account.amount == 1 @ MarketplaceError::NotMonsterOwner,
        constraint = seller_token_account.mint == monster_mint.key() @ MarketplaceError::MintMismatch,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// Escrow vault for NFT
    #[account(
        init,
        payer = seller,
        token::mint = monster_mint,
        token::authority = marketplace_authority,
        seeds = [b"escrow", monster_mint.key().as_ref()],
        bump,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    /// CHECK: PDA marketplace authority
    #[account(seeds = [b"marketplace-authority"], bump)]
    pub marketplace_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
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

    pub item_mint: Account<'info, Mint>,

    #[account(mut)]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// Escrow vault for items
    #[account(
        init,
        payer = seller,
        token::mint = item_mint,
        token::authority = marketplace_authority,
        seeds = [b"escrow", item_mint.key().as_ref(), seller.key().as_ref()],
        bump,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    /// CHECK: PDA marketplace authority
    #[account(seeds = [b"marketplace-authority"], bump)]
    pub marketplace_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct BuyMonster<'info> {
    #[account(mut, constraint = listing.is_active @ MarketplaceError::ListingNotActive)]
    pub listing: Account<'info, Listing>,

    #[account(mut, constraint = seller.key() == listing.seller @ MarketplaceError::NotSeller)]
    /// CHECK: seller wallet
    pub seller: AccountInfo<'info>,

    /// CHECK: treasury for fees
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"escrow", listing.monster_mint.as_ref()],
        bump,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        token::mint = monster_mint,
        token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    pub monster_mint: Account<'info, Mint>,

    #[account(seeds = [b"marketplace-authority"], bump)]
    pub marketplace_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct BuyItem<'info> {
    #[account(mut, constraint = listing.is_active @ MarketplaceError::ListingNotActive)]
    pub listing: Account<'info, Listing>,

    #[account(mut, constraint = seller.key() == listing.seller)]
    /// CHECK: seller
    pub seller: AccountInfo<'info>,

    #[account(mut)]
    pub escrow_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub buyer_token_account: Account<'info, TokenAccount>,

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
        constraint = listing.is_active @ MarketplaceError::ListingNotActive,
        constraint = listing.seller == seller.key() @ MarketplaceError::NotSeller,
    )]
    pub listing: Account<'info, Listing>,

    /// Escrow vault
    #[account(mut)]
    pub escrow_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub seller_token_account: Account<'info, TokenAccount>,

    #[account(seeds = [b"marketplace-authority"], bump)]
    pub marketplace_authority: UncheckedAccount<'info>,

    pub seller: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    #[account(mut)]
    pub listing: Account<'info, Listing>,

    pub seller: Signer<'info>,
}

#[derive(Accounts)]
pub struct MakeOffer<'info> {
    #[account(
        constraint = listing.is_active @ MarketplaceError::ListingNotActive,
    )]
    pub listing: Account<'info, Listing>,

    #[account(
        init,
        payer = buyer,
        space = 8 + Offer::INIT_SPACE,
        seeds = [b"offer", listing.key().as_ref(), buyer.key().as_ref()],
        bump,
    )]
    pub offer: Account<'info, Offer>,

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
        mut,
        constraint = listing.is_active @ MarketplaceError::ListingNotActive,
        constraint = listing.key() == offer.listing @ MarketplaceError::ListingMismatch,
    )]
    pub listing: Account<'info, Listing>,

    /// Escrow vault for the NFT
    #[account(mut)]
    pub escrow_vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = seller,
        token::mint = monster_mint,
        token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    pub monster_mint: Account<'info, Mint>,

    #[account(mut, constraint = seller.key() == listing.seller @ MarketplaceError::NotSeller)]
    pub seller: Signer<'info>,

    /// CHECK: buyer wallet (offer.buyer)
    #[account(mut, constraint = buyer.key() == offer.buyer @ MarketplaceError::NotBuyer)]
    pub buyer: AccountInfo<'info>,

    /// CHECK: treasury for fees
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    #[account(seeds = [b"marketplace-authority"], bump)]
    pub marketplace_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CancelOffer<'info> {
    #[account(
        mut,
        constraint = offer.is_active @ MarketplaceError::OfferNotActive,
        constraint = offer.buyer == buyer.key() @ MarketplaceError::NotBuyer,
    )]
    pub offer: Account<'info, Offer>,

    #[account(mut)]
    pub buyer: Signer<'info>,
}

// ─── State ──────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct Listing {
    pub seller: Pubkey,         // 32
    pub monster_mint: Pubkey,   // 32
    pub item_mint: Pubkey,      // 32
    pub price: u64,             // 8
    pub amount: u64,            // 8
    pub is_monster: bool,       // 1
    pub is_active: bool,        // 1
    pub created_at: i64,        // 8
    pub bump: u8,               // 1
}

#[account]
#[derive(InitSpace)]
pub struct Offer {
    pub buyer: Pubkey,          // 32
    pub listing: Pubkey,        // 32
    pub amount: u64,            // 8
    pub is_active: bool,        // 1
    pub created_at: i64,        // 8
    pub expires_at: i64,        // 8
    pub bump: u8,               // 1
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
    #[msg("Not the buyer")]
    NotBuyer,
    #[msg("Not the monster owner")]
    NotMonsterOwner,
    #[msg("Mint mismatch")]
    MintMismatch,
    #[msg("Offer is not active")]
    OfferNotActive,
    #[msg("Offer has expired")]
    OfferExpired,
    #[msg("Listing mismatch")]
    ListingMismatch,
    #[msg("Escrow vault mismatch")]
    EscrowMismatch,
}
