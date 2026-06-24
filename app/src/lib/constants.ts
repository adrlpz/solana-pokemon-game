// Game constants matching on-chain programs

export const SOLMON_CLUSTER = 'devnet';
export const SOLMON_RPC = 'https://api.devnet.solana.com';

export const ELEMENTS = ['Fire', 'Water', 'Earth', 'Electric', 'Shadow', 'Light'] as const;
export type Element = (typeof ELEMENTS)[number];

export const RARITIES = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Mythic'] as const;
export type Rarity = (typeof RARITIES)[number];

export const ELEMENT_EMOJI: Record<Element, string> = {
  Fire: '🔥',
  Water: '💧',
  Earth: '🌍',
  Electric: '⚡',
  Shadow: '🌑',
  Light: '💡',
};

export const RARITY_COLORS: Record<Rarity, string> = {
  Common: 'text-gray-400',
  Uncommon: 'text-green-400',
  Rare: 'text-blue-400',
  Legendary: 'text-yellow-400',
  Mythic: 'text-purple-400',
};

// Type effectiveness chart (attacker → defender → multiplier)
export const ELEMENT_CHART: Record<Element, Record<Element, number>> = {
  Fire:    { Fire: 1.0, Water: 0.67, Earth: 1.5, Electric: 1.0, Shadow: 1.0, Light: 1.0 },
  Water:   { Fire: 1.5, Water: 1.0, Earth: 1.0, Electric: 0.67, Shadow: 1.0, Light: 1.0 },
  Earth:   { Fire: 0.67, Water: 1.0, Earth: 1.0, Electric: 1.5, Shadow: 1.0, Light: 1.0 },
  Electric: { Fire: 1.0, Water: 1.5, Earth: 0.67, Electric: 1.0, Shadow: 1.0, Light: 1.0 },
  Shadow:  { Fire: 1.0, Water: 1.0, Earth: 1.0, Electric: 1.0, Shadow: 1.0, Light: 1.5 },
  Light:   { Fire: 1.0, Water: 1.0, Earth: 1.0, Electric: 1.0, Shadow: 1.5, Light: 1.0 },
};

// Exploration zones
export interface Zone {
  id: string;
  name: string;
  element: Element[];
  levelRange: [number, number];
  unlockLevel: number;
  emoji: string;
}

export const ZONES: Zone[] = [
  { id: 'meadow', name: 'Verdant Meadow', element: ['Earth', 'Water'], levelRange: [1, 15], unlockLevel: 0, emoji: '🌿' },
  { id: 'volcano', name: 'Volcanic Ridge', element: ['Fire', 'Earth'], levelRange: [15, 30], unlockLevel: 15, emoji: '🌋' },
  { id: 'storm', name: 'Storm Peaks', element: ['Electric', 'Water'], levelRange: [30, 45], unlockLevel: 30, emoji: '⛈️' },
  { id: 'abyss', name: 'Abyssal Depths', element: ['Water', 'Shadow'], levelRange: [45, 60], unlockLevel: 45, emoji: '🌊' },
  { id: 'temple', name: 'Radiant Temple', element: ['Light', 'Fire'], levelRange: [60, 75], unlockLevel: 60, emoji: '🏛️' },
  { id: 'shadow', name: 'Shadow Realm', element: ['Shadow', 'Electric'], levelRange: [75, 90], unlockLevel: 75, emoji: '🌑' },
  { id: 'nexus', name: 'Prismatic Nexus', element: ['Fire', 'Water', 'Earth', 'Electric', 'Shadow', 'Light'], levelRange: [90, 100], unlockLevel: 90, emoji: '✨' },
];

// Monster stats interface (mirrors on-chain MonsterAccount)
export interface MonsterStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  spAtk: number;
  spDef: number;
}

export interface Monster {
  publicKey: string;
  owner: string;
  speciesId: number;
  level: number;
  xp: number;
  ivs: number[];
  evs: number[];
  moves: number[];
  isShiny: boolean;
  rarity: Rarity;
  element: Element;
}

// Damage formula (mirrors on-chain)
export function calculateDamage(
  attackerLevel: number,
  movePower: number,
  attackerAtk: number,
  defenderDef: number,
  stab: boolean,
  effectiveness: number,
  randomFactor: number = 0.925
): number {
  const base = ((2 * attackerLevel / 5 + 2) * movePower * (attackerAtk / defenderDef)) / 50 + 2;
  return Math.floor(base * (stab ? 1.5 : 1.0) * effectiveness * randomFactor);
}

// Stat calculation (mirrors on-chain)
export function calculateStat(
  baseStat: number,
  iv: number,
  ev: number,
  level: number,
  isHp: boolean
): number {
  if (isHp) {
    return Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
  }
  return Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * level) / 100) + 5;
}
