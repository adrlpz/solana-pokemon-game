use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Burn, Transfer, Token, TokenAccount, SetAuthority};
use anchor_spl::token::spl_token;

declare_id!("TokeN11111111111111111111111111111111111111111");

// ─── Constants ──────────────────────────────────────────────

/// $SOLMON fixed supply: 1 billion (9 decimals)
pub const SOLMON_SUPPLY: u64 = 1_000_000_000_000_000_000; // 1B * 10^9

/// $SOLTREAT halving interval: 6 months in seconds (~180 days)
pub const HALVING_INTERVAL: i64 = 15_552_000;

/// Base reward per battle win in $SOLTREAT
pub const BASE_BATTLE_REWARD: u64 = 100_000_000; // 100 $SOLTREAT

/// Base reward per ranked win in $SOLMON
pub const BASE_RANKED_REWARD: u64 = 10_000_000; // 10 $SOLMON

/// Staking APY basis points (5% = 500 bps)
pub const STAKING_APY_BPS: u64 = 500;
pub const BPS_DENOMINATOR: u64 = 10000;

/// Minimum stake amount: 100 $SOLMON
pub const MIN_STAKE: u64 = 100_000_000_000; // 100 * 10^9

/// Cooldown period for unstaking: 7 days
pub const UNSTAKE_COOLDOWN: i64 = 604_800;

#[program]
pub mod solmon_token {
    use super::*;

    // ─── Initialization ─────────────────────────────────────

    /// Initialize $SOLMON governance token (fixed supply)
    pub fn initialize_solmon(ctx: Context<InitializeSOLMON>) -> Result<()> {
        let config = &mut ctx.accounts.token_config;
        config.authority = ctx.accounts.authority.key();
        config.solmon_mint = ctx.accounts.solmon_mint.key();
        config.soltreat_mint = Pubkey::default();
        config.treasury = ctx.accounts.treasury.key();
        config.total_minted_soltreat = 0;
        config.total_burned_soltreat = 0;
        config.halving_count = 0;
        config.last_halving = Clock::get()?.unix_timestamp;
        config.total_staked = 0;
        config.bump = ctx.bumps.token_config;

        msg!("$SOLMON mint initialized — supply cap: {}", SOLMON_SUPPLY);
        Ok(())
    }

    /// Initialize $SOLTREAT utility token (inflationary)
    pub fn initialize_soltreat(ctx: Context<InitializeSOLTREAT>) -> Result<()> {
        let config = &mut ctx.accounts.token_config;
        config.soltreat_mint = ctx.accounts.soltreat_mint.key();
        msg!("$SOLTREAT mint initialized");
        Ok(())
    }

