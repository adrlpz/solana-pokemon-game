/**
 * SOLMON Species Database — All 256 species names, elements, rarities
 * IDs 0-35: Starter evolution lines (12 lines × 3 stages)
 * IDs 36-199: Wild species (164)
 * IDs 200-255: Mythic & Legendary specials (56)
 */

export interface SpeciesInfo {
  id: number;
  name: string;
  element: number; // 0=Fire 1=Water 2=Earth 3=Electric 4=Shadow 5=Light
  rarity: number;  // 0=Common 1=Uncommon 2=Rare 3=Legendary 4=Mythic
  evolvesTo: number; // 0xFFFF = none
  evolutionLevel: number;
  description: string;
}

// ─── Element names ──────────────────────────────────────────
export const ELEMENTS = ['Fire', 'Water', 'Earth', 'Electric', 'Shadow', 'Light'] as const;
export const RARITIES = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Mythic'] as const;

// ─── Starter Lines (IDs 0-35) ───────────────────────────────

const STARTER_LINES: [string, string, string, number][] = [
  // [baby, mid, final, element]
  ['Emberpup',   'Blazehound',  'Infernowolf',  0], // Fire
  ['Cinderscale','Pyrondrake',   'Solarwyrm',    0], // Fire
  ['Tidefin',    'Wavetail',     'Tsunamilord',  1], // Water
  ['Dewdrop',    'Mistshell',    'Abyssguard',   1], // Water
  ['Pebblit',    'Boulderge',    'Titanstone',   2], // Earth
  ['Rootsprout', 'Thornwood',    'Ancientgrove', 2], // Earth
  ['Sparkit',    'Voltcat',      'Stormrider',   3], // Electric
  ['Zapbug',     'Thunderfly',   'Gigawasp',     3], // Electric
  ['Gloomkit',   'Shadowprowl',  'Voidphantom',  4], // Shadow
  ['Duskling',   'Nightwraith',  'Eclipsoul',    4], // Shadow
  ['Gleamlet',   'Radiance',     'Solarcheon',   5], // Light
  ['Lumispark',  'Brilliance',   'Celestight',   5], // Light
];

// ─── Wild Species Names (IDs 36-199) ───────────────────────

const WILD_NAMES: Record<number, string[]> = {
  0: [ // Fire
    'Flameling', 'Scorchpup', 'Heatbug', 'Cindermole', 'Burnipede',
    'Blazefly', 'Magmaclaw', 'Searfox', 'Pyrohopper', 'Ashwhisp',
    'Flarekit', 'Volcarion', 'Embertail', 'Torchrat', 'Smolderpaw',
    'Infernope', 'Moltenclaw', 'Flamewisp', 'Burnhound', 'Scorchaunt',
    'Heatcrest', 'Pyroscale', 'Searwing', 'Cinderbeak', 'Magmacrest',
    'Blazefang', 'Flarelion', 'Volcanpup', 'Searstag', 'Ashfang',
  ],
  1: [ // Water
    'Splashfin', 'Puddlejump', 'Wavecrab', 'Mistfox', 'Bubblebug',
    'Dewdrop', 'Rainpup', 'Tiderat', 'Currentclaw', 'Floodwing',
    'Pondskip', 'Ripplefin', 'Drizzlebird', 'Streamhopper', 'Surgeclaw',
    'Tidalfang', 'Wavecrest', 'Torrentpup', 'Coralclaw', 'Depthfox',
    'Aquadiver', 'Seawhisper', 'Brooktail', 'Lakebug', 'Raintail',
    'Splashwing', 'Tiderider', 'Currentfin', 'Floodpup', 'Mistclaw',
  ],
  2: [ // Earth
    'Dustmite', 'Rockpup', 'Sandfox', 'Boulderbug', 'Gravelrat',
    'Pebbleclaw', 'Dunehopper', 'Stonefang', 'Cragwhisp', 'Quaketail',
    'Dirtmole', 'Sandstag', 'Rockbeetle', 'Gravelwing', 'Bouldercrest',
    'Earthenpup', 'Dustdevil', 'Sandswirl', 'Stonecrest', 'Cragclaw',
    'Quakefox', 'Dirtfang', 'Pebbletail', 'Rockhopper', 'Sandbug',
    'Boulderrat', 'Gravelmole', 'Stonetail', 'Cragpup', 'Dustfox',
  ],
  3: [ // Electric
    'Zapmite', 'Sparkrat', 'Boltbug', 'Staticpup', 'Voltfox',
    'Thundermite', 'Shockclaw', 'Currentwhisp', 'Sparkwing', 'Boltfang',
    'Zaprat', 'Staticbug', 'Volthopper', 'Thunderfox', 'Shocktail',
    'Currentpup', 'Sparkclaw', 'Boltwhisp', 'Zapwing', 'Staticfang',
    'Voltcrest', 'Thunderbug', 'Shockrat', 'Currentclaw', 'Sparkpup',
    'Bolthopper', 'Zapfox', 'Staticwing', 'Volttail', 'Thunderclaw',
  ],
  4: [ // Shadow
    'Shadepup', 'Duskfox', 'Nightbug', 'Gloomrat', 'Voidmite',
    'Ecliptail', 'Darkclaw', 'Shadehopper', 'Duskwing', 'Nightfang',
    'Gloomwhisp', 'Voidcrest', 'Eclipsepup', 'Darkfox', 'Shadebug',
    'Duskrat', 'Nightclaw', 'Gloomhopper', 'Voidtail', 'Eclipsewing',
    'Darkpup', 'Shadefox', 'Duskbug', 'Nightrat', 'Gloomclaw',
    'Voidhopper', 'Eclipsetail', 'Darkwing', 'Shadefang', 'Duskcrest',
  ],
  5: [ // Light
    'Glowpup', 'Shinefox', 'Beambug', 'Gleamrat', 'Prismmite',
    'Luxtail', 'Lightclaw', 'Glowhopper', 'Shinewing', 'Beamfang',
    'Gleamwhisp', 'Prismcrest', 'Luxpup', 'Lightfox', 'Glowbug',
    'Shinerat', 'Beamclaw', 'Gleamhopper', 'Prismtail', 'Luxwing',
    'Lightpup', 'Glowfox', 'Shinebug', 'Beamrat', 'Gleamclaw',
    'Prismhopper', 'Luxtail2', 'Lightwing', 'Glowfang', 'Shinecrest',
  ],
};

