'use client';

import { useWallet } from '@solana/wallet-adapter-react';

export default function Dashboard() {
  const { connected, publicKey } = useWallet();

  if (!connected) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-xl text-gray-400">Connect your wallet to view your collection</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-pixel text-xl text-gradient">My Collection</h1>
          <p className="text-sm text-gray-500 mt-1">{publicKey?.toBase58()}</p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="bg-solmon-light/50 rounded-lg px-4 py-2">
            <span className="text-gray-400">ELO:</span>
            <span className="ml-2 text-solmon-secondary font-bold">1000</span>
          </div>
          <div className="bg-solmon-light/50 rounded-lg px-4 py-2">
            <span className="text-gray-400">Wins:</span>
            <span className="ml-2 text-green-400 font-bold">0</span>
          </div>
          <div className="bg-solmon-light/50 rounded-lg px-4 py-2">
            <span className="text-gray-400">Monsters:</span>
            <span className="ml-2 text-solmon-primary font-bold">0</span>
          </div>
        </div>
      </div>

      {/* Empty state */}
      <div className="text-center py-20 bg-solmon-light/20 rounded-xl border border-solmon-primary/20">
        <span className="text-6xl block mb-4">🎮</span>
        <h2 className="text-xl font-semibold mb-2">No monsters yet</h2>
        <p className="text-gray-400 mb-6">Catch your first monster to start your journey!</p>
        <a
          href="/explore"
          className="px-6 py-3 bg-solmon-primary rounded-lg font-semibold hover:bg-solmon-primary/80 transition"
        >
          Explore Zones
        </a>
      </div>
    </div>
  );
}
