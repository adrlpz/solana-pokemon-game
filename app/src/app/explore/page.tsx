'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ZONES, ELEMENT_EMOJI, Element } from '@/lib/constants';

type EncounterState = 'idle' | 'exploring' | 'found' | 'catching' | 'caught' | 'fled';

export default function Explore() {
  const { connected } = useWallet();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [encounter, setEncounter] = useState<EncounterState>('idle');
  const [foundMonster, setFoundMonster] = useState<{
    speciesId: number;
    name: string;
    element: Element;
    level: number;
    rarity: string;
  } | null>(null);

  const handleExplore = () => {
    if (!selectedZone) return;
    setEncounter('exploring');

    // Simulate encounter
    setTimeout(() => {
      const zone = ZONES.find((z) => z.id === selectedZone)!;
      const element = zone.element[Math.floor(Math.random() * zone.element.length)];
      const level = zone.levelRange[0] + Math.floor(Math.random() * (zone.levelRange[1] - zone.levelRange[0]));
      const rarityRoll = Math.random();
      const rarity = rarityRoll < 0.45 ? 'Common' : rarityRoll < 0.75 ? 'Uncommon' : rarityRoll < 0.92 ? 'Rare' : rarityRoll < 0.98 ? 'Legendary' : 'Mythic';

      setFoundMonster({
        speciesId: Math.floor(Math.random() * 256),
        name: `${element} Monster`,
        element,
        level,
        rarity,
      });
      setEncounter('found');
    }, 2000);
  };

  const handleCatch = () => {
    setEncounter('catching');
    setTimeout(() => {
      const success = Math.random() > 0.3; // 70% catch rate
      setEncounter(success ? 'caught' : 'fled');
    }, 1500);
  };

  if (!connected) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-xl text-gray-400">Connect your wallet to explore</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-pixel text-xl text-gradient mb-8">🗺️ Explore Zones</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Zone List */}
        <div className="lg:col-span-1 space-y-3">
          {ZONES.map((zone) => (
            <button
              key={zone.id}
              onClick={() => { setSelectedZone(zone.id); setEncounter('idle'); }}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selectedZone === zone.id
                  ? 'border-solmon-primary bg-solmon-primary/10'
                  : 'border-gray-800 bg-solmon-light/30 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{zone.emoji}</span>
                <div className="flex-1">
                  <p className="font-semibold">{zone.name}</p>
                  <p className="text-xs text-gray-500">Lv. {zone.levelRange[0]}-{zone.levelRange[1]}</p>
                </div>
                <div className="flex gap-1">
                  {zone.element.map((el) => (
                    <span key={el} className="text-sm">{ELEMENT_EMOJI[el]}</span>
                  ))}
                </div>
              </div>
              {zone.unlockLevel > 0 && (
                <p className="text-[10px] text-gray-600 mt-1">Requires Lv. {zone.unlockLevel}</p>
              )}
            </button>
          ))}
        </div>

        {/* Encounter Area */}
        <div className="lg:col-span-2">
          {!selectedZone ? (
            <div className="h-96 flex items-center justify-center bg-solmon-light/20 rounded-xl border border-gray-800">
              <p className="text-gray-500">Select a zone to start exploring</p>
            </div>
          ) : (
            <div className="bg-solmon-light/20 rounded-xl border border-gray-800 p-6">
              <div className="text-center">
                {encounter === 'idle' && (
                  <>
                    <div className="text-6xl mb-4">{ZONES.find((z) => z.id === selectedZone)?.emoji}</div>
                    <h2 className="text-xl font-semibold mb-2">{ZONES.find((z) => z.id === selectedZone)?.name}</h2>
                    <p className="text-gray-400 mb-6">Encounter wild monsters in this zone</p>
                    <button
                      onClick={handleExplore}
                      className="px-8 py-3 bg-solmon-primary rounded-lg font-semibold hover:bg-solmon-primary/80 transition"
                    >
                      🔍 Explore
                    </button>
                  </>
                )}

                {encounter === 'exploring' && (
                  <>
                    <div className="animate-pulse text-6xl mb-4">🌿</div>
                    <p className="text-lg text-gray-300">Searching for wild monsters...</p>
                  </>
                )}

                {encounter === 'found' && foundMonster && (
                  <>
                    <div className="text-7xl mb-4 animate-bounce">{ELEMENT_EMOJI[foundMonster.element]}</div>
                    <h2 className="text-2xl font-bold mb-1">Wild {foundMonster.name} appeared!</h2>
                    <p className="text-gray-400 mb-1">Lv. {foundMonster.level} · {foundMonster.rarity}</p>
                    <div className="flex justify-center gap-2 mb-6">
                      <button
                        onClick={handleCatch}
                        className="px-8 py-3 bg-solmon-secondary text-solmon-dark rounded-lg font-semibold hover:bg-solmon-secondary/80 transition"
                      >
                        🎯 Catch!
                      </button>
                      <button
                        onClick={() => setEncounter('idle')}
                        className="px-8 py-3 border border-gray-600 rounded-lg hover:bg-gray-800 transition"
                      >
                        🏃 Run
                      </button>
                    </div>
                  </>
                )}

                {encounter === 'catching' && (
                  <>
                    <div className="text-6xl mb-4 animate-spin">🎯</div>
                    <p className="text-lg text-gray-300">Throwing Pokéball...</p>
                  </>
                )}

                {encounter === 'caught' && foundMonster && (
                  <>
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-2xl font-bold text-solmon-secondary mb-2">Gotcha!</h2>
                    <p className="text-gray-400 mb-4">{foundMonster.name} was caught!</p>
                    <button
                      onClick={() => setEncounter('idle')}
                      className="px-6 py-2 bg-solmon-primary rounded-lg hover:bg-solmon-primary/80 transition"
                    >
                      Keep Exploring
                    </button>
                  </>
                )}

                {encounter === 'fled' && foundMonster && (
                  <>
                    <div className="text-6xl mb-4">💨</div>
                    <h2 className="text-2xl font-bold text-red-400 mb-2">Got away!</h2>
                    <p className="text-gray-400 mb-4">{foundMonster.name} fled!</p>
                    <button
                      onClick={() => setEncounter('idle')}
                      className="px-6 py-2 bg-solmon-primary rounded-lg hover:bg-solmon-primary/80 transition"
                    >
                      Try Again
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
