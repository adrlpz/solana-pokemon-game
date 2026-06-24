use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod state;

use constants::*;
use errors::*;
use state::*;

declare_id!("Batt1e1111111111111111111111111111111111111111");

#[program]
pub mod solmon_battle {
    use super::*;

    /// Create a new battle session with optional wager
    pub fn create_battle(
        ctx: Context<CreateBattle>,
        wager: u64,
    ) -> Result<()> {
        let battle = &mut ctx.accounts.battle_session;
        battle.player1 = ctx.accounts.player1.key();
        battle.player2 = Pubkey::default(); // filled on join
        battle.state = BattleState::Waiting;
        battle.current_turn = 0;
        battle.wager = wager;
        battle.commitment1 = [0u8; 32];
        battle.commitment2 = [0u8; 32];
        battle.winner = None;
        battle.created_at = Clock::get()?.unix_timestamp;
        battle.timeout_at = Clock::get()?.unix_timestamp + QUEUE_TIMEOUT;
        battle.bump = ctx.bumps.battle_session;

        // Transfer wager to escrow
        if wager > 0 {
            let ix = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.player1.key(),
                &ctx.accounts.battle_session.key(),
                wager,
            );
            anchor_lang::solana_program::program::invoke(
                &ix,
                &[
                    ctx.accounts.player1.to_account_info(),
                    ctx.accounts.battle_session.to_account_info(),
                ],
            )?;
        }

