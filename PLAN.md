# PLAN — Solana Monster Battle (SOLMON)

**Implementation Plan & Development Roadmap**
Version: 1.0 | Date: 2026-06-24

---

## Overview

This plan breaks down the SOLMON development into executable phases with clear deliverables, dependencies, and time estimates. Each phase is self-contained and shipable.

---

## Phase 0 — Setup & Scaffolding (Week 1)

### 0.1 Project Structure
```bash
# Initialize monorepo
npx create-solana-game solana-pokemon-game --template anchor-nextjs
cd solana-pokemon-game

# Core packages
anchor init programs/creature --template multiple
anchor init programs/battle --template multiple
anchor init programs/token --template multiple
anchor init programs/marketplace --template multiple
```

### 0.2 Dependencies
```toml
# programs/Cargo.toml
[dependencies]
anchor-lang = "0.30.1"
anchor-spl = "0.30.1"
mpl-token-metadata = "4"
```

```json
// app/package.json
{
  "dependencies": {
    "next": "14.2",
    "@solana/web3.js": "^2.0",
    "@solana/wallet-adapter-react": "^0.15",
    "@coral-xyz/anchor": "^0.30",
    "phaser": "^3.80"
  }
}
```

### 0.3 Dev Environment
- [ ] Anchor.toml configured for localnet/devnet
- [ ] Docker compose (local validator + postgres + redis)
- [ ] GitHub repo + Actions CI
- [ ] Test fixtures and airdrop scripts

---

## Phase 1 — Creature Program (Weeks 2-4)

### 1.1 Data Structures

```rust
// programs/creature/src/state.rs

#[account]
pub struct PlayerProfile {
    pub authority: Pubkey,        // wallet owner
    pub monster_count: u32,       // total monsters owned
    pub battle_wins: u32,
    pub battle_losses: u32,
    pub elo: u32,                 // starting 1000
    pub achievements: Vec<u8>,    // bitmask
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct MonsterAccount {
    pub owner: Pubkey,            // PlayerProfile PDA
    pub species_id: u16,          // 0-255
    pub level: u8,                // 1-100
    pub xp: u32,
    pub ivs: [u8; 6],             // HP, ATK, DEF, SPD, SpATK, SpDEF
    pub evs: [u16; 6],
    pub moves: [u16; 4],          // move IDs
    pub ability_id: u8,
    pub rarity: u8,               // 0=Common..4=Mythic
    pub is_shiny: bool,
    pub mint: Pubkey,             // SPL token mint
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct SpeciesRegistry {
    pub species: [SpeciesData; 256],
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct SpeciesData {
    pub base_stats: [u8; 6],
    pub element: u8,              // 0-5
    pub rarity: u8,
    pub evolves_to: u16,          // species_id or 0xFFFF = none
    pub evolution_level: u8,
    pub base_moves: [u16; 4],
    pub ability_id: u8,
}
```

### 1.2 Instructions

```rust
// programs/creature/src/lib.rs

pub fn initialize_player(ctx: Context<InitializePlayer>) -> Result<()>
pub fn initialize_registry(ctx: Context<InitializeRegistry>, data: SpeciesRegistryInput) -> Result<()>
pub fn catch_monster(ctx: Context<CatchMonster>, species_id: u16, ivs: [u8; 6]) -> Result<()>
pub fn gain_xp(ctx: Context<GainXp>, amount: u32) -> Result<()>
pub fn evolve_monster(ctx: Context<EvolveMonster>) -> Result<()>
pub fn teach_move(ctx: Context<TeachMove>, slot: u8, move_id: u16) -> Result<()>
```

### 1.3 Tests
- [ ] Initialize player profile (PDA derivation)
- [ ] Catch monster (NFT mint + MonsterAccount init)
- [ ] XP gain → level up → stat recalculation
- [ ] Evolution check + transform
- [ ] Move teaching with validation
- [ ] Error cases: duplicate catch, invalid species, max monsters

**Deliverable:** Working creature program on localnet with full test coverage

---

## Phase 2 — Battle Program (Weeks 5-8)

### 2.1 Data Structures

