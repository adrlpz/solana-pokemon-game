use anchor_lang::prelude::*;

/// Battle-relevant monster data (subset of on-chain MonsterAccount)
/// Stored per-monster in the battle session for on-chain damage calculation
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Default)]
pub struct BattleMonster {
    pub owner: Pubkey,          // 32
    pub species_id: u16,        // 2
    pub element: u8,            // 1
    pub level: u8,              // 1
    pub hp: u16,                // 2 — current HP
    pub max_hp: u16,            // 2
    pub atk: u16,               // 2
    pub def: u16,               // 2
    pub spd: u16,               // 2
    pub sp_atk: u16,            // 2
    pub sp_def: u16,            // 2
    pub moves: [u16; 4],        // 8
    pub is_fainted: bool,       // 1
}

/// Move data for damage calculation
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct MoveData {
    pub power: u16,             // 2
    pub element: u8,            // 1 — matches Element enum
    pub is_special: bool,       // 1 — true=SpATK/SpDEF, false=ATK/DEF
}

#[account]
#[derive(InitSpace)]
pub struct BattleSession {
    pub player1: Pubkey,                // 32
    pub player2: Pubkey,                // 32
    pub squad1: [BattleMonster; 3],     // 3 * ~57
    pub squad2: [BattleMonster; 3],     // 3 * ~57
    pub active1: u8,                    // 1 — index into squad1 (0-2)
    pub active2: u8,                    // 1 — index into squad2 (0-2)
    pub state: BattleState,             // 1 + enum
    pub current_turn: u16,              // 2
    pub wager: u64,                     // 8
    pub commitment1: [u8; 32],          // 32
    pub commitment2: [u8; 32],          // 32
    pub revealed1: Option<RevealedMove>, // 1 + 3
    pub revealed2: Option<RevealedMove>, // 1 + 3
    pub timeout_count1: u8,             // 1
    pub timeout_count2: u8,             // 1
    pub winner: Option<Pubkey>,         // 1 + 32
    pub turn_log: Vec<TurnEntry>,       // 4 + n*~20 (max 50 turns)
    pub created_at: i64,                // 8
    pub timeout_at: i64,                // 8
    pub bump: u8,                       // 1
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct RevealedMove {
    pub move_slot: u8,          // 1 — which of the 4 moves (0-3)
    pub target: u8,             // 1 — which enemy monster index (0-2)
    pub move_data: MoveData,    // 4
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct TurnEntry {
    pub turn: u16,              // 2
    pub action1: TurnAction,    // varies
    pub action2: TurnAction,    // varies
    pub damage1: u16,           // 2 — damage dealt by player 1
    pub damage2: u16,           // 2 — damage dealt by player 2
    pub p1_fainted: bool,       // 1
    pub p2_fainted: bool,       // 1
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct TurnAction {
    pub move_slot: u8,          // 1
    pub target: u8,             // 1
    pub damage_dealt: u16,      // 2
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum BattleState {
    Waiting,       // player1 waiting for opponent
    SelectSquad,   // both picking 3 monsters
    CommitPhase,   // both committing hashed moves
    RevealPhase,   // both revealing moves
    Executing,     // resolving turn (internal)
    Finished,      // winner determined
    Cancelled,     // timeout/disconnect
}
