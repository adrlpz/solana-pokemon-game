use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod state;

use constants::*;
use errors::*;
use state::*;

declare_id!("Crea1111111111111111111111111111111111111111");

#[program]
pub mod solmon_creature {
    use super::*;

    /// Initialize a new player profile
    pub fn initialize_player(ctx: Context<InitializePlayer>) -> Result<()> {
        let profile = &mut ctx.accounts.player_profile;
        profile.authority = ctx.accounts.authority.key();
        profile.monster_count = 0;
        profile.battle_wins = 0;
        profile.battle_losses = 0;
        profile.elo = 1000;
        profile.created_at = Clock::get()?.unix_timestamp;
        profile.bump = ctx.bumps.player_profile;
        Ok(())
    }

    /// Catch a wild monster — creates MonsterAccount + mints NFT
    pub fn catch_monster(
        ctx: Context<CatchMonster>,
        species_id: u16,
        ivs: [u8; 6],
        is_shiny: bool,
    ) -> Result<()> {
        require!(species_id < TOTAL_SPECIES, CreatureError::InvalidSpecies);

        let profile = &mut ctx.accounts.player_profile;
        require!(profile.monster_count < MAX_MONSTERS_PER_PLAYER, CreatureError::MonsterLimitReached);

        // Validate IVs (0-31)
        for iv in &ivs {
            require!(*iv <= 31, CreatureError::InvalidIV);
        }

        let monster = &mut ctx.accounts.monster_account;
        monster.owner = profile.key();
        monster.species_id = species_id;
        monster.level = 1;
        monster.xp = 0;
        monster.ivs = ivs;
        monster.evs = [0u16; 6];
        monster.moves = [0u16; 4]; // will be set from species base_moves
        monster.is_shiny = is_shiny;
        monster.created_at = Clock::get()?.unix_timestamp;
        monster.bump = ctx.bumps.monster_account;

        profile.monster_count += 1;

        msg!("Caught species {} at level 1! Shiny: {}", species_id, is_shiny);
        Ok(())
    }

    /// Award XP to a monster, handles level ups
    pub fn gain_xp(ctx: Context<GainXp>, amount: u32) -> Result<()> {
        let monster = &mut ctx.accounts.monster_account;

        // Verify ownership
        require!(
            monster.owner == ctx.accounts.player_profile.key(),
            CreatureError::NotOwner
        );

        monster.xp = monster.xp.checked_add(amount).ok_or(CreatureError::XpOverflow)?;

        // Calculate level from XP: level = floor(sqrt(xp / 100)) + 1, capped at 100
        let new_level = ((monster.xp as f64 / 100.0).sqrt() as u8 + 1).min(MAX_LEVEL);

        if new_level > monster.level {
            msg!("Level up! {} → {}", monster.level, new_level);
            monster.level = new_level;
        }

        Ok(())
    }

    /// Evolve a monster if it meets the level requirement
    pub fn evolve_monster(ctx: Context<EvolveMonster>) -> Result<()> {
        let monster = &mut ctx.accounts.monster_account;
        let registry = &ctx.accounts.species_registry;

        let species = &registry.species[monster.species_id as usize];
        require!(
            species.evolves_to != 0xFFFF,
            CreatureError::CannotEvolve
        );
        require!(
            monster.level >= species.evolution_level,
            CreatureError::LevelTooLow
        );

        let new_species_id = species.evolves_to;
        msg!("Evolving species {} → {}", monster.species_id, new_species_id);

        monster.species_id = new_species_id;
        // Keep existing IVs, EVs, moves, level, XP

        Ok(())
    }

    /// Teach a monster a new move (replaces slot)
    pub fn teach_move(
        ctx: Context<TeachMove>,
        slot: u8,
        move_id: u16,
    ) -> Result<()> {
        require!(slot < 4, CreatureError::InvalidMoveSlot);
        require!(move_id < TOTAL_MOVES, CreatureError::InvalidMove);

        let monster = &mut ctx.accounts.monster_account;
        require!(
            monster.owner == ctx.accounts.player_profile.key(),
            CreatureError::NotOwner
        );

        monster.moves[slot as usize] = move_id;
        msg!("Learned move {} in slot {}", move_id, slot);
        Ok(())
    }

    /// Update battle record (called by battle program)
    pub fn record_battle_result(
        ctx: Context<RecordBattleResult>,
        won: bool,
    ) -> Result<()> {
        let profile = &mut ctx.accounts.player_profile;
        if won {
            profile.battle_wins += 1;
            profile.elo = profile.elo.saturating_add(25);
        } else {
            profile.battle_losses += 1;
            profile.elo = profile.elo.saturating_sub(15).max(100);
        }
        Ok(())
    }
}

// ─── Contexts ───────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializePlayer<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + PlayerProfile::INIT_SPACE,
        seeds = [b"profile", authority.key().as_ref()],
        bump,
    )]
    pub player_profile: Account<'info, PlayerProfile>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(species_id: u16, ivs: [u8; 6], is_shiny: bool)]
pub struct CatchMonster<'info> {
    #[account(
        mut,
        seeds = [b"profile", authority.key().as_ref()],
        bump = player_profile.bump,
    )]
    pub player_profile: Account<'info, PlayerProfile>,

    #[account(
        init,
        payer = authority,
        space = 8 + MonsterAccount::INIT_SPACE,
        seeds = [
            b"monster",
            authority.key().as_ref(),
            &player_profile.monster_count.to_le_bytes(),
        ],
        bump,
    )]
    pub monster_account: Account<'info, MonsterAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GainXp<'info> {
    #[account(
        seeds = [b"profile", authority.key().as_ref()],
        bump = player_profile.bump,
    )]
    pub player_profile: Account<'info, PlayerProfile>,

    #[account(
        mut,
        constraint = monster_account.owner == player_profile.key() @ CreatureError::NotOwner,
    )]
    pub monster_account: Account<'info, MonsterAccount>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct EvolveMonster<'info> {
    #[account(
        seeds = [b"profile", authority.key().as_ref()],
        bump = player_profile.bump,
    )]
    pub player_profile: Account<'info, PlayerProfile>,

    #[account(
        mut,
        constraint = monster_account.owner == player_profile.key() @ CreatureError::NotOwner,
    )]
    pub monster_account: Account<'info, MonsterAccount>,

    #[account(
        seeds = [b"registry"],
        bump = species_registry.bump,
    )]
    pub species_registry: Account<'info, SpeciesRegistry>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct TeachMove<'info> {
    #[account(
        seeds = [b"profile", authority.key().as_ref()],
        bump = player_profile.bump,
    )]
    pub player_profile: Account<'info, PlayerProfile>,

    #[account(
        mut,
        constraint = monster_account.owner == player_profile.key() @ CreatureError::NotOwner,
    )]
    pub monster_account: Account<'info, MonsterAccount>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RecordBattleResult<'info> {
    #[account(mut)]
    pub player_profile: Account<'info, PlayerProfile>,

    /// CHECK: Battle program PDA as authority
    pub battle_authority: Signer<'info>,
}
