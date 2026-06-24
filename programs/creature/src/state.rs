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
    pub is_shiny: bool,          // 1
    pub created_at: i64,         // 8
    pub bump: u8,                // 1
}

/// Global species registry — 256 species data
#[account]
#[derive(InitSpace)]
pub struct SpeciesRegistry {
    pub species: [SpeciesData; 256],
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct SpeciesData {
    pub base_stats: [u8; 6],    // 6
    pub element: u8,             // 1 — 0=Fire..5=Light
    pub rarity: u8,              // 1 — 0=Common..4=Mythic
    pub evolves_to: u16,         // 2 — 0xFFFF = no evolution
    pub evolution_level: u8,     // 1
    pub base_moves: [u16; 4],   // 8
    pub ability_id: u8,          // 1
}

/// Element enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Element {
    Fire,
    Water,
    Earth,
    Electric,
    Shadow,
    Light,
}

/// Rarity enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Rarity {
    Common,
    Uncommon,
    Rare,
    Legendary,
    Mythic,
}