// ─── Mythic & Legendary Names (IDs 200-255) ────────────────

const SPECIAL_NAMES: [string, number, number][] = [
  // [name, element, rarity] — rarity 3=Legendary, 4=Mythic
  // Mythics (1 per element, IDs 200-205)
  ['Solarflare',    0, 4], // Fire mythic
  ['Leviathan',     1, 4], // Water mythic
  ['GolemPrime',    2, 4], // Earth mythic
  ['Thundergod',    3, 4], // Electric mythic
  ['VoidEmperor',   4, 4], // Shadow mythic
  ['CelestialArch', 5, 4], // Light mythic

  // Legendaries (IDs 206-255, 50 total)
  ['InfernoKing',   0, 3], ['PyroLord',      0, 3], ['BlazeEmperor',  0, 3], ['MagmaTyrant',   0, 3], ['FlareGod',      0, 3],
  ['TsunamiLord',   1, 3], ['OceanEmperor',   1, 3], ['AbyssKing',     1, 3], ['TidalTyrant',   1, 3], ['WaveGod',       1, 3],
  ['EarthTitan',    2, 3], ['QuakeLord',      2, 3], ['StoneEmperor',  2, 3], ['BoulderTyrant', 2, 3], ['GaiaGod',       2, 3],
  ['StormLord',     3, 3], ['VoltEmperor',    3, 3], ['ThunderTyrant', 3, 3], ['PlasmaGod',     3, 3], ['SparkKing',     3, 3],
  ['NightLord',     4, 3], ['ShadowEmperor',  4, 3], ['DarkTyrant',    4, 3], ['EclipseGod',    4, 3], ['VoidKing',      4, 3],
  ['DawnLord',      5, 3], ['LightEmperor',   5, 3], ['RadiantTyrant', 5, 3], ['HaloGod',       5, 3], ['DivineKing',    5, 3],
  ['InfernoQueen',  0, 3], ['PyroMatriarch',  0, 3], ['TsunamiQueen',  1, 3], ['OceanMatriarch',1, 3], ['EarthQueen',    2, 3],
  ['QuakeMatriarch',2, 3], ['StormQueen',     3, 3], ['VoltMatriarch', 3, 3], ['NightQueen',    4, 3], ['ShadowMatriarch',4, 3],
  ['DawnQueen',     5, 3], ['LightMatriarch', 5, 3], ['MegaFire',      0, 3], ['MegaWater',     1, 3], ['MegaEarth',     2, 3],
  ['MegaElec',      3, 3], ['MegaShadow',     4, 3], ['MegaLight',     5, 3], ['AlphaFire',     0, 3], ['OmegaWater',    1, 3],
];

