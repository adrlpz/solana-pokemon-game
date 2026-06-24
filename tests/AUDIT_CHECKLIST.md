# SOLMON Security Audit Checklist

## Pre-Mainnet Audit Requirements

All items must pass before mainnet deployment.

---

## 1. Smart Contract Security

### 1.1 Reentrancy
- [ ] No CPI calls before state mutations
- [ ] Battle state updated before any SOL transfers
- [ ] Marketplace listing marked inactive before NFT transfer
- [ ] Token burns happen before reward distribution

### 1.2 PDA Ownership
- [ ] Every `monster_account` PDA verified against `player_profile`
- [ ] `battle_session` PDA seeds include player key + timestamp
- [ ] `species_registry` PDA includes chunk index (no collision)
- [ ] `stake_account` PDA includes owner key
- [ ] `listing` PDA includes asset mint (unique per asset)

### 1.3 Signer Verification
- [ ] `initialize_player` — authority is signer
- [ ] `catch_monster` — authority is signer + profile owner
- [ ] `gain_xp` / `gain_ev` — authority is monster owner
- [ ] `evolve_monster` — authority is monster owner
- [ ] `teach_move` — authority is monster owner
- [ ] `record_battle_result` — battle_authority is signer (CPI gate)
- [ ] `create_battle` — player1 is signer
- [ ] `join_battle` — player2 is signer
- [ ] `commit_move` / `reveal_move` — player is signer + battle participant
- [ ] `claim_winnings` — winner is signer
- [ ] `list_monster` — seller is signer + NFT owner
- [ ] `buy_monster` — buyer is signer
- [ ] `cancel_listing` — seller is signer
- [ ] `stake_solmon` — user is signer
- [ ] `complete_unstake` — user is signer + cooldown expired

### 1.4 Integer Safety
- [ ] XP: `checked_add` to prevent u32 overflow
- [ ] EVs: per-stat cap 252, total cap 510 enforced
- [ ] Damage: worst-case fits u16 (level 100, power 255, atk 255, def 1)
- [ ] Staking rewards: bounded by principal amount
- [ ] Marketplace fee: `price * FEE_BPS / BPS_DENOMINATOR` — no overflow
- [ ] Wager: `wager * 2` doesn't overflow u64

### 1.5 State Validation
- [ ] Battle: Waiting→SelectSquad→CommitPhase→RevealPhase→Finished
- [ ] Cannot commit twice in same turn
- [ ] Cannot reveal without commit
- [ ] Cannot claim winnings on unfinished battle
- [ ] Cannot buy inactive listing
- [ ] Cannot evolve without meeting level requirement

---

## 2. Token Security

### 2.1 $SOLMON (Fixed Supply)
- [ ] Mint authority revoked after initial supply mint
- [ ] Total supply = 1,000,000,000 × 10^9
- [ ] No way to mint additional $SOLMON

### 2.2 $SOLTREAT (Inflationary)
- [ ] Halving schedule: every 180 days
- [ ] Max halving count capped at 10
- [ ] Burn function reduces total supply
- [ ] Total minted/burned tracked in config

### 2.3 Staking
- [ ] Minimum stake: 100 $SOLMON enforced
- [ ] Unstake cooldown: 7 days enforced
- [ ] Double-claim prevention

---

## 3. Battle Security

### 3.1 Commit-Reveal
- [ ] Hash preimage includes slot+target+power+element+special+salt (38 bytes)
- [ ] Salt is 32 bytes (256-bit security)
- [ ] Cannot reveal opponent's move
- [ ] Cannot change commitment after reveal starts

### 3.2 Damage Calculation
- [ ] Type effectiveness: only valid elements (0-5)
- [ ] STAB: only when move element matches monster element
- [ ] HP cannot go below 0 (saturating_sub)
- [ ] Damage capped at u16 max

### 3.3 Win Conditions
- [ ] All 3 fainted → opponent wins
- [ ] Max turns (100) → draw
- [ ] 3 timeouts → forfeit
- [ ] Cannot claim winnings twice

### 3.4 Wager Escrow
- [ ] Both wagers transferred to battle PDA on join
- [ ] Winner gets 2× wager minus 5% fee
- [ ] Draw returns wagers to both players

---

## 4. Marketplace Security

### 4.1 NFT Escrow
- [ ] NFT transferred to PDA vault on listing
- [ ] NFT returned to seller on cancel
- [ ] NFT to buyer on purchase
- [ ] Vault closed after transfer

### 4.2 Pricing
- [ ] Price must be > 0
- [ ] Fee: `price * 500 / 10000` (5%)
- [ ] Seller receives: `price - fee`

### 4.3 Offers
- [ ] Offer SOL escrowed in offer PDA
- [ ] Offer expires after 7 days
- [ ] Cancelled offer refunds full amount

---

## 5. External Attack Vectors

- [ ] Commit-reveal prevents move sniping
- [ ] One player profile per wallet
- [ ] Monster limit per player (100)
- [ ] No external oracles (all on-chain)

---

## Audit Tooling

```bash
anchor test                           # All tests
npx ts-node tests/integration/security.ts  # Security edge cases
npx ts-node scripts/loadtest/battles.ts    # Load test
cargo audit                           # Dependency vulnerabilities
```

---

## Bug Bounty (Post-Mainnet)

| Severity | Payout | Examples |
|----------|--------|---------|
| Critical | $50,000 | Fund theft, unlimited mint, state corruption |
| High | $10,000 | Battle manipulation, escrow bypass |
| Medium | $2,500 | DoS, incorrect damage calc, stuck funds |
| Low | $500 | UI bugs, metadata issues, minor logic errors |

Platform: Immunefi
