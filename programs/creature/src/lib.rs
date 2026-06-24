use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, SetAuthority};
use anchor_spl::token::spl_token::instruction::AuthorityType;

pub mod constants;
pub mod errors;
pub mod state;

use constants::*;
use errors::*;
use state::*;

declare_id!("5fbkSTigPB76nwTW2Pea4D8oKG5Y3LhjaNWMLCGqoyjL");

#[program]
pub mod solmon_creature {
    use super::*;

    // ─── Player Management ──────────────────────────────────

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

        msg!("Player profile initialized for {}", profile.authority);
        Ok(())
    }

    // ─── Species Registry ───────────────────────────────────

    /// Initialize a species registry chunk (64 species per chunk, 4 chunks total)
    pub fn initialize_registry(
        ctx: Context<InitializeRegistry>,
        chunk_index: u8,
        species_data: Vec<SpeciesData>,
    ) -> Result<()> {
        require!(chunk_index < REGISTRY_CHUNKS, CreatureError::InvalidChunkIndex);
        require!(species_data.len() <= SPECIES_PER_CHUNK, CreatureError::InvalidChunkIndex);

        let registry = &mut ctx.accounts.species_registry;
        registry.authority = ctx.accounts.authority.key();
        registry.total_species = TOTAL_SPECIES;
        registry.chunk_index = chunk_index;
        registry.bump = ctx.bumps.species_registry;

        // Copy species data into fixed-size array
        for (i, species) in species_data.iter().enumerate() {
            registry.species[i] = *species;
        }

        msg!("Registry chunk {} initialized with {} species", chunk_index, species_data.len());
        Ok(())
    }

    // ─── Monster Catching ───────────────────────────────────

    /// Catch a wild monster — creates MonsterAccount + mints NFT
    pub fn catch_monster(
        ctx: Context<CatchMonster>,
        species_id: u16,
        ivs: [u8; 6],
        is_shiny: bool,
    ) -> Result<()> {
        require!(species_id < TOTAL_SPECIES, CreatureError::InvalidSpecies);

        let profile = &mut ctx.accounts.player_profile;
        require!(
            profile.monster_count < MAX_MONSTERS_PER_PLAYER,
            CreatureError::MonsterLimitReached
        );

        // Validate IVs (0-31)
        for iv in &ivs {
            require!(*iv <= 31, CreatureError::InvalidIV);
        }

        // Fetch species data for base_moves
        let chunk_idx = (species_id / SPECIES_PER_CHUNK as u16) as u8;
        let local_idx = (species_id % SPECIES_PER_CHUNK as u16) as usize;

        // Initialize monster account
        let monster = &mut ctx.accounts.monster_account;
        monster.owner = profile.key();
        monster.species_id = species_id;
        monster.level = 1;
        monster.xp = 0;
        monster.ivs = ivs;
        monster.evs = [0u16; 6];
        monster.ability_id = 0; // default, could read from registry
        monster.is_shiny = is_shiny;
        monster.mint = ctx.accounts.monster_mint.key();
        monster.created_at = Clock::get()?.unix_timestamp;
        monster.bump = ctx.bumps.monster_account;

        // Try to read base_moves from registry chunk if available
        // Default moves if registry not loaded yet
        monster.moves = [0, 0, 0, 0];

        // Mint exactly 1 token (NFT) to the player's token account
        let seeds = &[
            b"mint-authority".as_ref(),
            &[ctx.bumps.mint_authority],
        ];
        let signer_seeds = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.monster_mint.to_account_info(),
                    to: ctx.accounts.player_token_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer_seeds,
            ),
            1, // NFT = 1 token
        )?;

        // Freeze mint so no more tokens can be minted for this NFT
        let cpi_accounts = SetAuthority {
            account_or_mint: ctx.accounts.monster_mint.to_account_info(),
            current_authority: ctx.accounts.mint_authority.to_account_info(),
        };
        token::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            ),
            AuthorityType::MintTokens,
            None, // revoke mint authority → frozen supply of 1
        )?;

        profile.monster_count += 1;

        msg!(
            "Caught species {} (chunk {}) at level 1! Shiny: {} | Mint: {}",
            species_id, chunk_idx, is_shiny, ctx.accounts.monster_mint.key()
        );
        Ok(())
    }

    // ─── XP & Leveling ──────────────────────────────────────

    /// Award XP to a monster, handles level ups
    pub fn gain_xp(ctx: Context<GainXp>, amount: u32) -> Result<()> {
        let monster = &mut ctx.accounts.monster_account;

        require!(
            monster.owner == ctx.accounts.player_profile.key(),
            CreatureError::NotOwner
        );

        monster.xp = monster.xp.checked_add(amount).ok_or(CreatureError::XpOverflow)?;
        let new_level = level_from_xp(monster.xp);

        if new_level > monster.level {
            msg!("Level up! {} → {}", monster.level, new_level);
            monster.level = new_level;
        }

        msg!("Gained {} XP, now at level {} (total XP: {})", amount, monster.level, monster.xp);
        Ok(())
    }

    // ─── EV Training ────────────────────────────────────────

    /// Award EVs to a monster (from battling specific species)
    pub fn gain_ev(
        ctx: Context<GainEv>,
        stat_index: u8,
        amount: u16,
    ) -> Result<()> {
        require!(stat_index < 6, CreatureError::InvalidStatIndex);

        let monster = &mut ctx.accounts.monster_account;
        require!(
            monster.owner == ctx.accounts.player_profile.key(),
            CreatureError::NotOwner
        );

        let idx = stat_index as usize;

        // Per-stat cap
        let new_stat_ev = monster.evs[idx].saturating_add(amount);
        require!(new_stat_ev <= MAX_EV_PER_STAT, CreatureError::EVLimitPerStat);

        // Total cap
        let total_ev: u16 = monster.evs.iter().sum::<u16>().saturating_sub(monster.evs[idx]).saturating_add(new_stat_ev);
        require!(total_ev <= MAX_EV_TOTAL, CreatureError::EVLimitTotal);

        monster.evs[idx] = new_stat_ev;

        msg!("Gained {} EVs in stat {} (total: {}/{})", amount, stat_index, total_ev, MAX_EV_TOTAL);
        Ok(())
    }

    // ─── Evolution ──────────────────────────────────────────

    /// Evolve a monster if it meets the level requirement
    pub fn evolve_monster(ctx: Context<EvolveMonster>) -> Result<()> {
        let monster = &mut ctx.accounts.monster_account;
        let registry = &ctx.accounts.species_registry;

        let local_idx = (monster.species_id % SPECIES_PER_CHUNK as u16) as usize;
        let species = &registry.species[local_idx];

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
        // IVs, EVs, moves, level, XP all preserved

        Ok(())
    }

    // ─── Move Management ────────────────────────────────────

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

        let old_move = monster.moves[slot as usize];
        monster.moves[slot as usize] = move_id;

        msg!("Replaced move {} → {} in slot {}", old_move, move_id, slot);
        Ok(())
    }

    // ─── Battle Record (CPI from battle program) ───────────

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
        msg!("Battle recorded — wins: {}, losses: {}, elo: {}", profile.battle_wins, profile.battle_losses, profile.elo);
        Ok(())
    }

    // ─── View Helpers (read-only, no state change) ──────────

    /// Calculate and return a monster's current stats
    pub fn get_stats(ctx: Context<GetStats>) -> Result<CalcStats> {
        let monster = &ctx.accounts.monster_account;

        // We need species data, but can't read cross-account in this simple version
        // Return placeholder; client should call with species registry
        let default_species = SpeciesData {
            base_stats: [50, 50, 50, 50, 50, 50],
            element: 0,
            rarity: 0,
            evolves_to: 0xFFFF,
            evolution_level: 0,
            base_moves: [0; 4],
            ability_id: 0,
        };

        let stats = default_species.calc_all_stats(&monster.ivs, &monster.evs, monster.level);
        msg!("Stats for monster {}: HP={}, ATK={}, DEF={}, SPD={}, SpATK={}, SpDEF={}",
            monster.species_id, stats.hp, stats.atk, stats.def, stats.spd, stats.sp_atk, stats.sp_def);

        Ok(stats)
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
#[instruction(chunk_index: u8, species_data: Vec<SpeciesData>)]
pub struct InitializeRegistry<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + SpeciesRegistry::INIT_SPACE,
        seeds = [b"registry", [chunk_index].as_ref()],
        bump,
    )]
    pub species_registry: Account<'info, SpeciesRegistry>,

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
    pub player_profile: Box<Account<'info, PlayerProfile>>,

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
    pub monster_account: Box<Account<'info, MonsterAccount>>,

    /// Monster NFT mint — must be a fresh keypair per monster
    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = mint_authority,
        mint::token_program = token_program,
    )]
    pub monster_mint: Box<Account<'info, Mint>>,

    /// CHECK: PDA that acts as mint authority
    #[account(
        seeds = [b"mint-authority"],
        bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,

    /// Player's token account for this monster NFT
    #[account(
        init,
        payer = authority,
        token::mint = monster_mint,
        token::authority = authority,
        token::token_program = token_program,
    )]
    pub player_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
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
pub struct GainEv<'info> {
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
        seeds = [b"registry", &[get_registry_chunk(monster_account.species_id)]],
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

#[derive(Accounts)]
pub struct GetStats<'info> {
    pub monster_account: Account<'info, MonsterAccount>,
}

// ─── Helpers ────────────────────────────────────────────────

/// Get the registry chunk index for a species
fn get_registry_chunk(species_id: u16) -> u8 {
    (species_id / SPECIES_PER_CHUNK as u16) as u8
}
