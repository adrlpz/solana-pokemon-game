'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

export default function Staking() {
  const { connected } = useWallet();
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeRequested, setUnstakeRequested] = useState(false);

  const stakedBalance = 0; // TODO: fetch from on-chain
  const pendingRewards = 0;
  const apy = 5;
  const cooldownEnds = unstakeRequested ? '6d 23h remaining' : null;

  if (!connected) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-xl text-gray-400">Connect your wallet to stake</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-pixel text-xl text-gradient mb-2">🥩 Stake $SOLMON</h1>
      <p className="text-gray-500 mb-8">Stake tokens to earn passive rewards at {apy}% APY</p>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Staked', value: `${stakedBalance} $SOLMON`, color: 'text-solmon-primary' },
          { label: 'Rewards', value: `${pendingRewards} $SOLMON`, color: 'text-solmon-secondary' },
          { label: 'APY', value: `${apy}%`, color: 'text-green-400' },
          { label: 'Min Stake', value: '100 $SOLMON', color: 'text-gray-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-solmon-light/30 rounded-xl p-4 border border-gray-800 text-center">
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className={`font-semibold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Stake/Unstake */}
      <div className="bg-solmon-light/30 rounded-xl p-6 border border-gray-800">
        <div className="flex gap-2 mb-6">
          <button className="flex-1 py-2 bg-solmon-primary rounded-lg text-sm font-semibold">Stake</button>
          <button className="flex-1 py-2 bg-solmon-light rounded-lg text-sm text-gray-400 hover:text-white transition">Unstake</button>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Amount to stake</span>
            <span className="text-gray-500">Balance: 0 $SOLMON</span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-solmon-dark rounded-lg px-4 py-3 border border-gray-700 focus:border-solmon-primary focus:outline-none text-lg"
            />
            <button
              onClick={() => setStakeAmount('0')}
              className="px-4 py-2 text-sm text-solmon-secondary border border-solmon-secondary/30 rounded-lg hover:bg-solmon-secondary/10 transition"
            >
              MAX
            </button>
          </div>
        </div>

        <button className="w-full py-3 bg-solmon-primary rounded-lg font-semibold hover:bg-solmon-primary/80 transition">
          Stake $SOLMON
        </button>

        {/* Unstake cooldown */}
        {unstakeRequested && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-sm text-yellow-400">⏳ Unstake requested — {cooldownEnds}</p>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="mt-6 bg-solmon-light/20 rounded-xl p-6 border border-gray-800">
        <h3 className="font-semibold mb-3">📖 How Staking Works</h3>
        <ul className="text-sm text-gray-400 space-y-2">
          <li>• Minimum stake: 100 $SOLMON</li>
          <li>• Earn {apy}% APY, calculated per second</li>
          <li>• Rewards auto-compound when you add more stake</li>
          <li>• Unstaking has a 7-day cooldown period</li>
          <li>• Claim rewards anytime without unstaking</li>
        </ul>
      </div>
    </div>
  );
}
