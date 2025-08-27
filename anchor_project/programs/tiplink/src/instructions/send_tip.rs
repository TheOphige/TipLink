use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::{
    token::{Mint, Token, TokenAccount},
    associated_token::AssociatedToken,
};
use crate::states::Tip;
use crate::errors::TipLinkError;

#[derive(Accounts)]
#[instruction(amount: u64, token_mint: Pubkey)]
pub struct SendTip<'info> {
    #[account(
        init_if_needed,
        payer = sender,
        space = 8 + 129,
        seeds = [b"tip", sender.key().as_ref(), recipient.key().as_ref()],
        bump,
    )]
    pub tip: Account<'info, Tip>,
    
    #[account(mut)]
    pub sender: Signer<'info>,
    
    /// CHECK: recipient can be any wallet
    pub recipient: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
    
    pub mint: Option<Account<'info, Mint>>,
    
    pub sender_token_account: Option<Account<'info, TokenAccount>>,
    
    pub recipient_token_account: Option<Account<'info, TokenAccount>>,
    
    pub token_program: Option<Program<'info, Token>>,
    pub associated_token_program: Option<Program<'info, AssociatedToken>>,
}

pub fn send_tip(ctx: Context<SendTip>, amount: u64, token_mint: Pubkey) -> Result<()> {
    // Validation checks
    require!(amount > 0, TipLinkError::InvalidAmount);
    require!(
        ctx.accounts.sender.key() != ctx.accounts.recipient.key(),
        TipLinkError::SelfTip
    );

    let tip = &mut ctx.accounts.tip;
    let sender = &ctx.accounts.sender;
    let recipient = &ctx.accounts.recipient;
    let system_program = &ctx.accounts.system_program;

    let is_sol_tip = token_mint == system_program.key();

    if !is_sol_tip {
        // Validate SPL token accounts 
        let mint = ctx.accounts.mint
            .as_ref()
            .ok_or(TipLinkError::InvalidRecipient)?;
        let sender_token_account = ctx.accounts.sender_token_account
            .as_ref()
            .ok_or(TipLinkError::InvalidRecipient)?;
        let recipient_token_account = ctx.accounts.recipient_token_account
            .as_ref()
            .ok_or(TipLinkError::InvalidRecipient)?;
        let token_program = ctx.accounts.token_program
            .as_ref()
            .ok_or(TipLinkError::InvalidRecipient)?;

        require!(
            mint.key() == token_mint,
            TipLinkError::InvalidRecipient
        );
        require!(
            sender_token_account.mint == token_mint,
            TipLinkError::InvalidRecipient
        );
        require!(
            recipient_token_account.mint == token_mint,
            TipLinkError::InvalidRecipient
        );
    }

    // Record the tip
    tip.sender = sender.key();
    tip.recipient = recipient.key();
    tip.amount = amount;
    tip.token_mint = token_mint;
    tip.timestamp = Clock::get()?.unix_timestamp;
    tip.tip_count = tip.tip_count.checked_add(1).unwrap_or(1);
    tip.bump = ctx.bumps.tip;

    msg!(
        "Tip logged: {} {} from {} to {}",
        amount,
        if is_sol_tip { "lamports" } else { "tokens" },
        sender.key(),
        recipient.key()
    );

    Ok(())
}