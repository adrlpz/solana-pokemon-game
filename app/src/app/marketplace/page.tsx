'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

type Tab = 'monsters' | 'items' | 'my-listings';

export default function Marketplace() {
  const { connected } = useWallet();
  const [tab, setTab] = useState<Tab>('monsters');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-pixel text-xl text-gradient">🏪 Marketplace</h1>
        {connected && (
          <button className="px-4 py-2 bg-solmon-primary rounded-lg text-sm font-semibold hover:bg-solmon-primary/80 transition">
            + List Monster
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['monsters', 'items', 'my-listings'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              tab === t
                ? 'bg-solmon-primary text-white'
                : 'bg-solmon-light/50 text-gray-400 hover:text-white'
            }`}
          >
            {t === 'monsters' ? '🐉 Monsters' : t === 'items' ? '🧪 Items' : '📦 My Listings'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select className="bg-solmon-light border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-solmon-primary focus:outline-none">
          <option>All Elements</option>
          <option>🔥 Fire</option>
          <option>💧 Water</option>
          <option>🌍 Earth</option>
          <option>⚡ Electric</option>
          <option>🌑 Shadow</option>
          <option>💡 Light</option>
        </select>
        <select className="bg-solmon-light border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-solmon-primary focus:outline-none">
          <option>All Rarities</option>
          <option>Common</option>
          <option>Uncommon</option>
          <option>Rare</option>
          <option>Legendary</option>
          <option>Mythic</option>
        </select>
        <select className="bg-solmon-light border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-solmon-primary focus:outline-none">
          <option>Price: Low → High</option>
          <option>Price: High → Low</option>
          <option>Level: High → Low</option>
          <option>Recently Listed</option>
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {/* Placeholder cards */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="bg-solmon-light/30 rounded-xl p-4 border border-gray-800 monster-card cursor-pointer"
          >
            <div className="aspect-square bg-solmon-dark/50 rounded-lg mb-3 flex items-center justify-center text-4xl">
              🎮
            </div>
            <p className="font-semibold text-sm">Monster #{i + 1}</p>
            <p className="text-xs text-gray-500">Lv. 1 · Common</p>
            <p className="text-solmon-secondary font-bold text-sm mt-2">0.1 SOL</p>
          </div>
        ))}
      </div>
    </div>
  );
}
