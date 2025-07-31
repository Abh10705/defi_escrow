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
  
  const invoiceAmount = new anchor.BN(100 * 10 ** 6); // 100 USDC with 6 decimals

  before(async () => {
   
    await provider.connection.requestAirdrop(
      business.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      investor.publicKey,
      2 * LAMPORTS_PER_SOL
    );

   
    usdcMint = await createMint(
      provider.connection,
      business, 
      business.publicKey, 
      null,
      6 
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

    await mintTo(
      provider.connection,
      investor,
      usdcMint,
      investorTokenAccount,
      business,
      200 * 10 ** 6 
    );
  });

  it("Should initialize an invoice", async () => {
    const dueDate = new anchor.BN(Date.now() / 1000 + 3600); // Due in 1 hour

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
    assert.equal(
      invoiceAccount.business.toBase58(),
      business.publicKey.toBase58()
    );
    assert.equal(invoiceAccount.amount.toString(), invoiceAmount.toString());
    assert.ok(invoiceAccount.status.pending);
  });

  it("Should list an invoice for sale", async () => {
    await program.methods
      .listInvoice(usdcMint)
      .accounts({
        invoice: invoicePDA,
        business: business.publicKey,
      })
      .signers([business])
      .rpc();

    const invoiceAccount = await program.account.invoice.fetch(invoicePDA);
    assert.ok(invoiceAccount.status.listed);
    assert.equal(invoiceAccount.mint.toBase58(), usdcMint.toBase58());
  });

  it("Should purchase an invoice", async () => {
    await program.methods
      .purchaseInvoice()
      .accounts({
        invoice: invoicePDA,
        investor: investor.publicKey,
        investorTokenAccount: investorTokenAccount,
        businessTokenAccount: businessTokenAccount,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([investor])
      .rpc();

    const invoiceAccount = await program.account.invoice.fetch(invoicePDA);
    assert.ok(invoiceAccount.status.sold);
    assert.equal(
      invoiceAccount.investor.toBase58(),
      investor.publicKey.toBase58()
    );

    const businessAccountInfo = await getAccount(provider.connection, businessTokenAccount);
    assert.equal(businessAccountInfo.amount.toString(), invoiceAmount.toString());
  });

  it("Should repay the investor and close the account", async () => {
    await program.methods
      .repayInvestorAndClose()
      .accounts({
        invoice: invoicePDA,
        business: business.publicKey,
        investorTokenAccount: investorTokenAccount,
        businessTokenAccount: businessTokenAccount,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([business])
      .rpc();

    try {
      await program.account.invoice.fetch(invoicePDA);
      assert.fail("The invoice account should have been closed");
    } catch (error) {
      assert.include(error.message, "Account does not exist");
    }
  });
});