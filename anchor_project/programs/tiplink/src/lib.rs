use anchor_lang::prelude::*;
pub mod states;
pub mod instructions;
pub mod errors;

use instructions::send_tip::*;

declare_id!("DyC9Xyx6VNyCV5BSHDss2qkoShMDMErt563DTNzz5GXA");

#[program]
pub mod tiplink {
    use super::*;

    pub fn send_tip(ctx: Context<SendTip>, amount: u64, token_mint: Pubkey) -> Result<()> {
        instructions::send_tip::send_tip(ctx, amount, token_mint)
    }
}