/// Queue timeout — 5 minutes to find opponent
pub const QUEUE_TIMEOUT: i64 = 300;

/// Squad selection timeout — 60 seconds
pub const SQUAD_SELECT_TIMEOUT: i64 = 60;

/// Commit phase timeout — 60 seconds per turn
pub const COMMIT_TIMEOUT: i64 = 60;

/// Reveal phase timeout — 60 seconds
pub const REVEAL_TIMEOUT: i64 = 60;

/// Marketplace fee — 5%
pub const MARKETPLACE_FEE_BPS: u64 = 500;

/// Type effectiveness
pub const EFFECTIVENESS_SUPER: u8 = 2;   // 1.5x
pub const EFFECTIVENESS_NORMAL: u8 = 1;  // 1.0x
pub const EFFECTIVENESS_WEAK: u8 = 0;    // 0.67x

/// Element matchups: attacker_element → [defender_element → multiplier_index]
/// 0=Fire, 1=Water, 2=Earth, 3=Electric, 4=Shadow, 5=Light
/// SUPER=2, NORMAL=1, WEAK=0
pub const ELEMENT_CHART: [[u8; 6]; 6] = [
    //           Fire  Water Earth  Elec  Shadow Light
    /* Fire    */ [1,   0,    2,    1,    1,     1],
    /* Water   */ [2,   1,    1,    0,    1,     1],
    /* Earth   */ [0,   1,    1,    2,    1,     1],
    /* Electric*/ [1,   2,    0,    1,    1,     1],
    /* Shadow  */ [1,   1,    1,    1,    1,     2],
    /* Light   */ [1,   1,    1,    1,    2,     1],
];
