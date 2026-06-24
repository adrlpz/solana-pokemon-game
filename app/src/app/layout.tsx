'use client';

import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

import '@solana/wallet-adapter-react-ui/styles.css';
import './globals.css';

const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => {
    if (process.env.NEXT_PUBLIC_RPC_URL) return process.env.NEXT_PUBLIC_RPC_URL;
    return clusterApiUrl(NETWORK as any);
  }, []);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <html lang="en">
      <body>
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              <div className="min-h-screen flex flex-col">
                <Header />
                <main className="flex-1">{children}</main>
                <Footer />
              </div>
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </body>
    </html>
  );
}

function Header() {
  return (
    <header className="border-b border-solmon-primary/20 bg-solmon-dark/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎮</span>
          <h1 className="font-pixel text-sm text-gradient">SOLMON</h1>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <a href="/" className="hover:text-solmon-secondary transition">Home</a>
          <a href="/dashboard" className="hover:text-solmon-secondary transition">Collection</a>
          <a href="/battle" className="hover:text-solmon-secondary transition">Battle</a>
          <a href="/marketplace" className="hover:text-solmon-secondary transition">Marketplace</a>
          <a href="/breed" className="hover:text-solmon-secondary transition">Breed</a>
        </nav>
        <wallet-multi-button />
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-solmon-primary/20 py-6 text-center text-sm text-gray-500">
      <p>SOLMON — Solana Monster Battle ⚡ Built on Solana</p>
    </footer>
  );
}
