#!/usr/bin/env npx ts-node

/**
 * SOLMON Arweave Upload Script
 * Uploads monster sprites and metadata to Arweave for permanent storage.
 *
 * Prerequisites:
 *   npm install @irys/sdk
 *   Set ARWEAVE_KEY env var to wallet JWK JSON path
 *
 * Usage:
 *   npx ts-node scripts/upload-arweave.ts [--dry-run] [--species-id 0]
 */

import * as fs from 'fs';
import * as path from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const SPECIES_FILTER = process.argv.includes('--species-id')
  ? parseInt(process.argv[process.argv.indexOf('--species-id') + 1])
  : null;

const SPRITES_DIR = path.join(__dirname, '..', 'art', 'sprites');
const METADATA_DIR = path.join(__dirname, '..', 'art', 'metadata');
const MANIFEST_PATH = path.join(__dirname, '..', 'art', 'upload-manifest.json');

interface UploadResult {
  speciesId: number;
  spriteUri: string;
  metadataUri: string;
  uploadedAt: string;
}

async function uploadFile(filePath: string, contentType: string): Promise<string> {
  if (DRY_RUN) {
    return `https://arweave.net/dry-run-${path.basename(filePath)}`;
  }

  // Real upload using Irys (formerly Bundlr)
  // const irys = new Irys({ ... });
  // const receipt = await irys.uploadFile(filePath, { tags: [{ name: 'Content-Type', value: contentType }] });
  // return `https://arweave.net/${receipt.id}`;

  throw new Error('Set ARWEAVE_KEY and install @irys/sdk for real uploads');
}

async function main() {
  console.log('📤 SOLMON Arweave Upload');
  console.log(DRY_RUN ? '  Mode: DRY RUN (no real uploads)\n' : '  Mode: LIVE\n');

  // Load species DB
  const { ALL_SPECIES } = await import('../art/species-db');

  const sprites = fs.readdirSync(SPRITES_DIR).filter((f) => f.endsWith('.svg'));
  const results: UploadResult[] = [];

  for (const spriteFile of sprites) {
    const speciesName = spriteFile.replace('.svg', '');
    const species = ALL_SPECIES.find((s) => s.name.toLowerCase() === speciesName);

    if (!species) {
      console.log(`⚠️ No species found for ${spriteFile}, skipping`);
      continue;
    }

    if (SPECIES_FILTER !== null && species.id !== SPECIES_FILTER) continue;

    console.log(`📤 Uploading ${species.name} (ID: ${species.id})...`);

    // Upload sprite
    const spritePath = path.join(SPRITES_DIR, spriteFile);
    const spriteUri = await uploadFile(spritePath, 'image/svg+xml');
    console.log(`  Sprite: ${spriteUri}`);

    // Generate and upload metadata
    const metadata = {
      name: species.name,
      description: species.description,
      image: spriteUri,
      external_url: `https://solmon.game/monster/${species.id}`,
      attributes: [
        { trait_type: 'Species ID', value: species.id },
        { trait_type: 'Element', value: ['Fire', 'Water', 'Earth', 'Electric', 'Shadow', 'Light'][species.element] },
        { trait_type: 'Rarity', value: ['Common', 'Uncommon', 'Rare', 'Legendary', 'Mythic'][species.rarity] },
      ],
      properties: {
        species_id: species.id,
        element: species.element,
        rarity: species.rarity,
      },
    };

    const metadataPath = path.join(METADATA_DIR, `${species.id}.json`);
    fs.mkdirSync(METADATA_DIR, { recursive: true });
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    const metadataUri = await uploadFile(metadataPath, 'application/json');
    console.log(`  Metadata: ${metadataUri}`);

    results.push({
      speciesId: species.id,
      spriteUri,
      metadataUri,
      uploadedAt: new Date().toISOString(),
    });
  }

  // Save manifest
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(results, null, 2));
  console.log(`\n✅ Uploaded ${results.length} species. Manifest: art/upload-manifest.json`);
}

main().catch(console.error);