```rust
// programs/battle/src/state.rs

#[account]
pub struct BattleSession {
    pub player1: Pubkey,
    pub player2: Pubkey,
    pub squad1: [Pubkey; 3],      // MonsterAccount PDAs
    pub squad2: [Pubkey; 3],
    pub state: BattleState,       // Waiting/Active/CommitPhase/RevealPhase/Finished
    pub current_turn: u16,
    pub wager: u64,               // lamports or $SOLMON
    pub commitment1: [u8; 32],    // SHA256(move + salt)
    pub commitment2: [u8; 32],
    pub winner: Option<Pubkey>,
    pub created_at: i64,
    pub timeout_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum BattleState {
    Waiting,       // player1 waiting for player2
    CommitPhase,   // both players commit moves
    RevealPhase,   // both players reveal moves
    Executing,     // resolving turn
    Finished,      // winner determined
    Cancelled,     // timeout/disconnect
}
```

### 2.2 Commit-Reveal Flow

```
TURN LIFECYCLE:
                                    
Player 1                    Player 2
   |                            |
   |-- commit_move(hash1) ----->|
   |<------ commit_move(hash2) -|
   |                            |  (both committed)
   |-- reveal_move(salt1) ----->|
   |<------ reveal_move(salt2) -|
   |                            |
   v          RESOLVE           v
   execute_turn() → calculate damage → update HP → check faint
```

### 2.3 Damage Formula
```
Damage = ((2*Level/5 + 2) * Power * (Atk/Def)) / 50 + 2
         * STAB (1.5 if same element)
         * TypeEffectiveness (1.5 / 0.67 / 1.0)
         * Random(0.85, 1.0)
```

### 2.4 Instructions
```rust
pub fn create_battle(ctx: Context<CreateBattle>, wager: u64) -> Result<()>
pub fn join_battle(ctx: Context<JoinBattle>) -> Result<()>
pub fn select_squad(ctx: Context<SelectSquad>, monsters: [Pubkey; 3]) -> Result<()>
pub fn commit_move(ctx: Context<CommitMove>, commitment: [u8; 32]) -> Result<()>
pub fn reveal_move(ctx: Context<RevealMove>, move_slot: u8, target: u8, salt: [u8; 32]) -> Result<()>
pub fn timeout_opponent(ctx: Context<TimeoutOpponent>) -> Result<>()
pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()>
```

### 2.5 Tests
- [ ] Full battle flow (create → join → commit → reveal → resolve → winner)
- [ ] Type effectiveness calculations
- [ ] Timeout handling (60s per turn)
- [ ] Wager escrow + payout
- [ ] Edge case: both players timeout
- [ ] Edge case: disconnect mid-battle

**Deliverable:** Two players can battle on localnet with commit-reveal fairness

---

## Phase 3 — Token & Marketplace (Weeks 9-11)

### 3.1 Token Program

```rust
// $SOLMON — fixed supply governance token
pub fn initialize_solmon(ctx: Context<InitializeSOLMON>) -> Result<()>
pub fn distribute_rewards(ctx: Context<DistributeRewards>, amount: u64) -> Result<>()
pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<>()
pub fn unstake(ctx: Context<Unstake>) -> Result<()>  // + claim rewards

// $SOLTREAT — inflationary utility token
pub fn initialize_soltreat(ctx: Context<InitializeSOLTREAT>) -> Result<>()
pub fn mint_reward(ctx: Context<MintReward>, amount: u64) -> Result<()>  // battle win
pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()>  // spend
```

### 3.2 Marketplace Program

```rust
pub fn list_monster(ctx: Context<ListMonster>, price: u64) -> Result<>()
pub fn list_item(ctx: Context<ListItem>, price: u64, amount: u64) -> Result<>()
pub fn buy_monster(ctx: Context<BuyMonster>) -> Result<>()
pub fn buy_item(ctx: Context<BuyItem>, amount: u64) -> Result<>()
pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<>()
pub fn make_offer(ctx: Context<MakeOffer>, amount: u64) -> Result<>()
pub fn accept_offer(ctx: Context<AcceptOffer>) -> Result<>()
```

**Deliverable:** Tokens minting, marketplace listing/buying on localnet

---

## Phase 4 — Frontend (Weeks 10-14)

### 4.1 Pages

```
/                    → Landing page + wallet connect
/dashboard           → Player profile, monster collection
/battle              → Battle lobby, matchmaking
/battle/[id]         → Active battle (Phaser canvas)
/marketplace         → Browse listings, filters
/breed               → Breeding interface
/explore             → Zone selection, wild encounters
/tournaments         → Tournament brackets
```

