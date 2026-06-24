#!/usr/bin/env npx ts-node

/**
 * SOLMON Species Data Generator
 * Generates all 256 monster species with balanced stats, elements, and evolution lines.
 *
 * Usage: npx ts-node scripts/generate-species.ts > species-data.json
 */

// ─── Types ──────────────────────────────────────────────────

interface SpeciesData {
  id: number;
  name: string;
  base_stats: [number, number, number, number, number, number]; // HP ATK DEF SPD SpATK SpDEF
  element: number; // 0=Fire 1=Water 2=Earth 3=Electric 4=Shadow 5=Light
  rarity: number;  // 0=Common 1=Uncommon 2=Rare 3=Legendary 4=Mythic
  evolves_to: number; // species ID or 0xFFFF
  evolution_level: number; // 0 = no evolution
  base_moves: [number, number, number, number];
  ability_id: number;
}

// ─── Element Names ──────────────────────────────────────────

const ELEMENTS = ['Fire', 'Water', 'Earth', 'Electric', 'Shadow', 'Light'] as const;
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Mythic'] as const;

// ─── Moves Database (subset) ────────────────────────────────

const MOVES = {
  // Fire moves
  ember: { id: 1, power: 40, element: 0 },
  flamethrower: { id: 2, power: 90, element: 0 },
  fireBlast: { id: 3, power: 110, element: 0 },
  inferno: { id: 4, power: 100, element: 0 },
  // Water moves
  waterGun: { id: 5, power: 40, element: 1 },
  surf: { id: 6, power: 90, element: 1 },
  hydroPump: { id: 7, power: 110, element: 1 },
  aquaJet: { id: 8, power: 40, element: 1 },
  // Earth moves
  mudSlap: { id: 9, power: 40, element: 2 },
  earthquake: { id: 10, power: 100, element: 2 },
  rockSlide: { id: 11, power: 75, element: 2 },
  dig: { id: 12, power: 80, element: 2 },
  // Electric moves
  thunderShock: { id: 13, power: 40, element: 3 },
  thunderbolt: { id: 14, power: 90, element: 3 },
  thunder: { id: 15, power: 110, element: 3 },
  voltTackle: { id: 16, power: 120, element: 3 },
  // Shadow moves
  shadowBall: { id: 17, power: 80, element: 4 },
  darkPulse: { id: 18, power: 80, element: 4 },
  nightSlash: { id: 19, power: 70, element: 4 },
  shadowForce: { id: 20, power: 120, element: 4 },
  // Light moves
  dazzling: { id: 21, power: 80, element: 5 },
  solarBeam: { id: 22, power: 120, element: 5 },
  moonblast: { id: 23, power: 95, element: 5 },
  lightScreen: { id: 24, power: 0, element: 5 },
  // Normal moves
  tackle: { id: 25, power: 40, element: 0 },
  scratch: { id: 26, power: 40, element: 0 },
  quickAttack: { id: 27, power: 40, element: 0 },
  bodySlam: { id: 28, power: 85, element: 0 },
  hyperBeam: { id: 29, power: 150, element: 0 },
  bite: { id: 30, power: 60, element: 4 },
};

// ─── Species Templates ──────────────────────────────────────

/**
 * 12 Starters (2 per element) + their evolution lines (3 stages each = 36 species)
 * Total starters + evolutions: 36
 *
 * Element distribution across 256:
 * Fire: ~43 | Water: ~43 | Earth: ~43 | Electric: ~43 | Shadow: ~42 | Light: ~42
 */

const STARTER_LINES: { name: string; element: number; baseTotal: number; evolves: [number, number][] }[] = [
  // Fire starters
  { name: 'Emberpup', element: 0, baseTotal: 310, evolves: [[30, 36], [60, 72]] },   // → Blazehound → Infernowolf
  { name: 'Cinderscale', element: 0, baseTotal: 315, evolves: [[28, 52], [56, 108]] }, // → Pyrondrake → Solarwyrm

  // Water starters
  { name: 'Tidefin', element: 1, baseTotal: 308, evolves: [[30, 37], [60, 73]] },    // → Wavetail → Tsunamilord
  { name: 'Dewdrop', element: 1, baseTotal: 312, evolves: [[28, 53], [56, 109]] },   → Mistshell → Abyssguard

  // Earth starters
  { name: 'Pebblit', element: 2, baseTotal: 320, evolves: [[30, 38], [60, 74]] },    // → Boulderge → Titanstone
  { name: 'Rootsprout', element: 2, baseTotal: 305, evolves: [[28, 54], [56, 110]] }, // → Thornwood → Ancientgrove

  // Electric starters
  { name: 'Sparkit', element: 3, baseTotal: 300, evolves: [[30, 39], [60, 75]] },    // → Voltcat → Stormrider
  { name: 'Zapbug', element: 3, baseTotal: 306, evolves: [[28, 55], [56, 111]] },    // → Thunderfly → Gigawasp

  // Shadow starters
  { name: 'Gloomkit', element: 4, baseTotal: 302, evolves: [[30, 40], [60, 76]] },   // → Shadowprowl → Voidphantom
  { name: 'Duskling', element: 4, baseTotal: 308, evolves: [[28, 56], [56, 112]] },  // → Nightwraith → Eclipsoul

  // Light starters
  { name: 'Gleamlet', element: 5, baseTotal: 304, evolves: [[30, 41], [60, 77]] },   // → Radiance → Solarcheon
  { name: 'Lumispark', element: 5, baseTotal: 310, evolves: [[28, 57], [56, 113]] }, // → Brilliance → Celestight
];

