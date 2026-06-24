/// Queue timeout — 5 minutes to find opponent
pub const QUEUE_TIMEOUT: i64 = 300;

/// Squad selection timeout — 120 seconds
pub const SQUAD_SELECT_TIMEOUT: i64 = 120;

/// Commit phase timeout — 60 seconds per turn
pub const COMMIT_TIMEOUT: i64 = 60;

/// Reveal phase timeout — 60 seconds
pub const REVEAL_TIMEOUT: i64 = 60;

/// Max timeouts before forfeit
pub const MAX_TIMEOUTS: u8 = 3;

/// Max turns before draw
pub const MAX_TURNS: u16 = 100;

/// Max turn log entries stored
pub const MAX_TURN_LOG: usize = 50;

/// Marketplace/battle fee — 5%
pub const FEE_BPS: u64 = 500;
pub const BPS_DENOMINATOR: u64 = 10000;

/// Type effectiveness in basis points
/// 150 = 1.5x, 100 = 1.0x, 67 = 0.67x
pub const EFF_SUPER: u16 = 150;
pub const EFF_NORMAL: u16 = 100;
pub const EFF_WEAK: u16 = 67;

/// Element matchup chart [attacker][defender] → effectiveness (bps)
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

/// STAB multiplier (same-type attack bonus) — 150 = 1.5x
pub const STAB_BPS: u16 = 150;
pub const STAB_NORMAL: u16 = 100;

/// Random factor range — damage * random(85, 100) / 100
/// We use a pseudo-random based on turn + blockhash
pub const RANDOM_MIN: u16 = 85;
pub const RANDOM_MAX: u16 = 100;
