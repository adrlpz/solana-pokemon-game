'use client';

import { Element, Rarity, ELEMENT_EMOJI, RARITY_COLORS } from '@/lib/constants';
import clsx from 'clsx';

interface MonsterCardProps {
  speciesId: number;
  name: string;
  level: number;
  element: Element;
  rarity: Rarity;
  hp: number;
  maxHp: number;
  isShiny?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

export function MonsterCard({
  speciesId,
  name,
  level,
  element,
  rarity,
  hp,
  maxHp,
  isShiny = false,
  isSelected = false,
  onClick,
  compact = false,
}: MonsterCardProps) {
  const hpPercent = Math.round((hp / maxHp) * 100);
  const hpColor = hpPercent > 50 ? 'bg-green-500' : hpPercent > 20 ? 'bg-yellow-500' : 'bg-red-500';

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={clsx(
          'bg-solmon-light/30 rounded-lg p-3 border cursor-pointer transition-all hover:scale-105',
          isSelected ? 'border-solmon-secondary ring-2 ring-solmon-secondary/30' : 'border-gray-800',
        )}
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl">{ELEMENT_EMOJI[element]}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{name}</p>
            <p className="text-xs text-gray-500">Lv. {level}</p>
          </div>
          {isShiny && <span className="text-xs">✨</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-solmon-light/30 rounded-xl p-4 border cursor-pointer monster-card',
        isSelected ? 'border-solmon-secondary ring-2 ring-solmon-secondary/30' : 'border-gray-800',
      )}
    >
      {/* Sprite placeholder */}
      <div className="aspect-square bg-solmon-dark/50 rounded-lg mb-3 flex items-center justify-center text-5xl relative">
        {ELEMENT_EMOJI[element]}
        {isShiny && <span className="absolute top-1 right-1 text-sm">✨</span>}
      </div>

      {/* Info */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">{name}</p>
          <span className={clsx('text-xs font-medium', RARITY_COLORS[rarity])}>{rarity}</span>
        </div>
        <p className="text-xs text-gray-500">#{speciesId} · Lv. {level}</p>

        {/* HP Bar */}
        <div className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">HP</span>
            <span>{hp}/{maxHp}</span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className={clsx('h-full rounded-full transition-all', hpColor)} style={{ width: `${hpPercent}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
