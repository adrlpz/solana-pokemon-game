# SOLMON Test Suite

## Structure

```
tests/
├── solmon.ts                    # Creature program tests (41 tests)
├── battle.ts                    # Battle program tests (36 tests)
├── token-marketplace.ts         # Token + marketplace tests (21 tests)
├── integration/
│   ├── lifecycle.ts             # Full cross-program lifecycle (8 tests)
│   └── security.ts              # Edge cases + attack vectors (14 tests)
└── AUDIT_CHECKLIST.md           # Security audit checklist (50+ items)

scripts/loadtest/
└── battles.ts                   # Concurrent battle load test
```

## Running Tests

```bash
# All tests (requires Solana 1.18.x + Anchor 0.30.1)
anchor test

# Individual test files
anchor test --skip-local-validator tests/solmon.ts
anchor test --skip-local-validator tests/battle.ts
anchor test --skip-local-validator tests/token-marketplace.ts

# Integration tests (after anchor test builds programs)
npx ts-node tests/integration/lifecycle.ts
npx ts-node tests/integration/security.ts

# Load test
npx ts-node scripts/loadtest/battles.ts --concurrent 50 --rounds 10
```

## Test Coverage Summary

### Creature Program (41 tests)
| Group | Tests | Coverage |
|-------|-------|----------|
| Player Profile | 3 | init, duplicate prevention, ELO |
| Species Registry | 4 | 4-chunk init, 64 species each, authority |
| Catch Monster | 5 | normal, shiny, IV validation, NFT mint, limit |
| XP & Leveling | 4 | gain XP, level calc, cap at 100 |
| EV Training | 4 | per-stat cap, total cap, multi-stat |
| Evolution | 4 | basic, level gate, final form, registry |
| Move Teaching | 3 | 4-slot system, overwrite, dedup |
| Stats Calculation | 3 | formula, IV impact, EV impact |
| Battle Results | 4 | win/loss, ELO math, K-factor |
| Limit Check | 3 | 100 monster cap, full collection |

### Battle Program (36 tests)
| Group | Tests | Coverage |
|-------|-------|----------|
| Create Battle | 3 | normal, non-zero wager, PDA uniqueness |
| Join Battle | 3 | normal, reject self-join, reject 3rd player |
| Select Squad | 3 | 3 monsters, stat snapshot, element |
| Commit-Reveal | 5 | commit, reveal, wrong hash, double commit, salt |
| Execute Turn | 4 | damage calc, faint, type effectiveness, STAB |
| Switch Monster | 3 | after faint, reject alive, reject dead |
| Timeout | 3 | timeout chain, forfeit after 3, reset on action |
| Claim Winnings | 3 | winner, reject unfinished, reject non-winner |
| Draw | 2 | mutual agree, reject unilateral |
| Simulation | 3 | full 3v3, attacker wins, defender wins |

### Token & Marketplace (21 tests)
| Group | Tests | Coverage |
|-------|-------|----------|
| Token Init | 3 | $SOLMON mint, $SOLTREAT mint, authority PDA |
| Initial Supply | 2 | mint 1B, revoke authority |
| Battle Rewards | 3 | halving, per-battle cap, inflation |
| Staking | 4 | stake, claim, unstake, cooldown |
| NFT Listing | 3 | list, cancel, price update |
| Buy NFT | 3 | purchase, fee distribution, not for sale |
| Offers | 3 | make, accept, expire |

### Integration (22 tests)
| Group | Tests | Coverage |
|-------|-------|----------|
| Full Lifecycle | 5 | catch→battle→earn→trade→evolve |
| Token Lifecycle | 3 | init→stake→unstake |
| PDA Security | 2 | duplicate prevention, deterministic derivation |
| IV Validation | 2 | min=0, max=31 reject 32 |
| EV Caps | 2 | per-stat 252, total 510 |
| Battle Security | 3 | unfinished claim, self-join, reveal-without-commit |
| Math Safety | 3 | XP overflow, damage overflow, staking bounds |
| Access Control | 3 | owner-only moves, seller-only cancel, winner-only claim |

**Total: 120+ tests across 5 test files**

## Known Issues

- `anchor test` requires Solana 1.18.x (VPS has 2.2.14 — version mismatch)
- Integration tests require built programs (`anchor build`)
- Load test requires funded wallets (devnet airdrop rate-limited)

## CI/CD

GitHub Actions runs on every push:
1. `cargo check` — Rust compilation
2. `anchor build` — Program build
3. `anchor test` — Full test suite (when Solana version fixed)
4. Frontend lint + type check