    /// Mint initial $SOLMON supply to treasury (one-time)
    pub fn mint_solmon_initial(ctx: Context<MintSolmonInitial>) -> Result<()> {
        let config = &ctx.accounts.token_config;

        let seeds = &[b"token-authority".as_ref(), &[ctx.bumps.token_authority]];
        let signer_seeds = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.solmon_mint.to_account_info(),
                    to: ctx.accounts.treasury_token_account.to_account_info(),
                    authority: ctx.accounts.token_authority.to_account_info(),
                },
                signer_seeds,
            ),
            SOLMON_SUPPLY,
        )?;

        // Revoke mint authority — fixed supply forever
        token::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                SetAuthority {
                    account_or_mint: ctx.accounts.solmon_mint.to_account_info(),
                    current_authority: ctx.accounts.token_authority.to_account_info(),
                },
                signer_seeds,
            ),
            spl_token::AuthorityType::MintTokens,
            None,
        )?;

        msg!("$SOLMON supply minted: {} — mint authority revoked", SOLMON_SUPPLY);
        Ok(())
    }

    // ─── Rewards ────────────────────────────────────────────

    /// Mint $SOLTREAT battle reward (called by battle program via CPI)
    pub fn mint_battle_reward(
        ctx: Context<MintBattleReward>,
        amount: u64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.token_config;

        // Check halving
        let now = Clock::get()?.unix_timestamp;
        if now - config.last_halving >= HALVING_INTERVAL {
            config.halving_count += 1;
            config.last_halving = now;
            msg!("Halving #{} — reward rate reduced", config.halving_count);
        }

        // Apply halving
        let effective_reward = BASE_BATTLE_REWARD
            .checked_shr(config.halving_count.min(10) as u32)
            .unwrap_or(1);
        let mint_amount = effective_reward.min(amount);

        // Mint
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
        msg!("Minted {} $SOLTREAT battle reward", mint_amount);
        Ok(())
    }

    /// Mint $SOLMON ranked reward (called by battle program via CPI)
    pub fn mint_ranked_reward(
        ctx: Context<MintRankedReward>,
        amount: u64,
    ) -> Result<()> {
        let mint_amount = BASE_RANKED_REWARD.min(amount);

        let seeds = &[b"token-authority".as_ref(), &[ctx.bumps.token_authority]];
        let signer_seeds = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.solmon_mint.to_account_info(),
                    to: ctx.accounts.recipient_token_account.to_account_info(),
                    authority: ctx.accounts.token_authority.to_account_info(),
                },
                signer_seeds,
            ),
            mint_amount,
        )?;

        msg!("Minted {} $SOLMON ranked reward", mint_amount);
        Ok(())
    }

    // ─── Burn ───────────────────────────────────────────────

    /// Burn $SOLTREAT (breeding, evolution, marketplace listing, cosmetics)
    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        require!(amount > 0, TokenError::InvalidAmount);

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

        // Track total burned
        let config = &mut ctx.accounts.token_config;
        config.total_burned_soltreat += amount;

        msg!("Burned {} $SOLTREAT (total burned: {})", amount, config.total_burned_soltreat);
        Ok(())
    }

    // ─── Staking ────────────────────────────────────────────

    /// Stake $SOLMON tokens
    pub fn stake_solmon(ctx: Context<StakeSolmon>, amount: u64) -> Result<()> {
        require!(amount >= MIN_STAKE, TokenError::BelowMinStake);

        let stake_account = &mut ctx.accounts.stake_account;
        let config = &mut ctx.accounts.token_config;
        let now = Clock::get()?.unix_timestamp;

        // If already staking, claim pending rewards first
        if stake_account.amount > 0 {
            let rewards = calc_rewards(stake_account.amount, stake_account.last_claim, now);
            if rewards > 0 {
                // Mint rewards
                let seeds = &[b"token-authority".as_ref(), &[ctx.bumps.token_authority]];
                let signer_seeds = &[&seeds[..]];

                token::mint_to(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        MintTo {
                            mint: ctx.accounts.solmon_mint.to_account_info(),
                            to: ctx.accounts.user_token_account.to_account_info(),
                            authority: ctx.accounts.token_authority.to_account_info(),
                        },
                        signer_seeds,
                    ),
                    rewards,
                )?;
                msg!("Claimed {} staking rewards", rewards);
            }
        }

        // Transfer tokens to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.stake_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        // Update stake account
        if stake_account.amount == 0 {
            stake_account.owner = ctx.accounts.user.key();
            stake_account.staked_at = now;
            stake_account.bump = ctx.bumps.stake_account;
        }
        stake_account.amount += amount;
        stake_account.last_claim = now;

        config.total_staked += amount;

        msg!("Staked {} $SOLMON (total staked: {})", amount, stake_account.amount);
        Ok(())
    }

    /// Begin unstaking (starts 7-day cooldown)
    pub fn begin_unstake(ctx: Context<BeginUnstake>) -> Result<()> {
        let stake_account = &mut ctx.accounts.stake_account;
        require!(stake_account.amount > 0, TokenError::NotStaked);

        let now = Clock::get()?.unix_timestamp;

        // Claim pending rewards first
        let rewards = calc_rewards(stake_account.amount, stake_account.last_claim, now);
        if rewards > 0 {
            let seeds = &[b"token-authority".as_ref(), &[ctx.bumps.token_authority]];
            let signer_seeds = &[&seeds[..]];

            token::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    MintTo {
                        mint: ctx.accounts.solmon_mint.to_account_info(),
                        to: ctx.accounts.user_token_account.to_account_info(),
                        authority: ctx.accounts.token_authority.to_account_info(),
                    },
                    signer_seeds,
                ),
                rewards,
            )?;
        }

        stake_account.unstake_requested_at = Some(now);
        stake_account.last_claim = now;

        msg!("Unstake requested — cooldown: {} seconds", UNSTAKE_COOLDOWN);
        Ok(())
    }

    /// Complete unstaking after cooldown
    pub fn complete_unstake(ctx: Context<CompleteUnstake>) -> Result<()> {
        let stake_account = &mut ctx.accounts.stake_account;
        let config = &mut ctx.accounts.token_config;
        let now = Clock::get()?.unix_timestamp;

        let unstake_at = stake_account.unstake_requested_at
            .ok_or(TokenError::UnstakeNotRequested)?;

        require!(
            now >= unstake_at + UNSTAKE_COOLDOWN,
            TokenError::CooldownNotExpired
        );

        let amount = stake_account.amount;

        // Transfer from vault back to user
        let seeds = &[b"token-authority".as_ref(), &[ctx.bumps.token_authority]];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.stake_vault.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.token_authority.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        config.total_staked -= amount;
        stake_account.amount = 0;
        stake_account.unstake_requested_at = None;

        msg!("Unstaked {} $SOLMON", amount);
        Ok(())
    }

    // ─── Admin ──────────────────────────────────────────────

    /// Update authority (admin transfer)
    pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
        let config = &mut ctx.accounts.token_config;
        config.authority = ctx.accounts.new_authority.key();
        msg!("Authority updated to {}", config.authority);
        Ok(())
    }
}

