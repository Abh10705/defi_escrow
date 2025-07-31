import { useState, useEffect, useCallback } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Program, AnchorProvider, web3, BN, Idl } from '@coral-xyz/anchor';
import { DefiEscrow } from '../../target/types/defi_escrow';
import idl from '../../target/idl/defi_escrow.json';
import { PublicKey } from '@solana/web3.js';

interface InvoiceAccount {
  business: PublicKey;
  investor: PublicKey;
  mint: PublicKey;
  amount: BN;
  dueDate: BN;
  status: object;
  bump: number;
}

const PROGRAM_ID = new PublicKey(idl.metadata.address);

export default function Home() {
    const [invoices, setInvoices] = useState<{ publicKey: PublicKey; account: InvoiceAccount }[]>([]);
    const [program, setProgram] = useState<Program<DefiEscrow> | null>(null);
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');
    
    const wallet = useAnchorWallet();
    const { connection } = useConnection();

    useEffect(() => {
        if (wallet) {
            const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
            const programInstance = new Program<DefiEscrow>(idl as Idl, PROGRAM_ID, provider);
            setProgram(programInstance);
        }
    }, [wallet, connection]);
    
    const fetchInvoices = useCallback(async () => {
        if (!program) return;
        const fetchedInvoices = await program.account.invoice.all();
        setInvoices(fetchedInvoices as any);
    }, [program]);

    useEffect(() => {
        if (program) {
            fetchInvoices();
        }
    }, [program, fetchInvoices]);


    const initializeInvoice = async () => {
        if (!program || !wallet) return;
        
        const invoiceAmount = new BN(parseFloat(amount) * 10**6); // Example: assuming 6 decimals
        const dueDateBN = new BN(new Date(dueDate).getTime() / 1000);

        const [invoicePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("invoice"), wallet.publicKey.toBuffer()],
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
        
        alert("Invoice created successfully!");
        fetchInvoices();
    };

    const MOCK_USDC_MINT = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");

    const listInvoice = async (invoicePDA: PublicKey) => {
        if (!program || !wallet) return;
        await program.methods
            .listInvoice(MOCK_USDC_MINT)
            .accounts({
                invoice: invoicePDA,
                business: wallet.publicKey,
            })
            .rpc();
        alert("Invoice listed for sale!");
        fetchInvoices();
    };

    return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ color: '#333' }}>DeFi Invoice Marketplace</h1>
                <WalletMultiButton />
            </header>

            {wallet && (
                <main>
                    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', marginBottom: '2rem' }}>
                        <h2>Create a New Invoice</h2>
                        <input type="number" placeholder="Amount (in USDC)" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ padding: '0.5rem', marginRight: '1rem' }} />
                        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ padding: '0.5rem', marginRight: '1rem' }} />
                        <button onClick={initializeInvoice} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Create Invoice</button>
                    </div>

                    <div>
                        <h2>Your Invoices</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                            {invoices.map(({ publicKey, account }) => (
                                <div key={publicKey.toBase58()} style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px', backgroundColor: 'white' }}>
                                    <p><strong>Business:</strong> {account.business.toBase58().substring(0, 8)}...</p>
                                    <p><strong>Amount:</strong> {(account.amount.toNumber() / 10**6).toFixed(2)} USDC</p>
                                    <p><strong>Status:</strong> {Object.keys(account.status)[0]}</p>
                                    {wallet && account.status.hasOwnProperty('pending') && account.business.equals(wallet.publicKey) && (
                                        <button onClick={() => listInvoice(publicKey)} style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: 'blue', color: 'white' }}>List for Sale</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </main>
            )}
        </div>
    );
}