        msg!("Battle created by {} with wager {} lamports", battle.player1, wager);
        Ok(())
    }

    /// Join an existing battle
    pub fn join_battle(ctx: Context<JoinBattle>) -> Result<()> {
        let battle = &mut ctx.accounts.battle_session;
        require!(battle.state == BattleState::Waiting, BattleError::BattleNotWaiting);
        require!(battle.player2 == Pubkey::default(), BattleError::BattleFull);

        battle.player2 = ctx.accounts.player2.key();
        battle.state = BattleState::SelectSquad;
        battle.timeout_at = Clock::get()?.unix_timestamp + SQUAD_SELECT_TIMEOUT;

        // Transfer wager to escrow
        if battle.wager > 0 {
            let ix = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.player2.key(),
                &ctx.accounts.battle_session.key(),
                battle.wager,
            );
            anchor_lang::solana_program::program::invoke(
                &ix,
                &[
                    ctx.accounts.player2.to_account_info(),
                    ctx.accounts.battle_session.to_account_info(),
                ],
            )?;
        }

        msg!("{} joined the battle!", battle.player2);
        Ok(())
    }

    /// Select 3-monster squad for battle
    pub fn select_squad(
        ctx: Context<SelectSquad>,
        monsters: [Pubkey; 3],
    ) -> Result<()> {
        let battle = &mut ctx.accounts.battle_session;
        require!(
            battle.state == BattleState::SelectSquad,
            BattleError::InvalidBattleState
        );

        let player_key = ctx.accounts.player.key();

        if player_key == battle.player1 {
            battle.squad1 = monsters;
        } else if player_key == battle.player2 {
            battle.squad2 = monsters;
        } else {
            return err!(BattleError::NotBattlePlayer);
        }

        // Both squads selected → start battle
        if battle.squad1 != [Pubkey::default(); 3]
            && battle.squad2 != [Pubkey::default(); 3]
        {
            battle.state = BattleState::CommitPhase;
            battle.current_turn = 1;
            battle.timeout_at = Clock::get()?.unix_timestamp + COMMIT_TIMEOUT;
            msg!("Battle starts! Turn 1 — commit your moves!");
        }

        Ok(())
    }

    /// Commit hashed move (SHA256(move_slot + target + salt))
    pub fn commit_move(
        ctx: Context<CommitMove>,
        commitment: [u8; 32],
    ) -> Result<()> {
        let battle = &mut ctx.accounts.battle_session;
        require!(
            battle.state == BattleState::CommitPhase,
            BattleError::InvalidBattleState
        );

        let player_key = ctx.accounts.player.key();

        if player_key == battle.player1 {
            require!(battle.commitment1 == [0u8; 32], BattleError::AlreadyCommitted);
            battle.commitment1 = commitment;
        } else if player_key == battle.player2 {
            require!(battle.commitment2 == [0u8; 32], BattleError::AlreadyCommitted);
            battle.commitment2 = commitment;
        } else {
            return err!(BattleError::NotBattlePlayer);
        }

        // Both committed → move to reveal
        if battle.commitment1 != [0u8; 32] && battle.commitment2 != [0u8; 32] {
            battle.state = BattleState::RevealPhase;
            battle.timeout_at = Clock::get()?.unix_timestamp + REVEAL_TIMEOUT;
            msg!("Both committed! Reveal your moves!");
        }

        Ok(())
    }

    /// Reveal move with salt — verified against commitment hash
    pub fn reveal_move(
        ctx: Context<RevealMove>,
        move_slot: u8,
        target: u8,
        salt: [u8; 32],
    ) -> Result<()> {
        let battle = &mut ctx.accounts.battle_session;
        require!(
            battle.state == BattleState::RevealPhase,
            BattleError::InvalidBattleState
        );
        require!(move_slot < 4, BattleError::InvalidMoveSlot);

        let player_key = ctx.accounts.player.key();

        // Build preimage: move_slot (1) + target (1) + salt (32) = 34 bytes
        let mut preimage = Vec::with_capacity(34);
        preimage.push(move_slot);
        preimage.push(target);
        preimage.extend_from_slice(&salt);

        use anchor_lang::solana_program::hash::hash;
        let computed_hash = hash(&preimage).to_bytes();

        if player_key == battle.player1 {
            require!(
                computed_hash == battle.commitment1,
                BattleError::CommitmentMismatch
            );
        } else if player_key == battle.player2 {
            require!(
                computed_hash == battle.commitment2,
                BattleError::CommitmentMismatch
            );
        } else {
            return err!(BattleError::NotBattlePlayer);
        }

        msg!("Player {} revealed move slot {} targeting {}", player_key, move_slot, target);

        // Both revealed → execute turn
        // (simplified: in production, would compute damage on-chain)
        battle.current_turn += 1;
        battle.state = BattleState::CommitPhase;
        battle.commitment1 = [0u8; 32];
        battle.commitment2 = [0u8; 32];
        battle.timeout_at = Clock::get()?.unix_timestamp + COMMIT_TIMEOUT;

        msg!("Turn {} — commit your moves!", battle.current_turn);
        Ok(())
    }

    /// Claim victory when opponent times out
    pub fn timeout_opponent(ctx: Context<TimeoutOpponent>) -> Result<()> {
        let battle = &mut ctx.accounts.battle_session;
        let now = Clock::get()?.unix_timestamp;
        require!(now > battle.timeout_at, BattleError::NotTimedOut);

        let caller = ctx.accounts.player.key();
        if caller == battle.player1 {
            battle.winner = Some(battle.player1);
        } else if caller == battle.player2 {
            battle.winner = Some(battle.player2);
        } else {
            return err!(BattleError::NotBattlePlayer);
        }

        battle.state = BattleState::Finished;
        msg!("Timeout! Winner: {:?}", battle.winner);
        Ok(())
    }

    /// Claim wager winnings after battle ends
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let battle = &ctx.accounts.battle_session;
        require!(
            battle.state == BattleState::Finished,
            BattleError::BattleNotFinished
        );

        let winner = battle.winner.ok_or(BattleError::NoWinner)?;
        let caller = ctx.accounts.winner.key();
        require!(caller == winner, BattleError::NotWinner);

        // Transfer escrowed wager to winner (2x wager minus 5% fee)
        if battle.wager > 0 {
            let total_pot = battle.wager * 2;
            let fee = total_pot * 5 / 100;
            let payout = total_pot - fee;

            **ctx.accounts.battle_session.to_account_info().try_borrow_mut_lamports()? -= payout;
            **ctx.accounts.winner.to_account_info().try_borrow_mut_lamports()? += payout;
        }

        msg!("Winnings claimed: {} lamports", battle.wager * 2);
        Ok(())
    }
}

// ─── Contexts ───────────────────────────────────────────────

#[derive(Accounts)]
pub struct CreateBattle<'info> {
    #[account(
        init,
        payer = player1,
        space = 8 + BattleSession::INIT_SPACE,
        seeds = [b"battle", player1.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump,
    )]
    pub battle_session: Account<'info, BattleSession>,

    #[account(mut)]
    pub player1: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinBattle<'info> {
    #[account(
        mut,
        constraint = battle_session.state == BattleState::Waiting @ BattleError::BattleNotWaiting,
    )]
    pub battle_session: Account<'info, BattleSession>,

    #[account(mut)]
    pub player2: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SelectSquad<'info> {
    #[account(mut)]
    pub battle_session: Account<'info, BattleSession>,

    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct CommitMove<'info> {
    #[account(mut)]
    pub battle_session: Account<'info, BattleSession>,

    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct RevealMove<'info> {
    #[account(mut)]
    pub battle_session: Account<'info, BattleSession>,

    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct TimeoutOpponent<'info> {
    #[account(mut)]
    pub battle_session: Account<'info, BattleSession>,

    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(
        mut,
        constraint = battle_session.state == BattleState::Finished @ BattleError::BattleNotFinished,
    )]
    pub battle_session: Account<'info, BattleSession>,

    #[account(mut)]
    pub winner: Signer<'info>,
}
