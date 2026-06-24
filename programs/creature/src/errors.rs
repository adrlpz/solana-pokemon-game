use anchor_lang::prelude::*;

#[error_code]
pub enum CreatureError {
    #[msg("Invalid species ID — must be 0-255")]
    InvalidSpecies,

    #[msg("Invalid IV — must be 0-31")]
    InvalidIV,

    #[msg("Monster limit reached (max 100 per player)")]
    MonsterLimitReached,

    #[msg("Not the monster owner")]
    NotOwner,

    #[msg("XP overflow")]
    XpOverflow,

    #[msg("This species cannot evolve")]
    CannotEvolve,

    #[msg("Level too low for evolution")]
    LevelTooLow,

    #[msg("Invalid move slot — must be 0-3")]
    InvalidMoveSlot,

    #[msg("Invalid move ID")]
    InvalidMove,
}
