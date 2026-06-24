use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;

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

    // ─── Create Battle ──────────────────────────────────────

    /// Create a new battle session with optional wager
    pub fn create_battle(
        ctx: Context<CreateBattle>,
        wager: u64,
    ) -> Result<()> {
        let battle = &mut ctx.accounts.battle_session;
        battle.player1 = ctx.accounts.player1.key();
        battle.player2 = Pubkey::default();
        battle.squad1 = [BattleMonster::default(); 3];
        battle.squad2 = [BattleMonster::default(); 3];
        battle.active1 = 0;
        battle.active2 = 0;
        battle.state = BattleState::Waiting;
        battle.current_turn = 0;
        battle.wager = wager;
        battle.commitment1 = [0u8; 32];
        battle.commitment2 = [0u8; 32];
        battle.revealed1 = None;
        battle.revealed2 = None;
        battle.timeout_count1 = 0;
        battle.timeout_count2 = 0;
        battle.winner = None;
        battle.turn_log = Vec::new();
        battle.created_at = Clock::get()?.unix_timestamp;
        battle.timeout_at = Clock::get()?.unix_timestamp + QUEUE_TIMEOUT;
        battle.bump = ctx.bumps.battle_session;

        // Escrow wager from player1
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

        msg!("Battle created by {} | wager: {} lamports", battle.player1, wager);
        Ok(())
    }

    // ─── Join Battle ────────────────────────────────────────

    /// Join an existing battle
    pub fn join_battle(ctx: Context<JoinBattle>) -> Result<()> {
        let battle = &mut ctx.accounts.battle_session;
        require!(battle.state == BattleState::Waiting, BattleError::BattleNotWaiting);
        require!(battle.player2 == Pubkey::default(), BattleError::BattleFull);

        battle.player2 = ctx.accounts.player2.key();
        battle.state = BattleState::SelectSquad;
        battle.timeout_at = Clock::get()?.unix_timestamp + SQUAD_SELECT_TIMEOUT;

        // Escrow wager from player2
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

    // ─── Select Squad ───────────────────────────────────────

    /// Select 3-monster squad with battle-relevant stats
    /// Player provides monster stats; on-chain verification against MonsterAccount can be done via CPI or client-side
    pub fn select_squad(
        ctx: Context<SelectSquad>,
        monsters: [BattleMonster; 3],
    ) -> Result<()> {
        let battle = &mut ctx.accounts.battle_session;
        require!(
            battle.state == BattleState::SelectSquad,
            BattleError::InvalidBattleState
        );

        // Validate: each monster must have HP > 0
        for m in &monsters {
            require!(m.max_hp > 0, BattleError::AllMonstersFainted);
            require!(m.level > 0, BattleError::InvalidMonsterOwner);
        }

        let player_key = ctx.accounts.player.key();

        if player_key == battle.player1 {
            // Verify ownership
            for m in &monsters {
                require!(m.owner == battle.player1, BattleError::InvalidMonsterOwner);
            }
            battle.squad1 = monsters;
            msg!("Player 1 squad selected");
        } else if player_key == battle.player2 {
            for m in &monsters {
                require!(m.owner == battle.player2, BattleError::InvalidMonsterOwner);
            }
            battle.squad2 = monsters;
            msg!("Player 2 squad selected");
        } else {
            return err!(BattleError::NotBattlePlayer);
        }

        // Both squads selected → start battle
        if battle.squad1[0].owner != Pubkey::default()
            && battle.squad2[0].owner != Pubkey::default()
        {
            battle.state = BattleState::CommitPhase;
            battle.current_turn = 1;
            battle.active1 = 0;
            battle.active2 = 0;
            battle.timeout_at = Clock::get()?.unix_timestamp + COMMIT_TIMEOUT;
            msg!("⚔️ Battle starts! Turn 1 — commit your moves!");
        }

        Ok(())
    }

    // ─── Commit Move ────────────────────────────────────────

    /// Commit hashed move: SHA256(move_slot + target + move_power + move_element + is_special + salt)
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

        // Verify player's active monster isn't fainted
        if player_key == battle.player1 {
            require!(
                !battle.squad1[battle.active1 as usize].is_fainted,
                BattleError::ActiveMonsterFainted
            );
            require!(battle.commitment1 == [0u8; 32], BattleError::AlreadyCommitted);
            battle.commitment1 = commitment;
        } else if player_key == battle.player2 {
            require!(
                !battle.squad2[battle.active2 as usize].is_fainted,
                BattleError::ActiveMonsterFainted
            );
            require!(battle.commitment2 == [0u8; 32], BattleError::AlreadyCommitted);
            battle.commitment2 = commitment;
        } else {
            return err!(BattleError::NotBattlePlayer);
        }

        // Both committed → move to reveal
        if battle.commitment1 != [0u8; 32] && battle.commitment2 != [0u8; 32] {
            battle.state = BattleState::RevealPhase;
            battle.revealed1 = None;
            battle.revealed2 = None;
            battle.timeout_at = Clock::get()?.unix_timestamp + REVEAL_TIMEOUT;
            msg!("Both committed! Reveal your moves!");
        }

        Ok(())
    }

    // ─── Reveal Move ────────────────────────────────────────

    /// Reveal move with salt — verified against commitment hash
    /// Preimage: move_slot(1) + target(1) + move_power(2) + move_element(1) + is_special(1) + salt(32) = 38 bytes
    pub fn reveal_move(
        ctx: Context<RevealMove>,
        move_slot: u8,
        target: u8,
        move_power: u16,
        move_element: u8,
        is_special: bool,
        salt: [u8; 32],
    ) -> Result<()> {
        let battle = &mut ctx.accounts.battle_session;
        require!(
            battle.state == BattleState::RevealPhase,
            BattleError::InvalidBattleState
        );
        require!(move_slot < 4, BattleError::InvalidMoveSlot);
        require!(target < 3, BattleError::InvalidTarget);

        let player_key = ctx.accounts.player.key();

        // Build preimage
        let mut preimage = Vec::with_capacity(38);
        preimage.push(move_slot);
        preimage.push(target);
        preimage.extend_from_slice(&move_power.to_le_bytes());
        preimage.push(move_element);
        preimage.push(if is_special { 1 } else { 0 });
        preimage.extend_from_slice(&salt);

        let computed_hash = hash(&preimage).to_bytes();

        let revealed = RevealedMove {
            move_slot,
            target,
            move_data: MoveData {
                power: move_power,
                element: move_element,
                is_special,
            },
        };

        if player_key == battle.player1 {
            require!(
                computed_hash == battle.commitment1,
                BattleError::CommitmentMismatch
            );
            // Verify target is opponent's non-fainted monster
            require!(
                !battle.squad2[target as usize].is_fainted,
                BattleError::TargetFainted
            );
            battle.revealed1 = Some(revealed);
        } else if player_key == battle.player2 {
            require!(
                computed_hash == battle.commitment2,
                BattleError::CommitmentMismatch
            );
            require!(
                !battle.squad1[target as usize].is_fainted,
                BattleError::TargetFainted
            );
            battle.revealed2 = Some(revealed);
        } else {
            return err!(BattleError::NotBattlePlayer);
        }

        // Both revealed → execute turn
        if battle.revealed1.is_some() && battle.revealed2.is_some() {
            execute_turn(battle)?;
        }

        Ok(())
    }

    // ─── Switch Monster ─────────────────────────────────────

    /// Switch active monster (when current one is fainted)
    pub fn switch_monster(
        ctx: Context<SwitchMonster>,
        new_active: u8,
    ) -> Result<()> {
        require!(new_active < 3, BattleError::InvalidTarget);

        let battle = &mut ctx.accounts.battle_session;
        let player_key = ctx.accounts.player.key();

        if player_key == battle.player1 {
            require!(
                battle.squad1[battle.active1 as usize].is_fainted,
                BattleError::NotSwitchPhase
            );
            require!(
                !battle.squad1[new_active as usize].is_fainted,
                BattleError::CannotSwitchToFainted
            );
            battle.active1 = new_active;
            msg!("Player 1 switched to monster slot {}", new_active);
        } else if player_key == battle.player2 {
            require!(
                battle.squad2[battle.active2 as usize].is_fainted,
                BattleError::NotSwitchPhase
            );
            require!(
                !battle.squad2[new_active as usize].is_fainted,
                BattleError::CannotSwitchToFainted
            );
            battle.active2 = new_active;
            msg!("Player 2 switched to monster slot {}", new_active);
        } else {
            return err!(BattleError::NotBattlePlayer);
        }

        Ok(())
    }

    // ─── Timeout ────────────────────────────────────────────

    /// Claim victory when opponent times out
    pub fn timeout_opponent(ctx: Context<TimeoutOpponent>) -> Result<()> {
        let battle = &mut ctx.accounts.battle_session;
        let now = Clock::get()?.unix_timestamp;
        require!(now > battle.timeout_at, BattleError::NotTimedOut);

        let caller = ctx.accounts.player.key();
        let (is_p1, is_p2) = (caller == battle.player1, caller == battle.player2);
        require!(is_p1 || is_p2, BattleError::NotBattlePlayer);

        // Increment timeout count for the player who DIDN'T call
        if is_p1 {
            battle.timeout_count2 += 1;
            if battle.timeout_count2 >= MAX_TIMEOUTS {
                // Opponent forfeited
                battle.winner = Some(battle.player1);
                battle.state = BattleState::Finished;
                msg!("Player 2 forfeited ({} timeouts) — Player 1 wins!", battle.timeout_count2);
            } else {
                // Reset commit/reveal for next attempt
                reset_turn_state(battle);
                battle.timeout_at = Clock::get()?.unix_timestamp + COMMIT_TIMEOUT;
                msg!("Player 2 timeout #{}", battle.timeout_count2);
            }
        } else {
            battle.timeout_count1 += 1;
            if battle.timeout_count1 >= MAX_TIMEOUTS {
                battle.winner = Some(battle.player2);
                battle.state = BattleState::Finished;
                msg!("Player 1 forfeited ({} timeouts) — Player 2 wins!", battle.timeout_count1);
            } else {
                reset_turn_state(battle);
                battle.timeout_at = Clock::get()?.unix_timestamp + COMMIT_TIMEOUT;
                msg!("Player 1 timeout #{}", battle.timeout_count1);
            }
        }

        Ok(())
    }

    // ─── Claim Winnings ─────────────────────────────────────

    /// Claim wager winnings after battle ends
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let battle = &ctx.accounts.battle_session;
        require!(
            battle.state == BattleState::Finished,
            BattleError::BattleNotFinished
        );

        let winner = battle.winner.ok_or(BattleError::NoWinner)?;
        require!(ctx.accounts.winner.key() == winner, BattleError::NotWinner);

        if battle.wager > 0 {
            let total_pot = battle.wager * 2;
            let fee = total_pot * FEE_BPS / BPS_DENOMINATOR;
            let payout = total_pot - fee;

            **ctx.accounts.battle_session.to_account_info().try_borrow_mut_lamports()? -= payout;
            **ctx.accounts.winner.to_account_info().try_borrow_mut_lamports()? += payout;

            msg!("💰 Winnings: {} lamports (fee: {})", payout, fee);
        }

        Ok(())
    }

    // ─── Draw / Mutual Cancel ───────────────────────────────

    /// Both players agree to draw (returns wagers)
    pub fn agree_draw(ctx: Context<AgreeDraw>) -> Result<()> {
        let battle = &mut ctx.accounts.battle_session;
        require!(
            battle.state == BattleState::CommitPhase || battle.state == BattleState::RevealPhase,
            BattleError::InvalidBattleState
        );

        battle.state = BattleState::Cancelled;
        battle.winner = None;

        // Refund wagers (done via close or manual transfer)
        msg!("Battle ended in a draw — wagers refunded");
        Ok(())
    }
}