### 4.2 Key Components

```tsx
// Wallet + Profile
<WalletProvider>
  <PlayerProfile />
  <MonsterCollection />
</WalletProvider>

// Battle
<BattleCanvas />      // Phaser.js renderer
<MoveSelector />      // Commit-reveal UI
<TurnLog />           // Battle history

// Marketplace
<ListingGrid />
<MonsterCard />
<PriceChart />
```

### 4.3 Phaser.js Battle Scene
- Sprite-based monster rendering (2D)
- Attack animations per element type
- HP bar animations
- Turn result visualization
- Mobile touch controls

**Deliverable:** Playable frontend on devnet

---

## Phase 5 — Art & Content (Weeks 6-14, parallel)

### 5.1 Monster Art Pipeline
```
1. Concept sketches (AI-assisted midjourney/dalle)
2. Sprite sheet creation (front, back, attack, idle)
3. Animation (4 frames per state)
4. Metadata JSON (name, description, attributes)
5. Upload to Arweave
```

### 5.2 Priority Order
- Phase 1: 12 starters (2 per element) + 38 common = 50
- Phase 2: 78 uncommon + rare = 128 total
- Phase 3: 108 remaining + legendary/mythic = 256 total

### 5.3 Move Animations
- 40 unique moves (basic + element-specific)
- Particle effects per element
- Sound effects (royalty-free)

---

## Phase 6 — Testing & Audit (Weeks 14-16)

### 6.1 Testing Strategy

| Type | Tool | Coverage |
|------|------|----------|
| Unit tests | Anchor test / Mocha | 90%+ on programs |
| Integration | Bankrun (solana-test-validator) | Full game loops |
| Load test | Custom scripts | 100 concurrent battles |
| Security | Manual review + automated | All critical paths |

### 6.2 Audit Checklist
- [ ] Reentrancy guards on token transfers
- [ ] PDA ownership verification on all accounts
- [ ] Integer overflow/underflow protection
- [ ] Commit-reveal timing enforcement
- [ ] Escrow safety (marketplace)
- [ ] Access control (admin vs player instructions)

### 6.3 Bug Bounty
- Pre-mainnet: invite-only beta testers (500 players)
- Post-mainnet: Immunefi bounty ($5K-$50K per critical)

---

## Phase 7 — Mainnet Launch (Weeks 16-18)

### 7.1 Launch Sequence
```
1. Deploy programs to mainnet (upgrade authority = multisig)
2. Initialize species registry (256 species data)
3. Token launch ($SOLMON + $SOLTREAT)
4. Frontend deployment (Vercel + Cloudflare)
5. Initial liquidity (Raydium pool)
6. Community launch event
```

### 7.2 Infrastructure
- RPC: Helius (dedicated node)
- CDN: Cloudflare
- Monitoring: Helius webhooks + custom dashboard
- Alerts: PagerDuty for program errors

### 7.3 Launch Checklist
- [ ] All 4 programs deployed + verified
- [ ] Frontend live + wallet connect tested
- [ ] Explorer links working (Solscan)
- [ ] Discord/Twitter community ready
- [ ] Initial monster distribution (airdrop to early supporters)
- [ ] Marketplace seeded with team monsters

---

## Dependency Graph

```
Phase 0 (Setup)
    ↓
Phase 1 (Creature) ──────────────────────┐
    ↓                                     │
Phase 2 (Battle)                          │
    ↓                                     │
Phase 3 (Token + Marketplace)             │
    ↓                                     │
Phase 4 (Frontend) ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
    ↓
Phase 5 (Art) [parallel with 1-4]
    ↓
Phase 6 (Testing + Audit)
    ↓
Phase 7 (Mainnet)
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Anchor breaking changes | Pin version, test upgrades on branch |
| Art delays | AI generation pipeline, outsource overflow |
| Solana downtime | Graceful degradation, retry queues |
| Low adoption | Community building from Phase 1, airdrop strategy |

---

## Success Criteria

| Gate | Criteria |
|------|---------|
| Alpha (Phase 2) | 2 players battle, full commit-reveal, 50 species |
| Beta (Phase 4) | 100 concurrent users, marketplace active, 128 species |
| Launch (Phase 7) | 1000 DAU in first week, $100K marketplace volume |

---

*Document generated by SUPERAGENT — Solana Monster Battle (SOLMON) PLAN v1.0*