function distributeStats(baseTotal: number, element: number): [number, number, number, number, number, number] {
  // Base stat distributions by element archetype
  const archetypes: Record<number, number[]> = {
    0: [0.17, 0.22, 0.16, 0.18, 0.15, 0.12], // Fire: fast + physical
    1: [0.20, 0.15, 0.18, 0.15, 0.18, 0.14], // Water: balanced + tanky
    2: [0.22, 0.18, 0.22, 0.10, 0.14, 0.14], // Earth: slow + tanky
    3: [0.16, 0.14, 0.14, 0.22, 0.20, 0.14], // Electric: fast + special
    4: [0.16, 0.14, 0.14, 0.18, 0.22, 0.16], // Shadow: special attacker
    5: [0.18, 0.14, 0.16, 0.16, 0.18, 0.18], // Light: support/balanced
  };

  const ratios = archetypes[element] || archetypes[0];
  return ratios.map(r => Math.floor(baseTotal * r)) as [number, number, number, number, number, number];
}

function getMovesForElement(element: number, stage: number): [number, number, number, number] {
  // stage 0=baby, 1=mid, 2=final
  const movePool: Record<number, number[][]> = {
    0: [[25, 1], [25, 1, 2], [2, 3, 25, 4]],          // Fire
    1: [[25, 5], [25, 5, 6], [6, 7, 25, 8]],          // Water
    2: [[26, 9], [26, 9, 11], [11, 10, 26, 12]],       // Earth
    3: [[27, 13], [27, 13, 14], [14, 15, 27, 16]],     // Electric
    4: [[30, 17], [30, 17, 18], [18, 19, 30, 20]],     // Shadow
    5: [[25, 21], [25, 21, 22], [22, 23, 25, 24]],     // Light
  };

  const moves = movePool[element]?.[stage] || [25, 26, 27, 28];
  return [moves[0] || 0, moves[1] || 0, moves[2] || 0, moves[3] || 0];
}

// ─── Generate All Species ───────────────────────────────────

