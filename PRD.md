# PRD — Solana Monster Battle (SOLMON)

**Web3 Pokémon-inspired on-chain game on Solana**
Version: 1.0 | Date: 2026-06-24

---

## 1. Executive Summary

SOLMON is a turn-based monster battling game built on Solana, combining Pokémon-style gameplay with on-chain ownership, breeding, and marketplace mechanics. Players collect, train, breed, and battle 256 unique monster species across 6 elemental types.

**Key differentiators:**
- Fully on-chain game state via Anchor programs
- Commit-reveal battle system for provable fairness
- Dual token economy ($SOLMON governance + $SOLTREAT utility)
- Fast/cheap transactions leveraging Solana's throughput
- Mobile-first with wallet adapter (Phantom, Solflare)

**Target market:** Web3 gamers, Pokémon fans, Solana ecosystem users (~2M daily active wallets)

---

## 2. Game Design

### 2.1 Element System (6 Types)

| Element | Strength | Weakness | Theme |
|---------|----------|----------|-------|
| 🔥 Fire | Earth | Water | Aggressive, DoT damage |
| 💧 Water | Fire | Electric | Defensive, healing |
| 🌍 Earth | Electric | Fire | Tanky, shields |
| ⚡ Electric | Water | Earth | Fast, stun chance |
| 🌑 Shadow | Light | Light | Crit damage, lifesteal |
| 💡 Light | Shadow | Shadow | Buff/debuff, utility |

Type effectiveness: 1.5x damage multiplier (not 2x — keeps battles closer).

### 2.2 Monster Species (256 Total)

- **12 Starter species** — 2 per element, chosen at game start
- **244 Wild species** — discoverable in exploration zones
- Each species has: base stats (HP/ATK/DEF/SPD), element, ability, rarity (Common/Uncommon/Rare/Legendary/Mythic)
- **Rarity distribution:** Common 100 / Uncommon 80 / Rare 50 / Legendary 20 / Mythic 6

### 2.3 Stats & Growth

```
Base Stats (level 1) + IVs (0-31 random) + EVs (earned from battles)
Stat formula: ((2*Base + IV + EV/4) * Level / 100) + 5
HP formula:   ((2*Base + IV + EV/4) * Level / 100) + Level + 10
```

- Max level: 100
- EVs: max 510 total, 252 per stat
- IVs: immutable, set at mint/catch

### 2.4 Turn-Based 3v3 Battle System

- Player selects 3 monsters for battle squad
- Each turn: select move (4 moves per monster)
- Speed determines turn order (ties broken by random)
- Commit-reveal for move selection (prevents cheating)

**Battle flow:**
```
1. Both players commit hashed moves (SHA256(move + salt))
2. Both players reveal moves + salt
3. On-chain verification: hash matches commitment
4. Execute moves in speed order
5. Check faint/switch conditions
6. Repeat until one side has 0 monsters
```

**Win conditions:**
- Opponent's 3 monsters all faint
- Opponent disconnects (timeout = 60s per turn, 3 timeouts = forfeit)

### 2.5 Breeding System

- 2 monsters → 1 egg (cooldown: 24 hours per monster)
- Offspring inherits: species from mother (80%) or father (20%)
- IVs: average of parents + random mutation (±3)
- 5% chance of rare ability inheritance
- Egg hatches after 10 battles or 24 hours
- Breeding costs $SOLTREAT tokens

### 2.6 Evolution System

- Monsters evolve at level thresholds (30, 60)
- Evolution increases base stats by 30-50%
- Some species have branching evolutions (element-based)
- Evolution requires evolution stones (earned from battles or bought with $SOLTREAT)

---

## 3. Tokenomics

### 3.1 $SOLMON (Governance Token)

