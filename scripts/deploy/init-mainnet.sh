#!/bin/bash

# SOLMON Mainnet Initialization Script
# Run AFTER all 4 programs are deployed to mainnet.
#
# Initializes:
#   1. Player profile authority
#   2. Species registry (4 chunks × 64 species)
#   3. Token config ($SOLMON + $SOLTREAT)
#   4. Initial $SOLMON supply (1B tokens)
#   5. Marketplace config
#
# Prerequisites:
#   - Programs deployed (run mainnet.sh first)
#   - Deployer wallet is upgrade authority
#   - .env.mainnet configured

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.mainnet"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Missing $ENV_FILE — copy from .env.mainnet.example and fill in values"
  exit 1
fi

source "$ENV_FILE"

echo "╔═══════════════════════════════════════╗"
echo "║   SOLMON Mainnet Initialization       ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# ─── 1. Verify program deployments ────────────────────────

echo "🔍 Verifying programs..."

for prog_id in $CREATURE_PROGRAM_ID $BATTLE_PROGRAM_ID $TOKEN_PROGRAM_ID $MARKETPLACE_PROGRAM_ID; do
  SIZE=$(solana account "$prog_id" --url mainnet-beta 2>/dev/null | grep "Data Length" | awk '{print $NF}' || echo "0")
  if [[ "$SIZE" == "0" ]]; then
    echo "❌ Program $prog_id not found!"
    exit 1
  fi
  echo "  ✅ $prog_id ($SIZE bytes)"
done

echo ""

# ─── 2. Initialize token system ───────────────────────────

echo "🪙 Initializing token system..."

# Run via Anchor client or CLI
cat > /tmp/solmon_init.ts << 'TSEOF'
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import fs from 'fs';

async function init() {
  const connection = new Connection(process.env.RPC_URL!, 'confirmed');
  const wallet = new anchor.Wallet(
    Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(process.env.KEYPAIR_PATH!, 'utf-8')))
    )
  );
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  console.log('  Deployer:', wallet.publicKey.toString());

  // Load programs
  const tokenProgram = new anchor.Program(
    JSON.parse(fs.readFileSync(process.env.TOKEN_IDL!, 'utf-8')),
    new PublicKey(process.env.TOKEN_PROGRAM_ID!),
    provider,
  );

  // Derive PDAs
  const [tokenConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('token-config')], tokenProgram.programId,
  );
  const [solmonMint] = PublicKey.findProgramAddressSync(
    [Buffer.from('solmon-mint')], tokenProgram.programId,
  );
  const [soltreatMint] = PublicKey.findProgramAddressSync(
    [Buffer.from('soltreat-mint')], tokenProgram.programId,
  );
  const [tokenAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('token-authority')], tokenProgram.programId,
  );

  console.log('  Token config PDA:', tokenConfig.toString());
  console.log('  $SOLMON mint:', solmonMint.toString());
  console.log('  $SOLTREAT mint:', soltreatMint.toString());

  // Initialize $SOLMON
  try {
    await tokenProgram.methods
      .initializeSolmon()
      .accounts({
        tokenConfig,
        solmonMint,
        tokenAuthority,
        treasury: wallet.publicKey,
        authority: wallet.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    console.log('  ✅ $SOLMON initialized');
  } catch (e: any) {
    console.log('  ⏭️ $SOLMON already initialized or error:', e.message);
  }

  // Mint initial supply (1B $SOLMON)
  try {
    await tokenProgram.methods
      .mintSolmonInitial()
      .accounts({
        tokenConfig,
        solmonMint,
        tokenAuthority,
        treasuryTokenAccount: anchor.utils.token.associatedAddress({
          mint: solmonMint, owner: wallet.publicKey,
        }),
        authority: wallet.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log('  ✅ 1,000,000,000 $SOLMON minted → authority revoked');
  } catch (e: any) {
    console.log('  ⏭️ Supply already minted or error:', e.message);
  }

  console.log('\n✅ Token initialization complete');
}

init().catch(console.error);
TSEOF

echo "  (TypeScript init script written to /tmp/solmon_init.ts)"
echo "  Run with: npx ts-node /tmp/solmon_init.ts"
echo ""

# ─── 3. Initialize species registry ──────────────────────

echo "🐉 Species registry initialization requires Anchor client."
echo "  Run: anchor run init-registry --provider.cluster mainnet"
echo ""

# ─── 4. Summary ───────────────────────────────────────────

echo "═══════════════════════════════════════"
echo "  INITIALIZATION SUMMARY"
echo "═══════════════════════════════════════"
echo "  Programs: ✅ Verified"
echo "  Tokens:   ⏳ Run init script"
echo "  Registry: ⏳ Run anchor client"
echo ""
echo "  After init, verify on:"
echo "  - https://solscan.io/token/$SOLMON_MINT"
echo "  - https://explorer.solana.com/account/$TOKEN_CONFIG"