// ─── Build Full Database ────────────────────────────────────

export function buildSpeciesDatabase(): SpeciesInfo[] {
  const species: SpeciesInfo[] = [];
  let id = 0;

  // Starter lines (0-35)
  for (const [baby, mid, final, element] of STARTER_LINES) {
    const evoLevel1 = 25 + Math.floor(Math.random() * 10);
    const evoLevel2 = 50 + Math.floor(Math.random() * 15);

    species.push({ id, name: baby, element, rarity: 1, evolvesTo: id + 1, evolutionLevel: evoLevel1, description: `A young ${ELEMENTS[element]}-type monster.` });
    species.push({ id: id + 1, name: mid, element, rarity: 2, evolvesTo: id + 2, evolutionLevel: evoLevel2, description: `The evolved form of ${baby}.` });
    species.push({ id: id + 2, name: final, element, rarity: 3, evolvesTo: 0xFFFF, evolutionLevel: 0, description: `The final evolution — a powerful ${ELEMENTS[element]} beast.` });
    id += 3;
  }

  // Wild species (36-199)
  for (let el = 0; el < 6; el++) {
    const names = WILD_NAMES[el] || [];
    for (let i = 0; i < names.length && id < 200; i++) {
      const rarityRoll = i / names.length;
      const rarity = rarityRoll < 0.45 ? 0 : rarityRoll < 0.75 ? 1 : rarityRoll < 0.92 ? 2 : 3;
      const evolvesTo = (rarity === 0 && i < 10) ? id + 30 : 0xFFFF; // some commons evolve
      const evoLevel = evolvesTo !== 0xFFFF ? 25 + Math.floor(Math.random() * 10) : 0;

      species.push({
        id,
        name: names[i],
        element: el,
        rarity,
        evolvesTo: evolvesTo < 200 ? evolvesTo : 0xFFFF,
        evolutionLevel: evoLevel,
        description: `A ${RARITIES[rarity].toLowerCase()} ${ELEMENTS[el]}-type wild monster.`,
      });
      id++;
    }
  }

  // Specials (200-255)
  for (const [name, element, rarity] of SPECIAL_NAMES) {
    species.push({
      id,
      name,
      element,
      rarity,
      evolvesTo: 0xFFFF,
      evolutionLevel: 0,
      description: rarity === 4
        ? `A mythical ${ELEMENTS[element]}-type creature of immense power.`
        : `A legendary ${ELEMENTS[element]}-type monster feared across the land.`,
    });
    id++;
  }

  return species;
}

// ─── Generate Metadata JSON ─────────────────────────────────

export function generateMetadata(
  species: SpeciesInfo,
  ivs: number[],
  level: number,
  isShiny: boolean,
  imageUri: string,
): object {
  return {
    name: isShiny ? `✨ ${species.name}` : species.name,
    description: species.description,
    image: imageUri,
    external_url: `https://solmon.game/monster/${species.id}`,
    attributes: [
      { trait_type: 'Species ID', value: species.id, display_type: 'number' },
      { trait_type: 'Element', value: ELEMENTS[species.element] },
      { trait_type: 'Rarity', value: RARITIES[species.rarity] },
      { trait_type: 'Level', value: level, display_type: 'number' },
      { trait_type: 'Shiny', value: isShiny ? 'Yes' : 'No' },
      { trait_type: 'HP IV', value: ivs[0], display_type: 'number' },
      { trait_type: 'ATK IV', value: ivs[1], display_type: 'number' },
      { trait_type: 'DEF IV', value: ivs[2], display_type: 'number' },
      { trait_type: 'SPD IV', value: ivs[3], display_type: 'number' },
      { trait_type: 'SpATK IV', value: ivs[4], display_type: 'number' },
      { trait_type: 'SpDEF IV', value: ivs[5], display_type: 'number' },
    ],
    properties: {
      species_id: species.id,
      element: ELEMENTS[species.element],
      rarity: RARITIES[species.rarity],
      evolution: species.evolvesTo !== 0xFFFF ? { evolves_to: species.evolvesTo, level_required: species.evolutionLevel } : null,
      base_stats: { hp: 50, atk: 50, def: 50, spd: 50, sp_atk: 50, sp_def: 50 }, // placeholder
      moves: [0, 0, 0, 0],
      ability_id: species.element,
      generation: 1,
    },
  };
}

// Export full DB
export const ALL_SPECIES = buildSpeciesDatabase();