- **Supply:** 1,000,000,000 fixed
- **Utility:** Governance voting, staking rewards, tournament entry, marketplace fees
- **Distribution:**
  - 40% — Play-to-earn rewards (vested over 3 years)
  - 20% — Team (12-month cliff, 24-month vest)
  - 15% — Ecosystem fund
  - 10% — Initial liquidity
  - 10% — Investors (6-month cliff, 18-month vest)
  - 5% — Airdrop

### 3.2 $SOLTREAT (Utility Token)

- **Supply:** Uncapped (inflationary, controlled burn)
- **Earned:** Battle victories, daily quests, breeding
- **Burned:** Evolution stones, breeding fees, cosmetics, marketplace listings
- **Burn rate:** ~60% of all $SOLTREAT spent is burned
- **Faucet rate:** Decreases over time (halving every 6 months)

### 3.3 NFT Assets

| Asset | Type | Supply | Notes |
|-------|------|--------|-------|
| Monsters | SPL NFT | Dynamic (minted on catch/breed) | Metadata: species, IVs, level, moves |
| Items | SPL Token | Various | Evolution stones, potions, cosmetics |
| Land | SPL NFT | 10,000 plots | Future: player-owned gyms/stadiums |

---

## 4. Technical Architecture

### 4.1 Anchor Programs (4 Programs)

#### Program 1: Creature Program
```
Accounts:
- MonsterAccount (PDA per monster): owner, species_id, level, xp, ivs[6], evs[6], moves[4], ability, rarity
- PlayerProfile (PDA per wallet): monsters[], battle_record, achievements
- SpeciesRegistry (global): species_data[256]

Instructions:
- initialize_player
- catch_monster (wild encounter → mint NFT)
- level_up (gain XP from battle)
- evolve_monster
- teach_move
```

#### Program 2: Battle Program
```
Accounts:
- BattleSession (PDA per battle): player1, player2, state, turns[], wager
- BattleQueue (global): waiting_players[]

Instructions:
- create_battle (set wager in $SOLMON)
- join_battle
- commit_move (hash of move + salt)
- reveal_move (move + salt, verified against hash)
- execute_turn (on-chain resolution)
- claim_winnings
- timeout_opponent
```

#### Program 3: Token Program (SPL)
```
- $SOLMON mint (fixed supply)
- $SOLTREAT mint (controlled inflation)
- Reward distribution logic
- Staking vault
```

#### Program 4: Marketplace Program
```
Accounts:
- Listing (PDA per listing): seller, monster/item, price, currency

Instructions:
- list_monster
- list_item
- buy_monster
- buy_item
- cancel_listing
- make_offer
- accept_offer
```

### 4.2 Off-Chain Components

```
solana-pokemon-game/
├── programs/
│   ├── creature/      # Anchor program 1
│   ├── battle/        # Anchor program 2
│   ├── token/         # Anchor program 3
│   └── marketplace/   # Anchor program 4
├── app/               # Next.js frontend
│   ├── components/
│   ├── hooks/
│   ├── pages/
│   └── lib/
├── api/               # Express API server
│   ├── routes/
│   ├── services/
│   └── workers/
├── sdk/               # TypeScript client SDK
├── tests/             # Anchor tests
└── scripts/           # Deployment & migration
```

### 4.3 Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart contracts | Anchor 0.30+ / Rust |
| Frontend | Next.js 14 + TailwindCSS + Phaser.js (battle renderer) |
| Wallet | Solana Wallet Adapter (Phantom, Solflare, Backpack) |
| API | Express.js + Redis (caching/queue) |
| DB | PostgreSQL (off-chain game data, leaderboards) |
| Indexing | Helius webhooks + custom indexer |
| Storage | Arweave (monster art, metadata) |
| CI/CD | GitHub Actions + Anchor verify |

---

## 5. Game Loop

