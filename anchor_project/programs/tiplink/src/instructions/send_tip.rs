use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::{
    token::{self, Mint, Token, TokenAccount, Transfer},
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
        space = 8 + Tip::INIT_SPACE,
        seeds = [b"tip", sender.key().as_ref(), recipient.key().as_ref()],
        bump,
    )]
    pub tip: Account<'info, Tip>,
    
    #[account(mut)]
    pub sender: Signer<'info>,
    
    /// CHECK: recipient can be any wallet
    #[account(mut)]
    pub recipient: AccountInfo<'info>,
    
    // For SOL tips - always required
    pub system_program: Program<'info, System>,
    
    // For SPL token tips (optional based on token_mint)
    pub mint: Option<Account<'info, Mint>>,
    
    #[account(mut)]
    pub sender_token_account: Option<Account<'info, TokenAccount>>,
    
    #[account(mut)]
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

    // Determine if this is a SOL or SPL token tip
    let is_sol_tip = token_mint == system_program.key();

    if is_sol_tip {
        // Handle SOL transfer
        let sender_lamports = sender.lamports();
        
        require!(
            sender_lamports >= amount, 
            TipLinkError::InsufficientFunds
        );

        // Transfer SOL from sender to recipient
        system_program::transfer(
            CpiContext::new(
                system_program.to_account_info(),
                system_program::Transfer {
                    from: sender.to_account_info(),
                    to: recipient.to_account_info(),
                },
            ),
            amount,
        )?;
    } else {
        // Handle SPL token transfer
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

        // Verify mint matches
        require!(
            mint.key() == token_mint,
            TipLinkError::InvalidRecipient
        );

        // Verify token accounts belong to correct mint
        require!(
            sender_token_account.mint == token_mint,
            TipLinkError::InvalidRecipient
        );

        require!(
            sender_token_account.amount >= amount,
            TipLinkError::InsufficientFunds
        );

        // Transfer SPL tokens from sender to recipient
        token::transfer(
            CpiContext::new(
                token_program.to_account_info(),
                Transfer {
                    from: sender_token_account.to_account_info(),
                    to: recipient_token_account.to_account_info(),
                    authority: sender.to_account_info(),
                },
            ),
            amount,
        )?;
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
        "Tip sent: {} {} from {} to {}",
        amount,
        if is_sol_tip { "lamports" } else { "tokens" },
        sender.key(),
        recipient.key()
    );

    Ok(())
}