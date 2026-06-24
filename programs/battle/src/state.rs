use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct BattleSession {
    pub player1: Pubkey,         // 32
    pub player2: Pubkey,         // 32
    pub squad1: [Pubkey; 3],     // 96
    pub squad2: [Pubkey; 3],     // 96
    pub state: BattleState,      // 1 + enum
    pub current_turn: u16,       // 2
    pub wager: u64,              // 8
    pub commitment1: [u8; 32],   // 32
    pub commitment2: [u8; 32],   // 32
    pub winner: Option<Pubkey>,  // 1 + 32
    pub created_at: i64,         // 8
    pub timeout_at: i64,         // 8
    pub bump: u8,                // 1
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum BattleState {
    Waiting,       // player1 waiting for opponent
    SelectSquad,   // both picking 3 monsters
    CommitPhase,   // both committing hashed moves
    RevealPhase,   // both revealing moves
    Finished,      // winner determined
    Cancelled,     // timeout/disconnect
}
