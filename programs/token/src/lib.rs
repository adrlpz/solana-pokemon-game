use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Burn, Token, TokenAccount};

declare_id!("TokeN11111111111111111111111111111111111111111");

/// $SOLMON fixed supply: 1 billion (9 decimals)
pub const SOLMON_SUPPLY: u64 = 1_000_000_000_000_000_000; // 1B * 10^9

/// $SOLTREAT halving interval: 6 months in slots (~180 days)
pub const HALVING_INTERVAL: i64 = 15_552_000; // ~180 days at 2.5 slots/s

/// Base reward per battle win
pub const BASE_BATTLE_REWARD: u64 = 100_000_000; // 100 $SOLTREAT (9 decimals)

#[program]
pub mod solmon_token {
    use super::*;

    /// Initialize $SOLMON governance token (fixed supply)
    pub fn initialize_solmon(ctx: Context<InitializeSOLMON>) -> Result<()> {
        let config = &mut ctx.accounts.token_config;
        config.authority = ctx.accounts.authority.key();
        config.solmon_mint = ctx.accounts.solmon_mint.key();
        config.soltreat_mint = Pubkey::default(); // set later
        config.total_minted_soltreat = 0;
        config.halving_count = 0;
        config.last_halving = Clock::get()?.unix_timestamp;
        config.bump = ctx.bumps.token_config;

        msg!("$SOLMON initialized with supply {}", SOLMON_SUPPLY);
        Ok(())
    }

    /// Initialize $SOLTREAT utility token (inflationary)
    pub fn initialize_soltreat(ctx: Context<InitializeSOLTREAT>) -> Result<()> {
        let config = &mut ctx.accounts.token_config;
        config.soltreat_mint = ctx.accounts.soltreat_mint.key();
        msg!("$SOLTREAT initialized");
        Ok(())
    }

    /// Mint battle reward in $SOLTREAT
    pub fn mint_battle_reward(ctx: Context<MintReward>, amount: u64) -> Result<()> {
        let config = &mut ctx.accounts.token_config;

        // Check if halving needed
        let now = Clock::get()?.unix_timestamp;
        if now - config.last_halving >= HALVING_INTERVAL {
            config.halving_count += 1;
            config.last_halving = now;
            msg!("Halving #{} — reward rate reduced", config.halving_count);
        }

        // Apply halving to base reward
        let effective_reward = BASE_BATTLE_REWARD >> config.halving_count.min(10);
        let mint_amount = effective_reward.min(amount);

        // Mint tokens
        let seeds = &[b"token-authority".as_ref(), &[ctx.bumps.token_authority]];
        let signer_seeds = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.soltreat_mint.to_account_info(),
                    to: ctx.accounts.recipient_token_account.to_account_info(),
                    authority: ctx.accounts.token_authority.to_account_info(),
                },
                signer_seeds,
            ),
            mint_amount,
        )?;

        config.total_minted_soltreat += mint_amount;
        msg!("Minted {} $SOLTREAT", mint_amount);
        Ok(())
    }

    /// Burn $SOLTREAT (for breeding, evolution, marketplace listings)
    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.soltreat_mint.to_account_info(),
                    from: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        msg!("Burned {} $SOLTREAT", amount);
        Ok(())
    }
}

// ─── Contexts ───────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeSOLMON<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + TokenConfig::INIT_SPACE,
        seeds = [b"token-config"],
        bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 9,
        mint::authority = token_authority,
        seeds = [b"solmon-mint"],
        bump,
    )]
    pub solmon_mint: Account<'info, Mint>,

    /// CHECK: PDA authority for minting
    #[account(
        seeds = [b"token-authority"],
        bump,
    )]
    pub token_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InitializeSOLTREAT<'info> {
    #[account(
        mut,
        seeds = [b"token-config"],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 9,
        mint::authority = token_authority,
        seeds = [b"soltreat-mint"],
        bump,
    )]
    pub soltreat_mint: Account<'info, Mint>,

    /// CHECK: PDA authority for minting
    #[account(
        seeds = [b"token-authority"],
        bump,
    )]
    pub token_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintReward<'info> {
    #[account(mut)]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"soltreat-mint"],
        bump,
    )]
    pub soltreat_mint: Account<'info, Mint>,

    /// CHECK: PDA authority
    #[account(
        seeds = [b"token-authority"],
        bump,
    )]
    pub token_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(
        mut,
        seeds = [b"soltreat-mint"],
        bump,
    )]
    pub soltreat_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ─── State ──────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct TokenConfig {
    pub authority: Pubkey,          // 32
    pub solmon_mint: Pubkey,        // 32
    pub soltreat_mint: Pubkey,      // 32
    pub total_minted_soltreat: u64, // 8
    pub halving_count: u8,          // 1
    pub last_halving: i64,          // 8
    pub bump: u8,                   // 1
}
