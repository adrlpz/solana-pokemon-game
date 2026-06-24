#!/usr/bin/env npx ts-node

/**
 * SOLMON SVG Placeholder Sprite Generator
 * Generates colored SVG silhouettes for all 12 starter species.
 * Usage: npx ts-node art/generate-sprites.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface SpriteConfig {
  name: string;
  element: number;
  bodyColor: string;
  accentColor: string;
  eyeColor: string;
  shape: 'quadruped' | 'biped' | 'serpentine' | 'avian';
}

const ELEMENT_COLORS: Record<number, { body: string; accent: string; eye: string }> = {
  0: { body: '#F08030', accent: '#FFD700', eye: '#FF4500' },   // Fire
  1: { body: '#6890F0', accent: '#87CEEB', eye: '#1E90FF' },   // Water
  2: { body: '#8B6914', accent: '#DAA520', eye: '#556B2F' },   // Earth
  3: { body: '#F8D030', accent: '#FFFACD', eye: '#FF6347' },   // Electric
  4: { body: '#705848', accent: '#2F1B14', eye: '#8B0000' },   // Shadow
  5: { body: '#FFFACD', accent: '#FFD700', eye: '#4169E1' },   // Light
};

const STARTERS: SpriteConfig[] = [
  { name: 'Emberpup',    element: 0, ...ELEMENT_COLORS[0], shape: 'quadruped' },
  { name: 'Cinderscale', element: 0, ...ELEMENT_COLORS[0], shape: 'serpentine' },
  { name: 'Tidefin',     element: 1, ...ELEMENT_COLORS[1], shape: 'biped' },
  { name: 'Dewdrop',     element: 1, ...ELEMENT_COLORS[1], shape: 'quadruped' },
  { name: 'Pebblit',     element: 2, ...ELEMENT_COLORS[2], shape: 'biped' },
  { name: 'Rootsprout',  element: 2, ...ELEMENT_COLORS[2], shape: 'serpentine' },
  { name: 'Sparkit',     element: 3, ...ELEMENT_COLORS[3], shape: 'quadruped' },
  { name: 'Zapbug',      element: 3, ...ELEMENT_COLORS[3], shape: 'avian' },
  { name: 'Gloomkit',    element: 4, ...ELEMENT_COLORS[4], shape: 'quadruped' },
  { name: 'Duskling',    element: 4, ...ELEMENT_COLORS[4], shape: 'biped' },
  { name: 'Gleamlet',    element: 5, ...ELEMENT_COLORS[5], shape: 'biped' },
  { name: 'Lumispark',   element: 5, ...ELEMENT_COLORS[5], shape: 'avian' },
];

const ELEMENT_EMOJI = ['🔥', '💧', '🌍', '⚡', '🌑', '💡'];

function generateSVG(config: SpriteConfig): string {
  const { bodyColor, accentColor, eyeColor, shape, name, element } = config;
  const emoji = ELEMENT_EMOJI[element];

  let body = '';
  switch (shape) {
    case 'quadruped':
      body = `
        <ellipse cx="64" cy="70" rx="28" ry="20" fill="${bodyColor}" />
        <circle cx="64" cy="42" r="18" fill="${bodyColor}" />
        <circle cx="56" cy="38" r="4" fill="white" />
        <circle cx="72" cy="38" r="4" fill="white" />
        <circle cx="57" cy="39" r="2" fill="${eyeColor}" />
        <circle cx="73" cy="39" r="2" fill="${eyeColor}" />
        <rect x="42" y="82" width="6" height="12" rx="3" fill="${accentColor}" />
        <rect x="56" y="82" width="6" height="12" rx="3" fill="${accentColor}" />
        <rect x="70" y="82" width="6" height="12" rx="3" fill="${accentColor}" />
        <rect x="80" y="82" width="6" height="12" rx="3" fill="${accentColor}" />
        <ellipse cx="90" cy="65" rx="8" ry="4" fill="${accentColor}" />`;
      break;
    case 'biped':
      body = `
        <ellipse cx="64" cy="68" rx="20" ry="24" fill="${bodyColor}" />
        <circle cx="64" cy="38" r="16" fill="${bodyColor}" />
        <circle cx="57" cy="34" r="4" fill="white" />
        <circle cx="71" cy="34" r="4" fill="white" />
        <circle cx="58" cy="35" r="2" fill="${eyeColor}" />
        <circle cx="72" cy="35" r="2" fill="${eyeColor}" />
        <rect x="50" y="88" width="8" height="14" rx="4" fill="${accentColor}" />
        <rect x="70" y="88" width="8" height="14" rx="4" fill="${accentColor}" />
        <ellipse cx="38" cy="60" rx="6" ry="10" fill="${bodyColor}" transform="rotate(-15,38,60)" />
        <ellipse cx="90" cy="60" rx="6" ry="10" fill="${bodyColor}" transform="rotate(15,90,60)" />`;
      break;
    case 'serpentine':
      body = `
        <path d="M30 75 Q50 50 64 55 Q78 60 90 45 Q98 38 98 30" fill="none" stroke="${bodyColor}" stroke-width="14" stroke-linecap="round" />
        <circle cx="98" cy="28" r="12" fill="${bodyColor}" />
        <circle cx="93" cy="24" r="3" fill="white" />
        <circle cx="103" cy="24" r="3" fill="white" />
        <circle cx="94" cy="25" r="1.5" fill="${eyeColor}" />
        <circle cx="104" cy="25" r="1.5" fill="${eyeColor}" />
        <path d="M30 75 Q28 80 24 82" fill="none" stroke="${accentColor}" stroke-width="4" stroke-linecap="round" />`;
      break;
    case 'avian':
      body = `
        <ellipse cx="64" cy="55" rx="18" ry="16" fill="${bodyColor}" />
        <circle cx="64" cy="36" r="14" fill="${bodyColor}" />
        <circle cx="58" cy="32" r="3.5" fill="white" />
        <circle cx="70" cy="32" r="3.5" fill="white" />
        <circle cx="59" cy="33" r="2" fill="${eyeColor}" />
        <circle cx="71" cy="33" r="2" fill="${eyeColor}" />
        <polygon points="64,42 60,48 68,48" fill="${accentColor}" />
        <path d="M46 55 Q30 40 20 50" fill="none" stroke="${accentColor}" stroke-width="6" stroke-linecap="round" />
        <path d="M82 55 Q98 40 108 50" fill="none" stroke="${accentColor}" stroke-width="6" stroke-linecap="round" />
        <rect x="56" y="68" width="4" height="10" rx="2" fill="${accentColor}" />
        <rect x="68" y="68" width="4" height="10" rx="2" fill="${accentColor}" />`;
      break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" fill="#0F0F23" rx="16" />
  <text x="64" y="16" text-anchor="middle" fill="white" font-size="10" font-family="monospace">${emoji} ${name}</text>
  ${body}
  <circle cx="58" cy="34" r="1" fill="white" opacity="0.8" />
  <circle cx="70" cy="34" r="1" fill="white" opacity="0.8" />
</svg>`;
}

// ─── Main ───────────────────────────────────────────────────

const outDir = path.join(__dirname, '..', 'art', 'sprites');
fs.mkdirSync(outDir, { recursive: true });

for (const starter of STARTERS) {
  const svg = generateSVG(starter);
  const filename = `${starter.name.toLowerCase()}.svg`;
  fs.writeFileSync(path.join(outDir, filename), svg);
  console.log(`✅ ${filename}`);
}

console.log(`\n🎨 Generated ${STARTERS.length} placeholder sprites in art/sprites/`);
