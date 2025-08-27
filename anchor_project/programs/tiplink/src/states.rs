use anchor_lang::prelude::*;

#[account]
pub struct Tip {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub token_mint: Pubkey, // System program pubkey for SOL, otherwise SPL token mint
    pub timestamp: i64,
    pub tip_count: u64, // Track number of tips from this sender to this recipient
    pub bump: u8,
}
