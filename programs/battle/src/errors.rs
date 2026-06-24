use anchor_lang::prelude::*;

#[error_code]
pub enum BattleError {
    #[msg("Battle is not in waiting state")]
    BattleNotWaiting,

    #[msg("Battle already has two players")]
    BattleFull,

    #[msg("Invalid battle state for this action")]
    InvalidBattleState,

    #[msg("You are not a player in this battle")]
    NotBattlePlayer,

    #[msg("Already committed this turn")]
    AlreadyCommitted,

    #[msg("Commitment hash does not match revealed move")]
    CommitmentMismatch,

    #[msg("Invalid move slot — must be 0-3")]
    InvalidMoveSlot,

    #[msg("Battle has not timed out yet")]
    NotTimedOut,

    #[msg("Battle is not finished")]
    BattleNotFinished,

    #[msg("No winner determined")]
    NoWinner,

    #[msg("You are not the winner")]
    NotWinner,

    #[msg("Invalid target monster index")]
    InvalidTarget,

    #[msg("Target monster is already fainted")]
    TargetFainted,

    #[msg("Active monster is fainted — must switch")]
    ActiveMonsterFainted,

    #[msg("All monsters fainted — cannot continue")]
    AllMonstersFainted,

    #[msg("Move power data mismatch")]
    MoveDataMismatch,

    #[msg("Monster data does not match on-chain account")]
    MonsterDataMismatch,

    #[msg("Squad not fully selected")]
    SquadIncomplete,

    #[msg("Both players must reveal before resolution")]
    RevealIncomplete,

    #[msg("Max turns reached — draw")]
    MaxTurnsReached,

    #[msg("Player has forfeited (too many timeouts)")]
    PlayerForfeited,

    #[msg("Invalid monster ownership")]
    InvalidMonsterOwner,

    #[msg("Not in switch phase")]
    NotSwitchPhase,

    #[msg("Cannot switch to fainted monster")]
    CannotSwitchToFainted,

    #[msg("Overflow in damage calculation")]
    DamageOverflow,
}
