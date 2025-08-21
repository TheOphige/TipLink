use anchor_lang::prelude::*;

#[error_code]
pub enum TipLinkError {
    #[msg("Recipient address is invalid")]
    InvalidRecipient,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
}
