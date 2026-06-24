'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

export default function Breed() {
  const { connected } = useWallet();
  const [parent1, setParent1] = useState<number | null>(null);
  const [parent2, setParent2] = useState<number | null>(null);
  const [breeding, setBreeding] = useState(false);
  const [result, setResult] = useState<{ speciesId: number; ivs: number[]; isShiny: boolean } | null>(null);

  const handleBreed = () => {
    if (parent1 === null || parent2 === null) return;
    setBreeding(true);
    setResult(null);

    setTimeout(() => {
      // Simulate breeding result
      const offspringIvs = Array.from({ length: 6 }, () => Math.floor(Math.random() * 32));
      const isShiny = Math.random() < 0.05;
      setResult({ speciesId: parent1, ivs: offspringIvs, isShiny });
      setBreeding(false);
    }, 3000);
  };

  if (!connected) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-xl text-gray-400">Connect your wallet to breed monsters</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-pixel text-xl text-gradient mb-2">🧬 Breeding Lab</h1>
      <p className="text-gray-500 mb-8">Combine two monsters to create offspring with inherited IVs</p>

      <div className="grid md:grid-cols-3 gap-6 items-center">
        {/* Parent 1 */}
        <div className="bg-solmon-light/30 rounded-xl p-6 border border-gray-800 text-center">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">Parent 1 (Mother)</h3>
          <div className="aspect-square bg-solmon-dark/50 rounded-lg flex items-center justify-center text-5xl mb-4">
            {parent1 !== null ? '🐉' : '➕'}
          </div>
          <p className="text-sm text-gray-400">
            {parent1 !== null ? `Monster #${parent1}` : 'Select monster'}
          </p>
        </div>

        {/* Breed button */}
        <div className="text-center">
          <div className="text-4xl mb-4">💕</div>
          <button
            onClick={handleBreed}
            disabled={parent1 === null || parent2 === null || breeding}
            className="px-6 py-3 bg-solmon-primary rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-solmon-primary/80 transition"
          >
            {breeding ? '🧬 Breeding...' : '🥚 Breed'}
          </button>
          <p className="text-xs text-gray-600 mt-2">Costs 100 $SOLTREAT</p>
          <p className="text-xs text-gray-600">24h cooldown per monster</p>
        </div>

        {/* Parent 2 */}
        <div className="bg-solmon-light/30 rounded-xl p-6 border border-gray-800 text-center">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">Parent 2 (Father)</h3>
          <div className="aspect-square bg-solmon-dark/50 rounded-lg flex items-center justify-center text-5xl mb-4">
            {parent2 !== null ? '🐉' : '➕'}
          </div>
          <p className="text-sm text-gray-400">
            {parent2 !== null ? `Monster #${parent2}` : 'Select monster'}
          </p>
        </div>
      </div>

      {/* Breeding Rules */}
      <div className="mt-8 bg-solmon-light/20 rounded-xl p-6 border border-gray-800">
        <h3 className="font-semibold mb-3">📋 Breeding Rules</h3>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• Offspring species: 80% mother, 20% father</li>
          <li>• IVs: average of parents ± random mutation (±3)</li>
          <li>• 5% chance to inherit rare abilities</li>
          <li>• Egg hatches after 10 battles or 24 hours</li>
          <li>• 5% chance of shiny offspring</li>
          <li>• Each monster has 24h breeding cooldown</li>
        </ul>
      </div>

      {/* Result */}
      {result && (
        <div className="mt-6 bg-solmon-secondary/10 rounded-xl p-6 border border-solmon-secondary/30">
          <h3 className="font-semibold text-solmon-secondary mb-3">🥚 Egg Created!</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Species</p>
              <p className="font-mono">#{result.speciesId}</p>
            </div>
            <div>
              <p className="text-gray-400">Shiny</p>
              <p>{result.isShiny ? '✨ Yes!' : 'No'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-400 mb-1">IVs</p>
              <div className="flex gap-2">
                {['HP', 'ATK', 'DEF', 'SPD', 'SpA', 'SpD'].map((label, i) => (
                  <div key={i} className="text-center">
                    <p className="text-[10px] text-gray-500">{label}</p>
                    <p className="font-mono text-solmon-secondary">{result.ivs[i]}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
