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
  const salePrice = new anchor.BN(95 * 10 ** 6);      // 95 USDC

  before(async () => {
    const minBalance = 0.5 * LAMPORTS_PER_SOL; // SOL threshold
    const airdropAmount = 2 * LAMPORTS_PER_SOL;

    // Fund business if needed
    let businessBalance = await provider.connection.getBalance(business.publicKey);
    console.log("Business wallet balance:", businessBalance / LAMPORTS_PER_SOL, "SOL");
    if (businessBalance < minBalance) {
      console.log("Airdropping to business wallet...");
      const txSig = await provider.connection.requestAirdrop(business.publicKey, airdropAmount);
      await provider.connection.confirmTransaction(txSig, "confirmed");
    } else {
      console.log("Business wallet has enough SOL, skipping airdrop.");
    }

    // Fund investor if needed
    let investorBalance = await provider.connection.getBalance(investor.publicKey);
    console.log("Investor wallet balance:", investorBalance / LAMPORTS_PER_SOL, "SOL");
    if (investorBalance < minBalance) {
      console.log("Airdropping to investor wallet...");
      const txSig = await provider.connection.requestAirdrop(investor.publicKey, airdropAmount);
      await provider.connection.confirmTransaction(txSig, "confirmed");
    } else {
      console.log("Investor wallet has enough SOL, skipping airdrop.");
    }

    // Create mint and token accounts
    usdcMint = await createMint(
      provider.connection,
      business,
      business.publicKey,
      null,
      6 // decimals
    );

    investorTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      investor,
      usdcMint,
      investor.publicKey
    );

    businessTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      business,
      usdcMint,
      business.publicKey
    );

    // Mint tokens to investor
    await mintTo(
      provider.connection,
      business,
      usdcMint,
      investorTokenAccount,
      business,
      200 * 10 ** 6
    );
  });

  it("Should initialize an invoice", async () => {
    const dueDate = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);
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
    assert.deepEqual(invoiceAccount.status, { pending: {} });
  });

  it("Should list the invoice for sale", async () => {
    await program.methods
      .listInvoice(usdcMint, salePrice)
      .accounts({
        invoice: invoicePDA,
        business: business.publicKey,
      })
      .signers([business])
      .rpc();

    const invoiceAccount = await program.account.invoice.fetch(invoicePDA);
    assert.deepEqual(invoiceAccount.status, { listed: {} });
  });

  it("Should purchase the invoice", async () => {
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
    assert.deepEqual(invoiceAccount.status, { sold: {} });
  });

  it("Should repay investor and close invoice", async () => {
    // Add tokens to business token account for repayment
    await mintTo(
      provider.connection,
      business,
      usdcMint,
      businessTokenAccount,
      business,
      invoiceAmount.toNumber()
    );

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

    const investorAccountInfo = await getAccount(
      provider.connection,
      investorTokenAccount
    );

    const expectedBalance =
      BigInt(200 * 10 ** 6) -
      BigInt(salePrice.toNumber()) +
      BigInt(invoiceAmount.toNumber());

    assert.equal(
      investorAccountInfo.amount.toString(),
      expectedBalance.toString()
    );

    // Confirm invoice PDA is closed
    try {
      await program.account.invoice.fetch(invoicePDA);
      assert.fail("Invoice account should have been closed");
    } catch (err: any) {
      assert.include(err.message, "Account does not exist");
    }
  });
});
