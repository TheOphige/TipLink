use anchor_lang::prelude::*;

#[error_code]
pub enum TipLinkError {
    #[msg("Recipient address is invalid or cannot tip yourself")]
    InvalidRecipient,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Tip already exists for this sender-recipient pair")]
    TipAlreadyExists,
    #[msg("Insufficient funds for tip and fees")]
    InsufficientFunds,
}