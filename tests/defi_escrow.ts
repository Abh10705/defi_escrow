import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DefiEscrow } from "../target/types/defi_escrow";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

describe("defi_escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.DefiEscrow as Program<DefiEscrow>;

  const business = Keypair.generate();
  const investor = Keypair.generate();

  const [invoicePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("invoice"), business.publicKey.toBuffer()],
    program.programId
  );

  let usdcMint: PublicKey;
  let businessTokenAccount: PublicKey;
  let investorTokenAccount: PublicKey;

  const invoiceAmount = new anchor.BN(100 * 10 ** 6); // 100 USDC
  const salePrice = new anchor.BN(95 * 10 ** 6); // 95 USDC sale price

  before(async () => {
    // Airdrop SOL to the business wallet and WAIT for it to be confirmed.
    const businessAirdropSignature = await provider.connection.requestAirdrop(
      business.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(businessAirdropSignature, "confirmed");

    // Airdrop SOL to the investor wallet and WAIT for it to be confirmed.
    const investorAirdropSignature = await provider.connection.requestAirdrop(
      investor.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(investorAirdropSignature, "confirmed");

    usdcMint = await createMint(provider.connection, business, business.publicKey, null, 6);
    investorTokenAccount = await createAssociatedTokenAccount(provider.connection, investor, usdcMint, investor.publicKey);
    businessTokenAccount = await createAssociatedTokenAccount(provider.connection, business, usdcMint, business.publicKey);
    await mintTo(provider.connection, business, usdcMint, investorTokenAccount, business, 200 * 10 ** 6);
  });

  it("Should initialize an invoice", async () => {
    const dueDate = new anchor.BN(Date.now() / 1000 + 3600);
    await program.methods
      .initializeInvoice(invoiceAmount, dueDate)
      .accounts({
        invoice: invoicePDA,
        business: business.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([business])
      .rpc();
    const invoiceAccount = await program.account.invoice.fetch(invoicePDA);
    assert.ok(invoiceAccount.status.pending);
  });

  it("Should list an invoice for sale", async () => {
    await program.methods
      .listInvoice(usdcMint, salePrice)
      .accounts({
        invoice: invoicePDA,
        business: business.publicKey,
      })
      .signers([business])
      .rpc();
    const invoiceAccount = await program.account.invoice.fetch(invoicePDA);
    assert.ok(invoiceAccount.status.listed);
  });

  it("Should purchase an invoice", async () => {
    await program.methods
      .purchaseInvoice()
      .accounts({
        invoice: invoicePDA,
        investor: investor.publicKey,
        investorTokenAccount: investorTokenAccount,
        businessTokenAccount: businessTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([investor])
      .rpc();
    const invoiceAccount = await program.account.invoice.fetch(invoicePDA);
    assert.ok(invoiceAccount.status.sold);
  });

  it("Should repay the investor and close the account", async () => {
     await mintTo(provider.connection, business, usdcMint, businessTokenAccount, business, invoiceAmount.toNumber());
    await program.methods
      .repayInvestorAndClose()
      .accounts({
        invoice: invoicePDA,
        business: business.publicKey,
        investorTokenAccount: investorTokenAccount,
        businessTokenAccount: businessTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([business])
      .rpc();
    const investorAccountInfo = await getAccount(provider.connection, investorTokenAccount);
    const expectedInvestorBalance = (200 * 10 ** 6) - salePrice.toNumber() + invoiceAmount.toNumber();
    assert.equal(investorAccountInfo.amount.toString(), expectedInvestorBalance.toString());
    try {
      await program.account.invoice.fetch(invoicePDA);
      assert.fail("The invoice account should have been closed");
    } catch (error) {
      assert.include(error.message, "Account does not exist");
    }
  });
});