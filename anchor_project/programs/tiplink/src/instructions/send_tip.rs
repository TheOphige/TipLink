use anchor_lang::prelude::*;
use crate::states::Tip;

#[derive(Accounts)]
pub struct SendTip<'info> {
    #[account(init, payer = sender, space = 8 + 32 + 32 + 8 + 8)]
    pub tip: Account<'info, Tip>,
    #[account(mut)]
    pub sender: Signer<'info>,
    /// CHECK: recipient can be any wallet
    pub recipient: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn send_tip(ctx: Context<SendTip>, amount: u64, token_mint: Pubkey) -> Result<()> {
    let tip = &mut ctx.accounts.tip;
    tip.sender = *ctx.accounts.sender.key;
    tip.recipient = *ctx.accounts.recipient.key;
    tip.amount = amount;
    tip.token_mint = token_mint;
    tip.timestamp = Clock::get()?.unix_timestamp;
    Ok(())
}