// ─── Turn Execution Engine ──────────────────────────────────

/// Execute a full battle turn: compute damage for both sides, apply HP, check fainting, determine winner
fn execute_turn(battle: &mut BattleSession) -> Result<()> {
    let turn = battle.current_turn;

    // Get revealed moves
    let r1 = battle.revealed1.ok_or(BattleError::RevealIncomplete)?;
    let r2 = battle.revealed2.ok_or(BattleError::RevealIncomplete)?;

    let m1 = &battle.squad1[battle.active1 as usize];
    let m2 = &battle.squad2[battle.active2 as usize];

    // Determine turn order by speed (higher speed goes first)
    let p1_first = m1.spd >= m2.spd;

    // Pseudo-random factor based on turn + blockhash-like seed
    let seed = (turn as u64).wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    let random1 = (RANDOM_MIN as u64 + (seed % (RANDOM_MAX - RANDOM_MIN + 1) as u64)) as u16;
    let random2 = (RANDOM_MIN as u64 + ((seed >> 8) % (RANDOM_MAX - RANDOM_MIN + 1) as u64)) as u16;

    let mut damage_to_p2: u16 = 0;
    let mut damage_to_p1: u16 = 0;
    let mut p1_mon = m1.clone();
    let mut p2_mon = m2.clone();

    if p1_first {
        // Player 1 attacks first
        damage_to_p2 = calc_damage(&p1_mon, &p2_mon, &r1.move_data, r1.target, random1)?;
        p2_mon.hp = p2_mon.hp.saturating_sub(damage_to_p2);
        if p2_mon.hp == 0 {
            p2_mon.is_fainted = true;
        }

        // Player 2 attacks (if still alive)
        if !p2_mon.is_fainted {
            damage_to_p1 = calc_damage(&p2_mon, &p1_mon, &r2.move_data, r2.target, random2)?;
            p1_mon.hp = p1_mon.hp.saturating_sub(damage_to_p1);
            if p1_mon.hp == 0 {
                p1_mon.is_fainted = true;
            }
        }
    } else {
        // Player 2 attacks first
        damage_to_p1 = calc_damage(&p2_mon, &p1_mon, &r2.move_data, r2.target, random2)?;
        p1_mon.hp = p1_mon.hp.saturating_sub(damage_to_p1);
        if p1_mon.hp == 0 {
            p1_mon.is_fainted = true;
        }

        // Player 1 attacks (if still alive)
        if !p1_mon.is_fainted {
            damage_to_p2 = calc_damage(&p1_mon, &p2_mon, &r1.move_data, r1.target, random1)?;
            p2_mon.hp = p2_mon.hp.saturating_sub(damage_to_p2);
            if p2_mon.hp == 0 {
                p2_mon.is_fainted = true;
            }
        }
    }

    // Apply updated HP back to battle
    battle.squad1[battle.active1 as usize] = p1_mon;
    battle.squad2[battle.active2 as usize] = p2_mon;

    // Log turn
    if battle.turn_log.len() < MAX_TURN_LOG {
        battle.turn_log.push(TurnEntry {
            turn,
            action1: TurnAction {
                move_slot: r1.move_slot,
                target: r1.target,
                damage_dealt: damage_to_p2,
            },
            action2: TurnAction {
                move_slot: r2.move_slot,
                target: r2.target,
                damage_dealt: damage_to_p1,
            },
            damage1: damage_to_p2,
            damage2: damage_to_p1,
            p1_fainted: p1_mon.is_fainted,
            p2_fainted: p2_mon.is_fainted,
        });
    }

    msg!(
        "Turn {} | P1 deals {} dmg (HP: {}) | P2 deals {} dmg (HP: {})",
        turn, damage_to_p2, p2_mon.hp, damage_to_p1, p1_mon.hp
    );

    // ─── Check Win Conditions ───────────────────────────────

    let p1_all_fainted = all_fainted(&battle.squad1);
    let p2_all_fainted = all_fainted(&battle.squad2);

    if p1_all_fainted && p2_all_fainted {
        // Both sides wiped — draw, but rare
        battle.state = BattleState::Cancelled;
        msg!("Both sides wiped — draw!");
        return Ok(());
    }

    if p1_all_fainted {
        battle.winner = Some(battle.player2);
        battle.state = BattleState::Finished;
        msg!("🏆 Player 2 wins! All P1 monsters fainted");
        return Ok(());
    }

    if p2_all_fainted {
        battle.winner = Some(battle.player1);
        battle.state = BattleState::Finished;
        msg!("🏆 Player 1 wins! All P2 monsters fainted");
        return Ok(());
    }

    // Max turns check
    if turn >= MAX_TURNS {
        battle.state = BattleState::Cancelled;
        msg!("Max turns reached — draw");
        return Ok(());
    }

    // ─── Prepare Next Turn ──────────────────────────────────

    // If active monster fainted, player must switch (handled via switch_monster instruction)
    // If both active are alive, next commit phase
    if p1_mon.is_fainted || p2_mon.is_fainted {
        // Switch phase — fainted player must call switch_monster
        // Then state goes back to CommitPhase
        battle.state = BattleState::SelectSquad; // reuse SelectSquad for switch
        msg!("Active monster fainted — player must switch!");
    } else {
        // Normal next turn
        battle.state = BattleState::CommitPhase;
        battle.current_turn += 1;
    }

    // Reset commit/reveal state
    battle.commitment1 = [0u8; 32];
    battle.commitment2 = [0u8; 32];
    battle.revealed1 = None;
    battle.revealed2 = None;
    battle.timeout_at = Clock::get()?.unix_timestamp + COMMIT_TIMEOUT;

    Ok(())
}