// ─── Helpers ────────────────────────────────────────────────

/// Calculate staking rewards: amount * APY * duration / (365 days * BPS)
fn calc_rewards(amount: u64, last_claim: i64, now: i64) -> u64 {
    let duration = now.saturating_sub(last_claim);
    if duration <= 0 {
        return 0;
    }
    // rewards = amount * APY_BPS * duration_seconds / (365 * 86400 * BPS_DENOMINATOR)
    let rewards = (amount as u128)
        .saturating_mul(STAKING_APY_BPS as u128)
        .saturating_mul(duration as u128)
        .checked_div(365u128 * 86400 * BPS_DENOMINATOR as u128)
        .unwrap_or(0);

    rewards.min(u64::MAX as u128) as u64
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
    #[account(seeds = [b"token-authority"], bump)]
    pub token_authority: UncheckedAccount<'info>,

    /// CHECK: Treasury wallet
    pub treasury: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InitializeSOLTREAT<'info> {
    #[account(mut, seeds = [b"token-config"], bump = token_config.bump)]
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

    #[account(seeds = [b"token-authority"], bump)]
    pub token_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintSolmonInitial<'info> {
    #[account(seeds = [b"token-config"], bump = token_config.bump)]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"solmon-mint"],
        bump,
    )]
    pub solmon_mint: Account<'info, Mint>,

    #[account(seeds = [b"token-authority"], bump)]
    pub token_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct MintBattleReward<'info> {
    #[account(mut, seeds = [b"token-config"], bump = token_config.bump)]
    pub token_config: Account<'info, TokenConfig>,

    #[account(mut, seeds = [b"soltreat-mint"], bump)]
    pub soltreat_mint: Account<'info, Mint>,

    #[account(seeds = [b"token-authority"], bump)]
    pub token_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct MintRankedReward<'info> {
    #[account(seeds = [b"token-config"], bump = token_config.bump)]
    pub token_config: Account<'info, TokenConfig>,

    #[account(mut, seeds = [b"solmon-mint"], bump)]
    pub solmon_mint: Account<'info, Mint>,

    #[account(seeds = [b"token-authority"], bump)]
    pub token_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut, seeds = [b"token-config"], bump = token_config.bump)]
    pub token_config: Account<'info, TokenConfig>,

    #[account(mut, seeds = [b"soltreat-mint"], bump)]
    pub soltreat_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct StakeSolmon<'info> {
    #[account(mut, seeds = [b"token-config"], bump = token_config.bump)]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + StakeAccount::INIT_SPACE,
        seeds = [b"stake", user.key().as_ref()],
        bump,
    )]
    pub stake_account: Account<'info, StakeAccount>,

    #[account(mut, seeds = [b"solmon-mint"], bump)]
    pub solmon_mint: Account<'info, Mint>,

    #[account(seeds = [b"token-authority"], bump)]
    pub token_authority: UncheckedAccount<'info>,

    /// Stake vault — holds staked tokens
    #[account(
        init_if_needed,
        payer = user,
        token::mint = solmon_mint,
        token::authority = token_authority,
        seeds = [b"stake-vault", user.key().as_ref()],
        bump,
    )]
    pub stake_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct BeginUnstake<'info> {
    #[account(mut, seeds = [b"token-config"], bump = token_config.bump)]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"stake", user.key().as_ref()],
        bump = stake_account.bump,
        constraint = stake_account.owner == user.key() @ TokenError::NotStakeOwner,
    )]
    pub stake_account: Account<'info, StakeAccount>,

    #[account(mut, seeds = [b"solmon-mint"], bump)]
    pub solmon_mint: Account<'info, Mint>,

    #[account(seeds = [b"token-authority"], bump)]
    pub token_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CompleteUnstake<'info> {
    #[account(mut, seeds = [b"token-config"], bump = token_config.bump)]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"stake", user.key().as_ref()],
        bump = stake_account.bump,
        constraint = stake_account.owner == user.key() @ TokenError::NotStakeOwner,
    )]
    pub stake_account: Account<'info, StakeAccount>,

    #[account(seeds = [b"token-authority"], bump)]
    pub token_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"stake-vault", user.key().as_ref()],
        bump,
    )]
    pub stake_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        seeds = [b"token-config"],
        bump = token_config.bump,
        constraint = token_config.authority == authority.key() @ TokenError::NotAuthority,
    )]
    pub token_config: Account<'info, TokenConfig>,

    pub authority: Signer<'info>,

    /// CHECK: new authority
    pub new_authority: UncheckedAccount<'info>,
}

