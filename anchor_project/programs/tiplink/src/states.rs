use anchor_lang::prelude::*;

#[account]
pub struct Tip {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}