```
1. CONNECT WALLET → create PlayerProfile on-chain
2. CHOOSE STARTER → pick 1 of 6 starters (free, one-time)
3. EXPLORE → encounter wild monsters (RNG based on zone)
4. BATTLE → turn-based 3v3 (PvP or PvE wild encounters)
5. EARN → win $SOLTREAT + XP
6. BREED → combine monsters for new offspring
7. EVOLVE → level up + evolution stones
8. TRADE → buy/sell on marketplace
9. COMPETE → tournaments for $SOLMON prizes
```

---

## 6. Game Zones (PvE Exploration)

| Zone | Level Range | Elements | Unlock |
|------|------------|----------|--------|
| Verdant Meadow | 1-15 | Earth, Water | Free |
| Volcanic Ridge | 15-30 | Fire, Earth | Level 15 |
| Storm Peaks | 30-45 | Electric, Water | Level 30 |
| Abyssal Depths | 45-60 | Water, Shadow | Level 45 |
| Radiant Temple | 60-75 | Light, Fire | Level 60 |
| Shadow Realm | 75-90 | Shadow, Electric | Level 75 |
| Prismatic Nexus | 90-100 | All elements | Level 90 |

Each zone has unique wild monsters, rare encounters, and zone bosses.

---

## 7. PvP System

### 7.1 Ranked Battles
- ELO-based matchmaking (starting ELO: 1000)
- Win: +25 ELO, Lose: -15 ELO
- Season resets every 30 days
- Top 100 players earn $SOLMON rewards

### 7.2 Tournaments
- Weekly: 16-player brackets, entry fee 100 $SOLMON, winner takes 80%
- Monthly: 64-player, free entry, prize pool from ecosystem fund
- Special events with unique rules (mono-element, level caps, etc.)

### 7.3 Wager Battles
- Players set custom $SOLMON wagers
- Smart contract holds escrow
- Winner takes 95% (5% fee to treasury)

---

## 8. Roadmap

### Phase 1 — Foundation (Months 1-3)
- [ ] Core Anchor programs (Creature + Battle)
- [ ] 50 monster species art + metadata
- [ ] Basic PvE battle loop
- [ ] Wallet integration + PlayerProfile
- [ ] Devnet alpha

### Phase 2 — Economy (Months 4-6)
- [ ] $SOLMON + $SOLTREAT token launch
- [ ] Breeding system
- [ ] Marketplace MVP
- [ ] 128 species
- [ ] Testnet beta

### Phase 3 — Competition (Months 7-9)
- [ ] PvP ranked battles
- [ ] Tournament system
- [ ] All 256 species
- [ ] Mobile optimization
- [ ] Mainnet launch

### Phase 4 — Expansion (Months 10-12)
- [ ] Land system (player-owned gyms)
- [ ] Guild/clan system
- [ ] Cross-chain bridge (EVM ↔ Solana)
- [ ] Esports integration
- [ ] Season 1 content

---

## 9. Team & Resources

| Role | Count | Focus |
|------|-------|-------|
| Rust/Anchor dev | 2 | Smart contracts |
| Frontend dev | 2 | Next.js + Phaser |
| Game designer | 1 | Balance, mechanics |
| Artist | 2 | Monster sprites, UI |
| Community | 1 | Discord, Twitter |
| PM | 1 | Coordination |

**Estimated budget:** $150K for Phase 1-2 (6 months)

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Solana congestion | High | Priority fees, retry logic, offline signing |
| Bot farming | Medium | Captcha for PvE, stake requirements for PvP |
| Smart contract exploit | Critical | Audit before mainnet, bug bounty program |
| Art bottleneck | Medium | AI-assisted generation + human polish |
| Low retention | High | Daily quests, seasonal content, social features |

---

## 11. Success Metrics

| Metric | Target (6 months post-launch) |
|--------|------------------------------|
| DAU | 10,000 |
| Monsters minted | 500,000 |
| Battles/day | 50,000 |
| Marketplace volume | $2M/month |
| $SOLMON holders | 25,000 |
| Discord members | 50,000 |

---

*Document generated by SUPERAGENT — Solana Monster Battle (SOLMON) PRD v1.0*
