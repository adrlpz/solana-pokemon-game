# SOLMON Mainnet Launch Runbook

## Timeline

| Day | Action | Owner |
|-----|--------|-------|
| D-14 | Final audit sign-off | Security team |
| D-7  | Deploy programs to mainnet | DevOps |
| D-7  | Initialize token + registry | DevOps |
| D-5  | Frontend mainnet config + test | Frontend |
| D-3  | Seed initial liquidity ($SOLMON/SOL pool) | Treasury |
| D-3  | Upload first 50 species metadata to Arweave | Art team |
| D-1  | Announce launch date on X/Discord | Marketing |
| D-0  | Enable battle + marketplace | DevOps |
| D+1  | Monitor + hotfix if needed | Full team |
| D+7  | First weekly recap, adjust parameters | Team |

---

## Pre-Launch Checklist

### Code Freeze (D-14)
- [ ] All 4 programs pass `anchor test`
- [ ] Security audit signed off (see tests/AUDIT_CHECKLIST.md)
- [ ] Frontend passes e2e tests on devnet
- [ ] No known critical/high bugs
- [ ] Upgrade authority transferred to multisig (Squads)

### Deploy (D-7)
- [ ] Run `scripts/deploy/mainnet.sh --program all`
- [ ] Verify all 4 program IDs on Solscan
- [ ] Update Anchor.toml with mainnet program IDs
- [ ] Update `app/src/lib/constants.ts`
- [ ] Run `scripts/deploy/init-mainnet.sh`
- [ ] Verify $SOLMON supply = 1B, mint authority = None
- [ ] Verify $SOLTREAT mint active
- [ ] Initialize all 4 species registry chunks

### Frontend (D-5)
- [ ] Set all NEXT_PUBLIC_* env vars for mainnet
- [ ] Test wallet connection on mainnet
- [ ] Test monster catch flow (1 devnet creature)
- [ ] Test battle creation + join
- [ ] Test marketplace list + buy
- [ ] Test staking stake + claim
- [ ] Verify all Arweave image links resolve
- [ ] Deploy frontend to Vercel/Cloudflare

### Liquidity (D-3)
- [ ] Create $SOLMON/SOL pool on Raydium or Orca
- [ ] Initial liquidity: 100M $SOLMON + 10 SOL
- [ ] Lock liquidity for 12 months
- [ ] Create $SOLTREAT/SOL pool (smaller)
- [ ] Verify pools on Birdeye/DexScreener

### Marketing (D-1)
- [ ] Announce on X (@SolmonGame)
- [ ] Discord server ready with channels
- [ ] Telegram group linked
- [ ] Launch blog post / thread
- [ ] Influencer posts scheduled
- [ ] Airdrop campaign for early adopters (optional)

### Launch (D-0)
- [ ] Enable battle program (remove devnet gate)
- [ ] Enable marketplace program
- [ ] Monitor RPC health (latency, error rate)
- [ ] Monitor program logs for errors
- [ ] Have hotfix deploy ready (test rollback procedure)

### Post-Launch (D+1 to D+7)
- [ ] Monitor transaction success rate
- [ ] Monitor battle completion rate
- [ ] Monitor marketplace volume
- [ ] Collect user feedback
- [ ] Fix critical bugs within 24h
- [ ] Weekly parameter adjustments (staking APY, reward rates)

---

## Emergency Procedures

### Program Bug (Critical)
1. Pause program: `solana program set-upgrade-authority <id> --new-authority <multisig>`
2. Deploy patched version
3. Migrate state if account layout changed
4. Communicate to users within 1 hour

### Token Issue
1. Freeze $SOLMON transfers if possible (requires freeze authority — we revoked it)
2. Communicate immediately
3. Deploy fix + coordinate with DEXs

### Frontend Down
1. Redirect to backup static page
2. Programs still accessible via other clients (Phantom, Solflare)
3. Fix frontend, redeploy

---

## Key Contacts

| Role | Contact |
|------|---------|
| Lead Dev | Fizz (@Fizzdn) |
| Security | [TBD] |
| Marketing | [TBD] |
| RPC Provider | [TBD — recommend Helius or Triton] |

---

## Rollback Plan

If critical issue found post-deploy:
1. Programs are upgradeable (multisig authority)
2. State accounts are compatible across minor versions
3. Frontend can disable features via feature flags
4. Emergency communication via X + Discord + Telegram
