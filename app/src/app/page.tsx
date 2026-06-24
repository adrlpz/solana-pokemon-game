'use client';

import { useWallet } from '@solana/wallet-adapter-react';

export default function Home() {
  const { connected, publicKey } = useWallet();

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Hero */}
      <section className="text-center py-20">
        <h1 className="font-pixel text-4xl md:text-6xl text-gradient mb-6">
          SOLMON
        </h1>
        <p className="text-xl md:text-2xl text-gray-300 mb-4">
          Collect. Breed. Battle. Earn.
        </p>
        <p className="text-gray-500 mb-8 max-w-2xl mx-auto">
          256 unique monsters across 6 elements. Turn-based 3v3 battles with
          provable fairness. Fully on-chain on Solana.
        </p>

        {connected ? (
          <div className="flex gap-4 justify-center">
            <a
              href="/dashboard"
              className="px-8 py-3 bg-solmon-primary rounded-lg font-semibold hover:bg-solmon-primary/80 transition"
            >
              My Collection
            </a>
            <a
              href="/battle"
              className="px-8 py-3 border border-solmon-secondary text-solmon-secondary rounded-lg font-semibold hover:bg-solmon-secondary/10 transition"
            >
              Battle Now
            </a>
          </div>
        ) : (
          <p className="text-solmon-secondary animate-pulse">
            Connect your wallet to start playing
          </p>
        )}
      </section>

      {/* Element Showcase */}
      <section className="py-16">
        <h2 className="font-pixel text-xl text-center mb-12">6 Elements</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { emoji: '🔥', name: 'Fire', color: 'fire' },
            { emoji: '💧', name: 'Water', color: 'water' },
            { emoji: '🌍', name: 'Earth', color: 'earth' },
            { emoji: '⚡', name: 'Electric', color: 'electric' },
            { emoji: '🌑', name: 'Shadow', color: 'shadow' },
            { emoji: '💡', name: 'Light', color: 'light' },
          ].map((el) => (
            <div
              key={el.name}
              className={`badge-${el.color.toLowerCase()} rounded-xl p-6 text-center monster-card cursor-pointer`}
            >
              <span className="text-4xl block mb-2">{el.emoji}</span>
              <span className="font-semibold">{el.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: 'Monster Species', value: '256' },
            { label: 'Element Types', value: '6' },
            { label: 'Battle Format', value: '3v3' },
            { label: 'Token Supply', value: '1B' },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-6 bg-solmon-light/50 rounded-xl">
              <p className="font-pixel text-2xl text-solmon-secondary mb-2">{stat.value}</p>
              <p className="text-sm text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <h2 className="font-pixel text-xl text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { step: '1', title: 'Connect', desc: 'Link your Solana wallet (Phantom, Solflare)', emoji: '🔗' },
            { step: '2', title: 'Collect', desc: 'Catch wild monsters in exploration zones', emoji: '🎯' },
            { step: '3', title: 'Battle', desc: 'Challenge players in 3v3 commit-reveal battles', emoji: '⚔️' },
            { step: '4', title: 'Earn', desc: 'Win $SOLMON + $SOLTREAT, trade on marketplace', emoji: '💰' },
          ].map((item) => (
            <div key={item.step} className="bg-solmon-light/30 rounded-xl p-6 text-center">
              <span className="text-3xl mb-4 block">{item.emoji}</span>
              <p className="font-pixel text-solmon-secondary mb-2">Step {item.step}</p>
              <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
              <p className="text-sm text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