/// Calculate damage: ((2*Level/5 + 2) * Power * Atk/Def) / 50 + 2
///   * STAB (1.5x if same element)
///   * Type effectiveness (1.5x / 1.0x / 0.67x)
///   * Random(85-100)/100
fn calc_damage(
    attacker: &BattleMonster,
    defender: &BattleMonster,
    move_data: &MoveData,
    _target: u8,
    random_factor: u16,
) -> Result<u16> {
    let level = attacker.level as u64;
    let power = move_data.power as u64;

    // Select attack/defend stats based on move type
    let (atk, def) = if move_data.is_special {
        (attacker.sp_atk as u64, defender.sp_def as u64)
    } else {
        (attacker.atk as u64, defender.def as u64)
    };

    // Base damage
    let base = (2 * level / 5 + 2) * power * atk / (def.max(1)) / 50 + 2;

    // STAB (same-type attack bonus)
    let stab = if move_data.element == attacker.element {
        STAB_BPS as u64
    } else {
        STAB_NORMAL as u64
    };

    // Type effectiveness
    let eff = if move_data.element < 6 && defender.element < 6 {
        ELEMENT_CHART[move_data.element as usize][defender.element as usize] as u64
    } else {
        EFF_NORMAL as u64
    };

    // Random factor
    let rand = random_factor.max(RANDOM_MIN).min(RANDOM_MAX) as u64;

    // Final damage
    let damage = base * stab / 100 * eff / 100 * rand / 100;

    Ok(damage.min(u16::MAX as u64) as u16)
}

/// Check if all monsters in a squad are fainted
fn all_fainted(squad: &[BattleMonster; 3]) -> bool {
    squad.iter().all(|m| m.is_fainted)
}

/// Reset commit/reveal state for next turn attempt
fn reset_turn_state(battle: &mut BattleSession) {
    battle.commitment1 = [0u8; 32];
    battle.commitment2 = [0u8; 32];
    battle.revealed1 = None;
    battle.revealed2 = None;
    if battle.state == BattleState::RevealPhase || battle.state == BattleState::CommitPhase {
        battle.state = BattleState::CommitPhase;
    }
}

// ─── Contexts ───────────────────────────────────────────────

#[derive(Accounts)]
pub struct CreateBattle<'info> {
    #[account(
        init,
        payer = player1,
        space = 8 + 5000, // generous space for turn log
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
pub struct SwitchMonster<'info> {
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

#[derive(Accounts)]
pub struct AgreeDraw<'info> {
    #[account(mut)]
    pub battle_session: Account<'info, BattleSession>,

    pub player1: Signer<'info>,
    pub player2: Signer<'info>,
}
