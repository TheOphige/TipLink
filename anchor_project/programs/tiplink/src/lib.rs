use anchor_lang::prelude::*;

declare_id!("DyC9Xyx6VNyCV5BSHDss2qkoShMDMErt563DTNzz5GXA");

#[program]
pub mod tiplink {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
