import { useState, useEffect, useCallback } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Program, AnchorProvider, web3, BN, Idl } from '@coral-xyz/anchor';
import { DefiEscrow } from '../../target/types/defi_escrow';
import idl from '../../target/idl/defi_escrow.json';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import Image from 'next/image';

// InvoiceAccount typing
interface InvoiceAccount {
  business: PublicKey;
  investor: PublicKey;
  mint: PublicKey;
  amount: BN;
  salePrice: BN;
  dueDate: BN;
  status: Record<string, unknown>;
  bump: number;
}

const PROGRAM_ID = new PublicKey(idl.address);

export default function Home() {
  const [invoices, setInvoices] = useState<{ publicKey: PublicKey; account: InvoiceAccount }[]>([]);
  const [program, setProgram] = useState<Program<DefiEscrow> | null>(null);
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isClient, setIsClient] = useState(false);

  const wallet = useAnchorWallet();
  const { connection } = useConnection();

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    if (idl && PROGRAM_ID && wallet && connection) {
      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
      const programInstance = new Program<DefiEscrow>(idl as Idl, provider);
      setProgram(programInstance);
    }
  }, [wallet, connection]);

  const fetchInvoices = useCallback(async () => {
    if (!program) return;
    try {
      const fetchedInvoices = await program.account.invoice.all();
      setInvoices(fetchedInvoices as any);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  }, [program]);

  useEffect(() => { if (program) fetchInvoices(); }, [program, fetchInvoices]);

  const initializeInvoice = async () => {
    if (!program || !wallet || !amount || !dueDate) return;
    try {
      const invoiceAmount = new BN(parseFloat(amount) * 10 ** 6);
      const dueDateBN = new BN(new Date(dueDate).getTime() / 1000);
      const [invoicePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('invoice'), wallet.publicKey.toBuffer()],
        program.programId
      );
      await program.methods
        .initializeInvoice(invoiceAmount, dueDateBN)
        .accounts({
          invoice: invoicePDA,
          business: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();
      console.log('Invoice created successfully!');
      await fetchInvoices();
    } catch (error) {
      console.error('Error creating invoice:', error);
    }
  };

  const MOCK_USDC_MINT = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');

  const listInvoice = async (invoicePDA: PublicKey) => {
    if (!program || !wallet) return;
    const currentInvoice = invoices.find(inv => inv.publicKey.equals(invoicePDA));
    if (!currentInvoice) return;
    const salePriceString = prompt(
      `Face value: ${currentInvoice.account.amount.toNumber() / 10 ** 6} USDC. Enter sale price:`
    );
    if (!salePriceString) return;
    const salePrice = new BN(parseFloat(salePriceString) * 10 ** 6);
    try {
      await program.methods
        .listInvoice(MOCK_USDC_MINT, salePrice)
        .accounts({ invoice: invoicePDA, business: wallet.publicKey })
        .rpc();
      console.log('Invoice listed!');
      fetchInvoices();
    } catch (error) {
      console.error('Error listing invoice:', error);
    }
  };

  const purchaseInvoice = async (invoicePDA: PublicKey, account: InvoiceAccount) => {
    if (!program || !wallet) return;
    try {
      const investorATA = await getAssociatedTokenAddress(account.mint, wallet.publicKey);
      const businessATA = await getAssociatedTokenAddress(account.mint, account.business);
      const preInstructions: TransactionInstruction[] = [];
      try { await getAccount(connection, investorATA); }
      catch { preInstructions.push(createAssociatedTokenAccountInstruction(wallet.publicKey, investorATA, wallet.publicKey, account.mint)); }
      try { await getAccount(connection, businessATA); }
      catch { preInstructions.push(createAssociatedTokenAccountInstruction(wallet.publicKey, businessATA, account.business, account.mint)); }
      await program.methods
        .purchaseInvoice()
        .accounts({
          invoice: invoicePDA,
          investor: wallet.publicKey,
          investorTokenAccount: investorATA,
          businessTokenAccount: businessATA,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions(preInstructions)
        .rpc();
      console.log('Invoice purchased!');
      fetchInvoices();
    } catch (error) {
      console.error('Error purchasing invoice:', error);
    }
  };

  const cancelInvoice = async (invoicePDA: PublicKey) => {
    if (!program || !wallet) return;
    try {
      await program.methods
        .cancelInvoice()
        .accounts({ invoice: invoicePDA, business: wallet.publicKey })
        .rpc();
      console.log('Invoice cancelled!');
      fetchInvoices();
    } catch (error) {
      console.error('Error cancelling invoice:', error);
    }
  };

  const repayInvestor = async (invoicePDA: PublicKey, account: InvoiceAccount) => {
    if (!program || !wallet) return;
    try {
      const investorATA = await getAssociatedTokenAddress(account.mint, account.investor);
      const businessATA = await getAssociatedTokenAddress(account.mint, wallet.publicKey);
      await program.methods
        .repayInvestorAndClose()
        .accounts({
          invoice: invoicePDA,
          business: wallet.publicKey,
          investorTokenAccount: investorATA,
          businessTokenAccount: businessATA,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      console.log('Investor repaid!');
      fetchInvoices();
    } catch (error) {
      console.error('Error repaying investor:', error);
    }
  };
  
    const styles = {
        container: { maxWidth: '1200px', margin: '0 auto', padding: '2rem' },
        header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4rem' },
        headerLeft: { display: 'flex', alignItems: 'center', gap: '1rem' },
        title: { fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' },
        card: { background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '2rem', marginBottom: '2rem' },
        inputGroup: { display: 'flex', gap: '1rem', marginBottom: '1rem' },
        input: { flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.2)', background: 'rgba(0, 0, 0, 0.2)', color: '#fff', fontSize: '16px' },
        invoiceGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '2rem' },
        invoiceCard: { background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column' as const, gap: '1rem' },
        statusBadge: { padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', alignSelf: 'flex-start' },
        buttonGroup: { marginTop: 'auto', display: 'flex', gap: '0.5rem' }
    };
    
    const getStatusStyle = (status: Record<string, unknown>) => {
        if ('pending' in status) return { color: '#000', background: '#ffc107' };
        if ('listed' in status) return { color: '#fff', background: '#007bff' };
        if ('sold' in status) return { color: '#fff', background: '#28a745' };
        return { color: '#fff', background: '#6c757d' };
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <div style={styles.headerLeft}>
                    <Image src="/logo.png" alt="Defi Escrow Logo" width={60} height={60} />
                    <h1 style={styles.title}>Defi Escrow</h1>
                </div>
                {isClient && <WalletMultiButton />}
            </header>

            {wallet && (
                <main>
                    <div style={styles.card}>
                        <h2 style={{ marginTop: 0 }}>Create a New Invoice</h2>
                        <div style={styles.inputGroup}>
                            <input type="number" placeholder="Amount (in USDC)" value={amount} onChange={(e) => setAmount(e.target.value)} style={styles.input} />
                            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={styles.input} />
                        </div>
                        <button onClick={initializeInvoice} style={{ width: '100%', background: 'linear-gradient(90deg, #4F46E5, #8B5CF6)', color: '#fff' }}>Create & Secure Invoice</button>
                    </div>

                    <div>
                        <h2>Invoice Marketplace</h2>
                        <div style={styles.invoiceGrid}>
                            {invoices.map(({ publicKey, account }) => {
                                const isBusinessOwner = wallet && account.business.equals(wallet.publicKey);
                                const isSold = 'sold' in account.status;
                                const isListed = 'listed' in account.status;
                                const isPending = 'pending' in account.status;
                                const statusKey = Object.keys(account.status)[0];
                                const yieldAmount = (account.amount.toNumber() - account.salePrice.toNumber()) / 10**6;

                                return (
                                <div key={publicKey.toBase58()} style={styles.invoiceCard}>
                                    <div>
                                        <span style={{...styles.statusBadge, ...getStatusStyle(account.status)}}>{statusKey.toUpperCase()}</span>
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, color: '#aaa' }}>Face Value</p>
                                        <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>{(account.amount.toNumber() / 10**6).toFixed(2)} USDC</p>
                                    </div>
                                    
                                    {isListed && (
                                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                                            <p style={{ margin: 0, color: '#aaa' }}>Asking Price</p>
                                            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#28a745' }}>
                                                {(account.salePrice.toNumber() / 10**6).toFixed(2)} USDC
                                            </p>
                                             <p style={{ margin: 0, fontSize: '1rem', color: '#aaa' }}>
                                                Potential Yield: {yieldAmount.toFixed(2)} USDC
                                            </p>
                                        </div>
                                    )}

                                    <p style={{ margin: '1rem 0', fontSize: '12px', color: '#aaa' }}>
                                        <strong>Business:</strong> {account.business.toBase58()}
                                    </p>
                                    <div style={styles.buttonGroup}>
                                        {isBusinessOwner && isPending && (
                                            <button onClick={() => listInvoice(publicKey)} style={{ background: '#007bff', color: 'white' }}>List for Sale</button>
                                        )}
                                        {isBusinessOwner && (isPending || isListed) && (
                                            <button onClick={() => cancelInvoice(publicKey)} style={{ background: '#dc3545', color: 'white' }}>Cancel</button>
                                        )}
                                        {!isBusinessOwner && isListed && (
                                            <button onClick={() => purchaseInvoice(publicKey, account)} style={{ background: '#28a745', color: 'white' }}>Purchase Invoice</button>
                                        )}
                                        {isBusinessOwner && isSold && (
                                            <button onClick={() => repayInvestor(publicKey, account)} style={{ background: '#ffc107', color: 'black' }}>Repay Investor</button>
                                        )}
                                    </div>
                                </div>
                                )})}
                        </div>
                    </div>
                </main>
            )}
        </div>
    );
}