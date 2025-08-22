use anchor_lang::prelude::*;
use crate::states::Tip;
use crate::errors::*;

#[derive(Accounts)]
pub struct SendTip<'info> {
    #[account(
        init, 
        payer = sender, 
        space = Tip::INIT_SPACE, // Add discriminator space
        seeds = [b"tip", sender.key().as_ref(), recipient.key().as_ref()], 
        bump,
    )]
    pub tip: Account<'info, Tip>,
    #[account(mut)]
    pub sender: Signer<'info>,
    /// CHECK: recipient can be any wallet - validated in seeds
    pub recipient: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn send_tip(ctx: Context<SendTip>, amount: u64, token_mint: Pubkey) -> Result<()> {
    // Validate amount
    require!(amount > 0, TipLinkError::InvalidAmount);
    
    // Additional validation: prevent self-tipping
    require!(
        *ctx.accounts.sender.key != *ctx.accounts.recipient.key,
        TipLinkError::InvalidRecipient
    );
    
    let tip = &mut ctx.accounts.tip;
    tip.sender = *ctx.accounts.sender.key;
    tip.recipient = *ctx.accounts.recipient.key;
    tip.amount = amount;
    tip.token_mint = token_mint;
    tip.timestamp = Clock::get()?.unix_timestamp;
    
    // Emit event for indexing
    emit!(TipSentEvent {
        sender: tip.sender,
        recipient: tip.recipient,
        amount: tip.amount,
        token_mint: tip.token_mint,
        timestamp: tip.timestamp,
    });
    
    Ok(())
}

#[event]
pub struct TipSentEvent {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub token_mint: Pubkey,
    pub timestamp: i64,
}