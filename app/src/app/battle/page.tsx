'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

// ─── Types ──────────────────────────────────────────────────

type BattlePhase = 'lobby' | 'matching' | 'selecting' | 'active' | 'finished';

interface Monster {
  name: string;
  element: string;
  emoji: string;
  level: number;
  hp: number;
  maxHp: number;
  moves: { name: string; power: number; element: string; emoji: string }[];
  isFainted: boolean;
}

interface TurnLogEntry {
  turn: number;
  p1Action: string;
  p2Action: string;
  p1Damage: number;
  p2Damage: number;
}

// ─── Mock Data ──────────────────────────────────────────────

function makeMonster(name: string, element: string, emoji: string, level: number, hp: number): Monster {
  return {
    name,
    element,
    emoji,
    level,
    hp,
    maxHp: hp,
    isFainted: false,
    moves: [
      { name: 'Tackle', power: 40, element: 'Normal', emoji: '👊' },
      { name: 'Flamethrower', power: 90, element: element, emoji: '🔥' },
      { name: 'Quick Attack', power: 40, element: 'Normal', emoji: '⚡' },
      { name: 'Hyper Beam', power: 150, element: element, emoji: '💥' },
    ],
  };
}

// ─── Component ──────────────────────────────────────────────

export default function Battle() {
  const { connected } = useWallet();
  const [phase, setPhase] = useState<BattlePhase>('lobby');
  const [wager, setWager] = useState(0);
  const [turnLog, setTurnLog] = useState<TurnLogEntry[]>([]);
  const [currentTurn, setCurrentTurn] = useState(1);
  const [commitPhase, setCommitPhase] = useState<'select' | 'committing' | 'waiting' | 'revealing' | 'done'>('select');
  const [selectedMove, setSelectedMove] = useState<number | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);

  // Mock battle state
  const [mySquad, setMySquad] = useState<Monster[]>([
    makeMonster('Emberpup', 'Fire', '🔥', 50, 200),
    makeMonster('Tidefin', 'Water', '💧', 48, 180),
    makeMonster('Sparkit', 'Electric', '⚡', 45, 170),
  ]);
  const [enemySquad, setEnemySquad] = useState<Monster[]>([
    makeMonster('Pebblit', 'Earth', '🌍', 49, 190),
    makeMonster('Gloomkit', 'Shadow', '🌑', 47, 175),
    makeMonster('Gleamlet', 'Light', '💡', 46, 165),
  ]);
  const [myActive, setMyActive] = useState(0);
  const [enemyActive, setEnemyActive] = useState(0);

  // ─── Actions ──────────────────────────────────────────────

  const handleStartBattle = () => {
    setPhase('matching');
    setTimeout(() => setPhase('selecting'), 2000);
  };

  const handleStartFight = () => {
    setPhase('active');
    setCommitPhase('select');
    setCurrentTurn(1);
  };

  const handleCommitMove = () => {
    if (selectedMove === null || selectedTarget === null) return;
    setCommitPhase('committing');

    // Simulate opponent commit + reveal
    setTimeout(() => {
      const myMove = mySquad[myActive].moves[selectedMove];
      const enemyMove = enemySquad[enemyActive].moves[0];

      // Calculate mock damage
      const myDmg = Math.floor(myMove.power * (0.85 + Math.random() * 0.15));
      const enemyDmg = Math.floor(enemyMove.power * (0.85 + Math.random() * 0.15));

      // Apply damage
      const newEnemySquad = [...enemySquad];
      newEnemySquad[selectedTarget] = {
        ...newEnemySquad[selectedTarget],
        hp: Math.max(0, newEnemySquad[selectedTarget].hp - myDmg),
        isFainted: newEnemySquad[selectedTarget].hp - myDmg <= 0,
      };

      const newMySquad = [...mySquad];
      newMySquad[myActive] = {
        ...newMySquad[myActive],
        hp: Math.max(0, newMySquad[myActive].hp - enemyDmg),
        isFainted: newMySquad[myActive].hp - enemyDmg <= 0,
      };

      setEnemySquad(newEnemySquad);
      setMySquad(newMySquad);

      // Log turn
      setTurnLog((prev) => [
        ...prev,
        {
          turn: currentTurn,
          p1Action: `${mySquad[myActive].name} used ${myMove.name} → ${enemySquad[selectedTarget].name}`,
          p2Action: `${enemySquad[enemyActive].name} used ${enemyMove.name} → ${mySquad[myActive].name}`,
          p1Damage: myDmg,
          p2Damage: enemyDmg,
        },
      ]);

      // Check win conditions
      const allEnemyFainted = newEnemySquad.every((m) => m.isFainted);
      const allMyFainted = newMySquad.every((m) => m.isFainted);

      if (allEnemyFainted || allMyFainted) {
        setPhase('finished');
        return;
      }

      // Auto-switch fainted
      if (newMySquad[myActive].isFainted) {
        const nextAlive = newMySquad.findIndex((m, i) => i !== myActive && !m.isFainted);
        if (nextAlive >= 0) setMyActive(nextAlive);
      }
      if (newEnemySquad[enemyActive].isFainted) {
        const nextAlive = newEnemySquad.findIndex((m, i) => i !== enemyActive && !m.isFainted);
        if (nextAlive >= 0) setEnemyActive(nextAlive);
      }

      setCurrentTurn((t) => t + 1);
      setSelectedMove(null);
      setSelectedTarget(null);
      setCommitPhase('select');
    }, 2000);
  };

  if (!connected) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-xl text-gray-400">Connect your wallet to battle</p>
      </div>
    );
  }

  // ─── Lobby ────────────────────────────────────────────────

  if (phase === 'lobby') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-pixel text-xl text-gradient mb-8">⚔️ Battle Arena</h1>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-solmon-light/30 rounded-xl p-6 border border-solmon-primary/20">
            <h2 className="text-lg font-semibold mb-4">⚡ Quick Battle</h2>
            <p className="text-sm text-gray-400 mb-4">No wager, find opponent instantly</p>
            <button onClick={handleStartBattle} className="w-full py-3 bg-solmon-primary rounded-lg font-semibold hover:bg-solmon-primary/80 transition">
              Find Match
            </button>
          </div>
          <div className="bg-solmon-light/30 rounded-xl p-6 border border-solmon-secondary/20">
            <h2 className="text-lg font-semibold mb-4">💰 Wager Battle</h2>
            <p className="text-sm text-gray-400 mb-4">Set a wager, winner takes 95%</p>
            <input type="number" value={wager || ''} onChange={(e) => setWager(Number(e.target.value))} placeholder="0.00 SOL" className="w-full bg-solmon-dark rounded-lg px-4 py-2 border border-gray-700 focus:border-solmon-primary focus:outline-none mb-4" />
            <button onClick={handleStartBattle} className="w-full py-3 bg-solmon-secondary text-solmon-dark rounded-lg font-semibold hover:bg-solmon-secondary/80 transition">
              Create Wager Battle
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Matching ─────────────────────────────────────────────

  if (phase === 'matching') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="animate-spin text-6xl mb-6">⚔️</div>
        <h2 className="text-xl font-semibold mb-2">Finding opponent...</h2>
        <p className="text-gray-400">Estimated wait: 30s</p>
        <button onClick={() => setPhase('lobby')} className="mt-6 px-6 py-2 border border-gray-600 rounded-lg text-sm hover:bg-gray-800 transition">Cancel</button>
      </div>
    );
  }

  // ─── Squad Select ─────────────────────────────────────────

  if (phase === 'selecting') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-pixel text-xl text-center mb-8">⚔️ Select Your Squad</h1>
        <p className="text-center text-gray-400 mb-6">Choose 3 monsters for battle</p>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {mySquad.map((m, i) => (
            <div key={i} className="bg-solmon-light/30 rounded-xl p-4 border border-solmon-primary text-center">
              <span className="text-4xl block mb-2">{m.emoji}</span>
              <p className="font-semibold">{m.name}</p>
              <p className="text-xs text-gray-500">Lv. {m.level}</p>
            </div>
          ))}
        </div>
        <button onClick={handleStartFight} className="w-full py-3 bg-solmon-primary rounded-lg font-semibold hover:bg-solmon-primary/80 transition">
          ⚔️ Start Battle!
        </button>
      </div>
    );
  }

  // ─── Active Battle ────────────────────────────────────────

  if (phase === 'active') {
    const myMon = mySquad[myActive];
    const enemyMon = enemySquad[enemyActive];

    return (
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Turn counter */}
        <div className="text-center mb-4">
          <span className="text-sm text-gray-500">Turn {currentTurn}</span>
        </div>

        {/* Battle field */}
        <div className="bg-solmon-light/20 rounded-xl border border-gray-800 p-6 mb-4">
          {/* Enemy */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="text-5xl">{enemyMon.emoji}</div>
              <div>
                <p className="font-semibold">{enemyMon.name}</p>
                <p className="text-xs text-gray-500">Lv. {enemyMon.level}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-1">HP</p>
              <div className="w-48 h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${enemyMon.hp / enemyMon.maxHp > 0.5 ? 'bg-green-500' : enemyMon.hp / enemyMon.maxHp > 0.2 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${(enemyMon.hp / enemyMon.maxHp) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{enemyMon.hp}/{enemyMon.maxHp}</p>
            </div>
          </div>

          {/* VS */}
          <div className="text-center text-2xl text-gray-600 my-4">⚔️</div>

          {/* My monster */}
          <div className="flex items-center justify-between">
            <div className="text-right flex-1">
              <p className="text-xs text-gray-400 mb-1">HP</p>
              <div className="w-48 h-3 bg-gray-800 rounded-full overflow-hidden ml-auto">
                <div
                  className={`h-full rounded-full transition-all ${myMon.hp / myMon.maxHp > 0.5 ? 'bg-green-500' : myMon.hp / myMon.maxHp > 0.2 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${(myMon.hp / myMon.maxHp) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{myMon.hp}/{myMon.maxHp}</p>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <p className="font-semibold text-right">{myMon.name}</p>
                <p className="text-xs text-gray-500 text-right">Lv. {myMon.level}</p>
              </div>
              <div className="text-5xl">{myMon.emoji}</div>
            </div>
          </div>
        </div>

        {/* Squad switch */}
        <div className="flex gap-2 mb-4">
          {mySquad.map((m, i) => (
            <button
              key={i}
              onClick={() => !m.isFainted && i !== myActive && setMyActive(i)}
              disabled={m.isFainted || i === myActive}
              className={`flex-1 py-2 rounded-lg text-sm border transition ${
                i === myActive
                  ? 'border-solmon-primary bg-solmon-primary/20'
                  : m.isFainted
                    ? 'border-gray-800 opacity-40 cursor-not-allowed'
                    : 'border-gray-700 hover:border-solmon-primary'
              }`}
            >
              {m.emoji} {m.name}
              {m.isFainted && ' 💀'}
            </button>
          ))}
        </div>

        {/* Move selection */}
        <div className="bg-solmon-light/30 rounded-xl p-4 border border-gray-800">
          <p className="text-sm text-gray-400 mb-3">Select move + target:</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {myMon.moves.map((move, i) => (
              <button
                key={i}
                onClick={() => setSelectedMove(i)}
                className={`p-3 rounded-lg border text-left transition ${
                  selectedMove === i
                    ? 'border-solmon-secondary bg-solmon-secondary/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <span className="text-sm">{move.emoji} {move.name}</span>
                <span className="text-xs text-gray-500 ml-2">P:{move.power}</span>
              </button>
            ))}
          </div>

          {/* Target selection */}
          <p className="text-sm text-gray-400 mb-2">Target:</p>
          <div className="flex gap-2 mb-4">
            {enemySquad.map((m, i) => (
              <button
                key={i}
                onClick={() => !m.isFainted && setSelectedTarget(i)}
                disabled={m.isFainted}
                className={`flex-1 py-2 rounded-lg text-sm border transition ${
                  selectedTarget === i
                    ? 'border-red-500 bg-red-500/10'
                    : m.isFainted
                      ? 'border-gray-800 opacity-40 cursor-not-allowed'
                      : 'border-gray-700 hover:border-red-500'
                }`}
              >
                {m.emoji} {m.name}
                {m.isFainted && ' 💀'}
              </button>
            ))}
          </div>

          <button
            onClick={handleCommitMove}
            disabled={selectedMove === null || selectedTarget === null || commitPhase !== 'select'}
            className="w-full py-3 bg-solmon-primary rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-solmon-primary/80 transition"
          >
            {commitPhase === 'committing' ? '⏳ Committing...' : commitPhase === 'waiting' ? '⏳ Waiting for opponent...' : '⚔️ Commit Move'}
          </button>
        </div>

        {/* Turn log */}
        {turnLog.length > 0 && (
          <div className="mt-4 bg-solmon-dark/50 rounded-xl p-4 border border-gray-800 max-h-40 overflow-y-auto">
            <p className="text-xs text-gray-500 mb-2">Battle Log</p>
            {turnLog.map((entry, i) => (
              <div key={i} className="text-xs text-gray-400 mb-1">
                <span className="text-gray-600">[T{entry.turn}]</span>{' '}
                <span className="text-solmon-secondary">{entry.p1Action}</span> ({entry.p1Damage} dmg) •{' '}
                <span className="text-red-400">{entry.p2Action}</span> ({entry.p2Damage} dmg)
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Finished ─────────────────────────────────────────────

  const allEnemyFainted = enemySquad.every((m) => m.isFainted);
  const iWon = allEnemyFainted;

  return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <div className="text-6xl mb-4">{iWon ? '🏆' : '💀'}</div>
      <h1 className={`font-pixel text-2xl mb-2 ${iWon ? 'text-solmon-secondary' : 'text-red-400'}`}>
        {iWon ? 'Victory!' : 'Defeat!'}
      </h1>
      <p className="text-gray-400 mb-6">
        {iWon ? `You won ${wager > 0 ? `${wager * 2 * 0.95} SOL` : 'the battle'}!` : 'Better luck next time!'}
      </p>

      {/* Final log */}
      <div className="bg-solmon-dark/50 rounded-xl p-4 border border-gray-800 text-left max-w-md mx-auto mb-6">
        <p className="text-sm text-gray-400 mb-2">Final Battle Log</p>
        {turnLog.map((entry, i) => (
          <div key={i} className="text-xs text-gray-400 mb-1">
            <span className="text-gray-600">[T{entry.turn}]</span> {entry.p1Action} • {entry.p2Action}
          </div>
        ))}
      </div>

      <div className="flex gap-4 justify-center">
        <button onClick={() => { setPhase('lobby'); setTurnLog([]); setMySquad(mySquad.map(m => ({ ...m, hp: m.maxHp, isFainted: false }))); setEnemySquad(enemySquad.map(m => ({ ...m, hp: m.maxHp, isFainted: false }))); }} className="px-6 py-3 bg-solmon-primary rounded-lg font-semibold hover:bg-solmon-primary/80 transition">
          Battle Again
        </button>
        <a href="/dashboard" className="px-6 py-3 border border-gray-600 rounded-lg hover:bg-gray-800 transition">
          View Collection
        </a>
      </div>
    </div>
  );
}
