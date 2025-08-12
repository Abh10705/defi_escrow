use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("BD7NH19PHYwgpDDcAY5JAgNWByeVDYwHbTV5vpZv8VYJ"); 

#[program]
pub mod defi_escrow {
    use super::*;

    pub fn initialize_invoice(
        ctx: Context<InitializeInvoice>,
        amount: u64,
        due_date: i64
    ) -> Result<()> {
        let invoice = &mut ctx.accounts.invoice;
        invoice.business = ctx.accounts.business.key();
        invoice.investor = Pubkey::default();
        invoice.mint = Pubkey::default();
        invoice.amount = amount;
        invoice.sale_price = 0;
        invoice.due_date = due_date;
        invoice.status = InvoiceStatus::Pending;
        // CORRECTED LINE:
        invoice.bump = ctx.bumps.invoice;
        Ok(())
    }

    pub fn list_invoice(ctx: Context<ListInvoice>, token_mint: Pubkey, sale_price: u64) -> Result<()> {
        let invoice = &mut ctx.accounts.invoice;
        require!(sale_price < invoice.amount, ErrorCode::InvalidSalePrice);
        invoice.status = InvoiceStatus::Listed;
        invoice.mint = token_mint;
        invoice.sale_price = sale_price;
        Ok(())
    }

    pub fn purchase_invoice(ctx: Context<PurchaseInvoice>) -> Result<()> {
        let invoice = &mut ctx.accounts.invoice;
        require!(invoice.status == InvoiceStatus::Listed, ErrorCode::NotListed);
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.investor_token_account.to_account_info(),
                    to: ctx.accounts.business_token_account.to_account_info(),
                    authority: ctx.accounts.investor.to_account_info(),
                },
            ),
            invoice.sale_price,
        )?;
        invoice.investor = ctx.accounts.investor.key();
        invoice.status = InvoiceStatus::Sold;
        Ok(())
    }

    pub fn cancel_invoice(ctx: Context<CancelInvoice>) -> Result<()> {
        require!(ctx.accounts.invoice.status != InvoiceStatus::Sold, ErrorCode::AlreadySold);
        Ok(())
    }

    pub fn repay_investor_and_close(ctx: Context<RepayInvestorAndClose>) -> Result<()> {
        let invoice = &ctx.accounts.invoice;
        require!(invoice.status == InvoiceStatus::Sold, ErrorCode::NotSold);
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.business_token_account.to_account_info(),
                    to: ctx.accounts.investor_token_account.to_account_info(),
                    authority: ctx.accounts.business.to_account_info(),
                },
            ),
            invoice.amount,
        )?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeInvoice<'info> {
    #[account(init, payer = business, space = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 1, seeds = [b"invoice", business.key().as_ref()], bump)]
    pub invoice: Account<'info, Invoice>,
    #[account(mut)]
    pub business: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ListInvoice<'info> {
    #[account(mut, has_one = business)]
    pub invoice: Account<'info, Invoice>,
    pub business: Signer<'info>,
}

#[derive(Accounts)]
pub struct PurchaseInvoice<'info> {
    #[account(mut)]
    pub invoice: Account<'info, Invoice>,
    #[account(mut)]
    pub investor: Signer<'info>,
    #[account(mut)]
    pub investor_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub business_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelInvoice<'info> {
    #[account(mut, has_one = business, close = business)]
    pub invoice: Account<'info, Invoice>,
    pub business: Signer<'info>,
}

#[derive(Accounts)]
pub struct RepayInvestorAndClose<'info> {
    #[account(mut, has_one = business, close = business)]
    pub invoice: Account<'info, Invoice>,
    #[account(mut)]
    pub business: Signer<'info>,
    #[account(mut)]
    pub investor_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub business_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum InvoiceStatus {
    Pending, Listed, Sold, Repaid, Cancelled,
}

#[account]
pub struct Invoice {
    pub business: Pubkey,
    pub investor: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub sale_price: u64,
    pub due_date: i64,
    pub status: InvoiceStatus,
    pub bump: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invoice is not listed for sale.")]
    NotListed,
    #[msg("Invoice has already been sold and cannot be cancelled.")]
    AlreadySold,
    #[msg("Invoice must be in the 'Sold' state to be repaid.")]
    NotSold,
    #[msg("Sale price must be less than the invoice amount.")]
    InvalidSalePrice,
}