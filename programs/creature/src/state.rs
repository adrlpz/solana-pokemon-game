use anchor_lang::prelude::*;

/// Player profile — one per wallet
#[account]
#[derive(InitSpace)]
pub struct PlayerProfile {
    pub authority: Pubkey,       // 32
    pub monster_count: u32,      // 4
    pub battle_wins: u32,        // 4
    pub battle_losses: u32,      // 4
    pub elo: u32,                // 4
    pub created_at: i64,         // 8
    pub bump: u8,                // 1
}

/// Individual monster instance — on-chain state
#[account]
#[derive(InitSpace)]
pub struct MonsterAccount {
    pub owner: Pubkey,           // 32 — PlayerProfile PDA
    pub species_id: u16,         // 2
    pub level: u8,               // 1
    pub xp: u32,                 // 4
    pub ivs: [u8; 6],            // 6 — HP, ATK, DEF, SPD, SpATK, SpDEF
    pub evs: [u16; 6],           // 12
    pub moves: [u16; 4],         // 8
    pub ability_id: u8,          // 1
    pub is_shiny: bool,          // 1
    pub mint: Pubkey,            // 32 — SPL token mint (NFT)
    pub created_at: i64,         // 8
    pub bump: u8,                // 1
}

/// Global species registry — 256 species data
/// Stored as a single account (too large for one PDA, split into 4 chunks)
#[account]
#[derive(InitSpace)]
pub struct SpeciesRegistry {
    pub authority: Pubkey,                // 32
    pub total_species: u16,               // 2
    pub chunk_index: u8,                  // 1 — 0-3 (64 species per chunk)
    pub bump: u8,                         // 1
    pub species: [SpeciesData; 64],       // 64 entries per chunk
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct SpeciesData {
    pub base_stats: [u8; 6],    // 6 — HP, ATK, DEF, SPD, SpATK, SpDEF
    pub element: u8,             // 1 — 0=Fire..5=Light
    pub rarity: u8,              // 1 — 0=Common..4=Mythic
    pub evolves_to: u16,         // 2 — 0xFFFF = no evolution
    pub evolution_level: u8,     // 1
    pub base_moves: [u16; 4],   // 8
    pub ability_id: u8,          // 1
}

/// Calculated stats for display (not stored on-chain, computed)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct CalcStats {
    pub hp: u16,
    pub atk: u16,
    pub def: u16,
    pub spd: u16,
    pub sp_atk: u16,
    pub sp_def: u16,
}

/// Element enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Element {
    Fire,     // 0
    Water,    // 1
    Earth,    // 2
    Electric, // 3
    Shadow,   // 4
    Light,    // 5
}

/// Rarity enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Rarity {
    Common,    // 0
    Uncommon,  // 1
    Rare,      // 2
    Legendary, // 3
    Mythic,    // 4
}

impl SpeciesData {
    /// Calculate stat at a given level
    pub fn calc_stat(&self, stat_idx: usize, iv: u8, ev: u16, level: u8) -> u16 {
        let base = self.base_stats[stat_idx] as u32;
        let iv = iv as u32;
        let ev = ev as u32;
        let level = level as u32;

        if stat_idx == 0 {
            // HP formula
            ((2 * base + iv + ev / 4) * level / 100 + level + 10) as u16
        } else {
            // Other stats
            ((2 * base + iv + ev / 4) * level / 100 + 5) as u16
        }
    }

    /// Calculate all 6 stats
    pub fn calc_all_stats(&self, ivs: &[u8; 6], evs: &[u16; 6], level: u8) -> CalcStats {
        CalcStats {
            hp: self.calc_stat(0, ivs[0], evs[0], level),
            atk: self.calc_stat(1, ivs[1], evs[1], level),
            def: self.calc_stat(2, ivs[2], evs[2], level),
            spd: self.calc_stat(3, ivs[3], evs[3], level),
            sp_atk: self.calc_stat(4, ivs[4], evs[4], level),
            sp_def: self.calc_stat(5, ivs[5], evs[5], level),
        }
    }
}
