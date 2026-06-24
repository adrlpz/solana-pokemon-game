/// Total monster species
pub const TOTAL_SPECIES: u16 = 256;

/// Species per registry chunk
pub const SPECIES_PER_CHUNK: usize = 64;

/// Total registry chunks (256 / 64)
pub const REGISTRY_CHUNKS: u8 = 4;

/// Total moves in the game
pub const TOTAL_MOVES: u16 = 64;

/// Max monsters per player
pub const MAX_MONSTERS_PER_PLAYER: u32 = 100;

/// Max EV total across all stats
pub const MAX_EV_TOTAL: u16 = 510;

/// Max EV per individual stat
pub const MAX_EV_PER_STAT: u16 = 252;

/// Max monster level
pub const MAX_LEVEL: u8 = 100;

/// Stat indices
pub const STAT_HP: usize = 0;
pub const STAT_ATK: usize = 1;
pub const STAT_DEF: usize = 2;
pub const STAT_SPD: usize = 3;
pub const STAT_SPATK: usize = 4;
pub const STAT_SPDEF: usize = 5;

/// Element effectiveness multiplier (integer basis points)
/// 150 = 1.5x, 100 = 1.0x, 67 = 0.67x
pub const EFFECTIVENESS_SUPER: u16 = 150;
pub const EFFECTIVENESS_NORMAL: u16 = 100;
pub const EFFECTIVENESS_NOT_VERY: u16 = 67;

/// Element matchup chart [attacker][defender] → effectiveness in basis points
/// 0=Fire, 1=Water, 2=Earth, 3=Electric, 4=Shadow, 5=Light
pub const ELEMENT_CHART: [[u16; 6]; 6] = [
    //         Fire  Water Earth  Elec  Shadow Light
    /*Fire*/   [100,  67,  150,  100,  100,  100],
    /*Water*/  [150,  100, 100,  67,   100,  100],
    /*Earth*/  [67,   100, 100,  150,  100,  100],
    /*Elec*/   [100,  150, 67,   100,  100,  100],
    /*Shadow*/ [100,  100, 100,  100,  100,  150],
    /*Light*/  [100,  100, 100,  100,  150,  100],
];

/// XP required to reach a level: xp_required(level) = level^2 * 100
/// Inverse: level = floor(sqrt(xp / 100)) + 1
pub fn xp_for_level(level: u8) -> u32 {
    (level as u32).pow(2) * 100
}

/// Calculate level from XP
pub fn level_from_xp(xp: u32) -> u8 {
    let level = ((xp as f64 / 100.0).sqrt() as u8) + 1;
    level.min(MAX_LEVEL)
}

/// Get effectiveness in basis points
pub fn get_effectiveness(attacker_element: u8, defender_element: u8) -> u16 {
    if attacker_element >= 6 || defender_element >= 6 {
        return EFFECTIVENESS_NORMAL;
    }
    ELEMENT_CHART[attacker_element as usize][defender_element as usize]
}
