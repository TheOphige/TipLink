use anchor_lang::prelude::*;

#[account]
pub struct Tip {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub token_mint: Pubkey,
    pub timestamp: i64,
    pub tip_count: u64, 
    pub bump: u8,
}
