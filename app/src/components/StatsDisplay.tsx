'use client';

import { ELEMENT_EMOJI, ELEMENT_CHART, Element } from '@/lib/constants';

interface StatsDisplayProps {
  stats: { hp: number; atk: number; def: number; spd: number; spAtk: number; spDef: number };
  ivs?: number[];
  evs?: number[];
  compact?: boolean;
}

const STAT_LABELS = ['HP', 'ATK', 'DEF', 'SPD', 'SpATK', 'SpDEF'];
const STAT_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500'];
const MAX_STAT = 255;

export function StatsDisplay({ stats, ivs, evs, compact = false }: StatsDisplayProps) {
  const values = [stats.hp, stats.atk, stats.def, stats.spd, stats.spAtk, stats.spDef];

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      {values.map((val, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className={compact ? 'text-xs w-10 text-gray-400' : 'text-xs w-12 text-gray-400 font-medium'}>
            {STAT_LABELS[i]}
          </span>
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${STAT_COLORS[i]} transition-all`}
              style={{ width: `${Math.min(100, (val / MAX_STAT) * 100)}%` }}
            />
          </div>
          <span className={compact ? 'text-xs w-8 text-right' : 'text-xs w-10 text-right font-mono'}>{val}</span>
          {ivs && <span className="text-[10px] text-gray-600 w-6">IV:{ivs[i]}</span>}
          {evs && <span className="text-[10px] text-gray-600 w-8">EV:{evs[i]}</span>}
        </div>
      ))}
    </div>
  );
}

interface ElementBadgeProps {
  element: Element;
  size?: 'sm' | 'md';
}

export function ElementBadge({ element, size = 'sm' }: ElementBadgeProps) {
  const colors: Record<Element, string> = {
    Fire: 'bg-fire/20 text-fire border-fire/40',
    Water: 'bg-water/20 text-water border-water/40',
    Earth: 'bg-earth/20 text-earth border-earth/40',
    Electric: 'bg-electric/20 text-electric border-electric/40',
    Shadow: 'bg-shadow/20 text-shadow border-shadow/40',
    Light: 'bg-light/20 text-solmon-dark border-light/40',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-md border ${colors[element]} ${size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'}`}>
      {ELEMENT_EMOJI[element]} {element}
    </span>
  );
}

interface TypeMatchupProps {
  attacker: Element;
  defender: Element;
}

export function TypeMatchup({ attacker, defender }: TypeMatchupProps) {
  const eff = ELEMENT_CHART[attacker][defender];
  const label = eff > 1 ? 'Super Effective!' : eff < 1 ? 'Not Very Effective' : 'Normal';
  const color = eff > 1 ? 'text-green-400' : eff < 1 ? 'text-red-400' : 'text-gray-400';

  return (
    <span className={`text-xs font-medium ${color}`}>
      {ELEMENT_EMOJI[attacker]} → {ELEMENT_EMOJI[defender]} {eff}x {label}
    </span>
  );
}
