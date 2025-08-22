use anchor_lang::prelude::*;

#[account]
// #[derive(InitSpace)]
pub struct Tip {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub token_mint: Pubkey, // null for SOL, otherwise SPL token
    pub timestamp: i64,
}