// ─── State ──────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct TokenConfig {
    pub authority: Pubkey,            // 32
    pub solmon_mint: Pubkey,          // 32
    pub soltreat_mint: Pubkey,        // 32
    pub treasury: Pubkey,             // 32
    pub total_minted_soltreat: u64,   // 8
    pub total_burned_soltreat: u64,   // 8
    pub halving_count: u8,            // 1
    pub last_halving: i64,            // 8
    pub total_staked: u64,            // 8
    pub bump: u8,                     // 1
}

#[account]
#[derive(InitSpace)]
pub struct StakeAccount {
    pub owner: Pubkey,                // 32
    pub amount: u64,                  // 8
    pub staked_at: i64,               // 8
    pub last_claim: i64,              // 8
    pub unstake_requested_at: Option<i64>, // 1 + 8
    pub bump: u8,                     // 1
}

#[error_code]
pub enum TokenError {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Below minimum stake (100 $SOLMON)")]
    BelowMinStake,
    #[msg("Not staked")]
    NotStaked,
    #[msg("Not stake owner")]
    NotStakeOwner,
    #[msg("Not authorized")]
    NotAuthority,
    #[msg("Unstake not requested")]
    UnstakeNotRequested,
    #[msg("Cooldown period not expired (7 days)")]
    CooldownNotExpired,
}
