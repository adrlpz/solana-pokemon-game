# 🎮 SOLMON — Solana Monster Battle

Web3 Pokémon-inspired on-chain game on Solana. Collect, breed, battle, and trade 256 unique monsters across 6 elemental types.

## Features

- 🏷️ **On-chain ownership** — Monsters as SPL NFTs with on-chain stats
- ⚔️ **Commit-reveal battles** — Provably fair 3v3 turn-based combat
- 🧬 **Breeding** — Combine monsters, inherit IVs with mutations
- 📈 **Evolution** — Level up and evolve at thresholds
- 🏪 **Marketplace** — Trade monsters and items
- 💰 **Dual tokenomics** — $SOLMON (governance) + $SOLTREAT (utility)

## Tech Stack

| Layer | Tech |
|-------|------|
| Smart Contracts | Anchor / Rust |
| Frontend | Next.js + Phaser.js |
| Wallet | Solana Wallet Adapter |
| Storage | Arweave |
| RPC | Helius |

## Quick Start

```bash
# Install dependencies
yarn install

# Build programs
anchor build

# Run tests
anchor test

# Start local validator + frontend
anchor localnet
cd app && npm run dev
```

## Project Structure

```
solana-pokemon-game/
├── programs/         # Anchor programs (4)
│   ├── creature/     # Monster management
│   ├── battle/       # Battle system (commit-reveal)
│   ├── token/        # $SOLMON + $SOLTREAT
│   └── marketplace/  # Trading
├── app/              # Next.js frontend
├── api/              # Express API
├── sdk/              # TypeScript client
├── tests/            # Integration tests
└── scripts/          # Deployment
```

## Docs

- [PRD.md](./PRD.md) — Product Requirements Document
- [PLAN.md](./PLAN.md) — Implementation Plan

## License

MIT
