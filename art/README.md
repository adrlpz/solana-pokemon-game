# SOLMON Art Pipeline

## Overview

Monster art flows through 4 stages: Concept → Sprite → Metadata → Arweave.

```
Concept sketch → SVG/PNG sprite sheet → Metadata JSON → Upload to Arweave → NFT minted
```

## Directory Structure

```
art/
├── sprites/           # SVG/PNG sprites (one per species)
│   ├── emberpup.svg
│   ├── blazehound.svg
│   └── ...
├── metadata/          # Generated metadata JSONs
│   ├── 0.json
│   ├── 1.json
│   └── ...
├── species-db.ts      # All 256 species data
├── generate-sprites.ts # SVG placeholder generator
└── README.md

metadata/
├── schema/
│   └── monster.schema.json  # Metaplex-compatible schema
└── examples/
    └── 0-emberpup.json      # Example metadata

scripts/
└── upload-arweave.ts  # Arweave upload tool
```

## Placeholder Sprites

Generated SVG silhouettes for development. Replace with real art before mainnet.

```bash
# Generate all 12 starter placeholder sprites
npx ts-node art/generate-sprites.ts
```

Each sprite is 128×128 SVG with:
- Dark background (#0F0F23)
- Element-colored body
- White eyes with element-colored pupils
- Species name + element emoji label

## Production Art Requirements

### Sprite Sheet Format
- **Size:** 256×256 per frame
- **Frames:** 4 per state (idle, attack, hurt, faint)
- **States:** idle, attack_front, attack_back, hurt, faint
- **Format:** PNG strip (256×1280 for 5 states × 4 frames)
- **Shiny variant:** Separate sprite sheet with alternate palette

### Naming Convention
```
{species_id}-{name}-{state}.png
0-emberpup-idle.png
0-emberpup-shiny-idle.png
```

## Metadata Standard

Metaplex-compatible JSON with SOLMON extensions:

```json
{
  "name": "Emberpup",
  "description": "...",
  "image": "https://arweave.net/...",
  "attributes": [
    { "trait_type": "Element", "value": "Fire" },
    { "trait_type": "Rarity", "value": "Uncommon" },
    { "trait_type": "Level", "value": 1, "display_type": "number" }
  ],
  "properties": {
    "species_id": 0,
    "base_stats": { "hp": 52, "atk": 68, ... },
    "moves": [25, 1, 27, 0]
  }
}
```

## Arweave Upload

```bash
# Dry run (test without paying)
npx ts-node scripts/upload-arweave.ts --dry-run

# Upload specific species
ARWEAVE_KEY=./wallet.json npx ts-node scripts/upload-arweave.ts --species-id 0

# Upload all
ARWEAVE_KEY=./wallet.json npx ts-node scripts/upload-arweave.ts
```

### Prerequisites
```bash
npm install @irys/sdk
# Fund Irys node with AR tokens
```

## Priority Order

| Phase | Species Count | IDs | Target Date |
|-------|--------------|-----|-------------|
| 1 | 50 (12 starters + 38 common) | 0-49 | Month 2 |
| 2 | 128 total | 0-127 | Month 4 |
| 3 | 256 total | 0-255 | Month 6 |

## Move Animations (Future)

40 unique move animations:
- Element-colored particle effects
- Attack trajectory based on move type
- Sound effect per move category

Tool: Phaser.js sprite animation system (frontend)
