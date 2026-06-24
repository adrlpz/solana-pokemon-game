'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

type BattleState = 'lobby' | 'matching' | 'selecting' | 'committing' | 'revealing' | 'result';

export default function Battle() {
  const { connected } = useWallet();
  const [battleState, setBattleState] = useState<BattleState>('lobby');
  const [wager, setWager] = useState(0);

  if (!connected) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-xl text-gray-400">Connect your wallet to battle</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-pixel text-xl text-gradient mb-8">⚔️ Battle Arena</h1>

      {battleState === 'lobby' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Quick Battle */}
          <div className="bg-solmon-light/30 rounded-xl p-6 border border-solmon-primary/20">
            <h2 className="text-lg font-semibold mb-4">⚡ Quick Battle</h2>
            <p className="text-sm text-gray-400 mb-4">
              Find an opponent instantly. No wager, just for fun.
            </p>
            <button
              onClick={() => setBattleState('matching')}
              className="w-full py-3 bg-solmon-primary rounded-lg font-semibold hover:bg-solmon-primary/80 transition"
            >
              Find Match
            </button>
          </div>

          {/* Wager Battle */}
          <div className="bg-solmon-light/30 rounded-xl p-6 border border-solmon-secondary/20">
            <h2 className="text-lg font-semibold mb-4">💰 Wager Battle</h2>
            <p className="text-sm text-gray-400 mb-4">
              Set a wager in SOL. Winner takes 95% (5% fee).
            </p>
            <div className="mb-4">
              <label className="text-sm text-gray-400 block mb-1">Wager (SOL)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={wager}
                onChange={(e) => setWager(Number(e.target.value))}
                className="w-full bg-solmon-dark rounded-lg px-4 py-2 border border-gray-700 focus:border-solmon-primary focus:outline-none"
                placeholder="0.00"
              />
            </div>
            <button
              onClick={() => setBattleState('matching')}
              className="w-full py-3 bg-solmon-secondary text-solmon-dark rounded-lg font-semibold hover:bg-solmon-secondary/80 transition"
            >
              Create Wager Battle
            </button>
          </div>

          {/* Ranked */}
          <div className="bg-solmon-light/30 rounded-xl p-6 border border-electric/20 md:col-span-2">
            <h2 className="text-lg font-semibold mb-4">🏆 Ranked Battle</h2>
            <p className="text-sm text-gray-400 mb-4">
              Climb the leaderboard. Top 100 earn $SOLMON rewards each season.
            </p>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="font-pixel text-2xl text-electric">1000</p>
                <p className="text-xs text-gray-500">Your ELO</p>
              </div>
              <button
                onClick={() => setBattleState('matching')}
                className="flex-1 py-3 bg-electric/20 border border-electric text-electric rounded-lg font-semibold hover:bg-electric/30 transition"
              >
                Queue Ranked
              </button>
            </div>
          </div>
        </div>
      )}

      {battleState === 'matching' && (
        <div className="text-center py-20">
          <div className="animate-spin text-6xl mb-6">⚔️</div>
          <h2 className="text-xl font-semibold mb-2">Finding opponent...</h2>
          <p className="text-gray-400">Estimated wait: 30s</p>
          <button
            onClick={() => setBattleState('lobby')}
            className="mt-6 px-6 py-2 border border-gray-600 rounded-lg text-sm hover:bg-gray-800 transition"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