function generateAllSpecies(): SpeciesData[] {
  const species: SpeciesData[] = [];
  let nextId = 0;

  // Phase 1: Starter evolution lines (12 lines × 3 stages = 36 species, IDs 0-35)
  const starterIds: { baby: number; mid: number; final: number }[] = [];

  for (let i = 0; i < STARTER_LINES.length; i++) {
    const line = STARTER_LINES[i];
    const babyId = nextId++;
    const midId = nextId++;
    const finalId = nextId++;

    starterIds.push({ baby: babyId, mid: midId, final: finalId });

    // Baby form
    const babyStats = distributeStats(line.baseTotal, line.element);
    const midStats = distributeStats(line.baseTotal + 80, line.element);
    const finalStats = distributeStats(line.baseTotal + 180, line.element);

    species.push({
      id: babyId,
      name: line.name,
      base_stats: babyStats,
      element: line.element,
      rarity: 1, // Uncommon (starters)
      evolves_to: midId,
      evolution_level: line.evolves[0][0],
      base_moves: getMovesForElement(line.element, 0),
      ability_id: line.element,
    });

    species.push({
      id: midId,
      name: `${line.name}mid`, // placeholder
      base_stats: midStats,
      element: line.element,
      rarity: 2, // Rare
      evolves_to: finalId,
      evolution_level: line.evolves[1][0],
      base_moves: getMovesForElement(line.element, 1),
      ability_id: line.element,
    });

    species.push({
      id: finalId,
      name: `${line.name}final`, // placeholder
      base_stats: finalStats,
      element: line.element,
      rarity: 3, // Legendary
      evolves_to: 0xFFFF, // no further evolution
      evolution_level: 0,
      base_moves: getMovesForElement(line.element, 2),
      ability_id: line.element,
    });
  }

  // IDs 36-199: Wild species (164 species)
  // Distribute evenly across elements, mix of rarities
  const wildCount = 164;
  const perElement = Math.floor(wildCount / 6);
  const remainder = wildCount % 6;

  for (let el = 0; el < 6; el++) {
    const count = perElement + (el < remainder ? 1 : 0);
    for (let j = 0; j < count; j++) {
      const id = nextId++;
      let rarity: number;
      let evolvesTo = 0xFFFF;
      let evoLevel = 0;
      let baseTotal: number;

      if (j < count * 0.45) {
        // Common (45%)
        rarity = 0;
        baseTotal = 280 + Math.floor(Math.random() * 40);
        if (j < count * 0.2) {
          // Some commons evolve
          evolvesTo = id + Math.floor(count * 0.3); // evolves into an uncommon
          evoLevel = 25 + Math.floor(Math.random() * 10);
        }
      } else if (j < count * 0.75) {
        // Uncommon (30%)
        rarity = 1;
        baseTotal = 340 + Math.floor(Math.random() * 40);
      } else if (j < count * 0.92) {
        // Rare (17%)
        rarity = 2;
        baseTotal = 400 + Math.floor(Math.random() * 50);
      } else if (j < count * 0.98) {
        // Legendary (6%)
        rarity = 3;
        baseTotal = 500 + Math.floor(Math.random() * 60);
      } else {
        // Mythic (2%)
        rarity = 4;
        baseTotal = 580 + Math.floor(Math.random() * 40);
      }

      const stats = distributeStats(baseTotal, el);
      const stage = rarity >= 3 ? 2 : rarity >= 1 ? 1 : 0;

      species.push({
        id,
        name: `Wild_${ELEMENTS[el]}_${j}`,
        base_stats: stats,
        element: el,
        rarity,
        evolves_to: evolvesTo,
        evolution_level: evoLevel,
        base_moves: getMovesForElement(el, stage),
        ability_id: el + (rarity > 2 ? 6 : 0), // rare+ get unique abilities
      });
    }
  }

  // IDs 200-255: Mythic & special species (56 species)
  for (let i = 0; i < 56; i++) {
    const id = nextId++;
    const el = i % 6;
    const isMythic = i < 6; // 6 mythics, 1 per element
    const isLegendary = !isMythic;

    const baseTotal = isMythic ? 620 : 520;
    const stats = distributeStats(baseTotal, el);

    species.push({
      id,
      name: isMythic ? `Mythic_${ELEMENTS[el]}` : `Legend_${ELEMENTS[el]}_${i}`,
      base_stats: stats,
      element: el,
      rarity: isMythic ? 4 : 3,
      evolves_to: 0xFFFF,
      evolution_level: 0,
      base_moves: getMovesForElement(el, 2),
      ability_id: el + 12, // special abilities
    });
  }

  return species;
}

// ─── Main ───────────────────────────────────────────────────

const allSpecies = generateAllSpecies();

console.log(`// SOLMON Species Data — ${allSpecies.length} species generated`);
console.log(`// Use with initialize_registry instruction (64 species per chunk, 4 chunks)`);
console.log();

// Output as TypeScript constant
console.log('export const SPECIES_DATA = [');
for (const s of allSpecies) {
  console.log(`  {`);
  console.log(`    base_stats: [${s.base_stats.join(', ')}],`);
  console.log(`    element: ${s.element}, // ${ELEMENTS[s.element]}`);
  console.log(`    rarity: ${s.rarity}, // ${RARITIES[s.rarity]}`);
  console.log(`    evolves_to: ${s.evolves_to === 0xFFFF ? '0xFFFF' : s.evolves_to},`);
  console.log(`    evolution_level: ${s.evolution_level},`);
  console.log(`    base_moves: [${s.base_moves.join(', ')}],`);
  console.log(`    ability_id: ${s.ability_id},`);
  console.log(`  }, // #${s.id} ${s.name}`);
}
console.log('];');

// Summary
console.log();
console.log('// Summary:');
console.log(`// Total species: ${allSpecies.length}`);
console.log(`// Starters + evolutions: 36`);
console.log(`// Wild species: 164`);
console.log(`// Mythic/Legend specials: 56`);
console.log(`// Elements: ${ELEMENTS.join(', ')}`);
