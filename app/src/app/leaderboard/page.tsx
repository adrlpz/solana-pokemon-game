'use client';

import { useState } from 'react';

type Tab = 'elo' | 'wins' | 'collection';

const MOCK_LEADERBOARD = [
  { rank: 1, wallet: '7xKX...9fB2', elo: 2450, wins: 187, monsters: 42 },
  { rank: 2, wallet: '3mNp...1dF8', elo: 2380, wins: 165, monsters: 38 },
  { rank: 3, wallet: '9aRt...4gH1', elo: 2310, wins: 152, monsters: 55 },
  { rank: 4, wallet: '2bYu...7jK3', elo: 2245, wins: 141, monsters: 29 },
  { rank: 5, wallet: '5cWe...8kL6', elo: 2190, wins: 134, monsters: 47 },
  { rank: 6, wallet: '8dTz...2mN9', elo: 2135, wins: 128, monsters: 33 },
  { rank: 7, wallet: '1eXv...5oP2', elo: 2080, wins: 121, monsters: 51 },
  { rank: 8, wallet: '6fQw...3rS7', elo: 2025, wins: 115, monsters: 26 },
  { rank: 9, wallet: '4gAs...6tU4', elo: 1970, wins: 108, monsters: 44 },
  { rank: 10, wallet: '7hBx...9vW1', elo: 1915, wins: 102, monsters: 37 },
];

export default function Leaderboard() {
  const [tab, setTab] = useState<Tab>('elo');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-pixel text-xl text-gradient mb-2">🏆 Leaderboard</h1>
      <p className="text-gray-500 mb-6">Top players by ELO rating — Season 1</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {([
          ['elo', '⚡ ELO Rating'],
          ['wins', '⚔️ Total Wins'],
          ['collection', '🐉 Collection'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              tab === key ? 'bg-solmon-primary text-white' : 'bg-solmon-light/50 text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-solmon-light/20 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-sm text-gray-400">
              <th className="text-left py-3 px-4">Rank</th>
              <th className="text-left py-3 px-4">Player</th>
              <th className="text-right py-3 px-4">{tab === 'elo' ? 'ELO' : tab === 'wins' ? 'Wins' : 'Monsters'}</th>
              <th className="text-right py-3 px-4">Reward</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_LEADERBOARD.map((player) => (
              <tr key={player.rank} className="border-b border-gray-800/50 hover:bg-solmon-light/10 transition">
                <td className="py-3 px-4">
                  <span className={player.rank <= 3 ? 'font-bold' : 'text-gray-400'}>
                    {player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : `#${player.rank}`}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-sm">{player.wallet}</td>
                <td className="py-3 px-4 text-right font-semibold">
                  {tab === 'elo' ? player.elo : tab === 'wins' ? player.wins : player.monsters}
                </td>
                <td className="py-3 px-4 text-right text-solmon-secondary text-sm">
                  {player.rank <= 3 ? `${(4 - player.rank) * 500} $SOLMON` : player.rank <= 10 ? '100 $SOLMON' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Season Info */}
      <div className="mt-6 bg-solmon-light/20 rounded-xl p-4 border border-gray-800 text-center">
        <p className="text-sm text-gray-400">Season 1 ends in <span className="text-solmon-secondary font-semibold">23 days</span></p>
        <p className="text-xs text-gray-600 mt-1">Top 100 players earn $SOLMON rewards</p>
      </div>
    </div>
  );
}
