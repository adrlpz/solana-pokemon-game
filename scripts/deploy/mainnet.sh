#!/bin/bash

# SOLMON Mainnet Deploy Script
# Usage: ./scripts/deploy/mainnet.sh [--program creature|battle|token|marketplace|all]
#
# Prerequisites:
#   - Solana CLI configured for mainnet (solana config set --url mainnet-beta)
#   - Deployer wallet funded with ≥10 SOL per program
#   - Programs built with `anchor build`
#   - Program keypairs in target/deploy/

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROGRAM=${1:---program}
TARGET=${2:-all}
DEPLOY_DIR="$(dirname "$0")/../../target/deploy"
LOG_DIR="$(dirname "$0")/../../deploy-logs"

mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

log() { echo -e "${GREEN}[SOLMON]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ─── Pre-flight checks ────────────────────────────────────

log "Running pre-flight checks..."

# Check Solana CLI
command -v solana >/dev/null 2>&1 || err "Solana CLI not found"
command -v anchor >/dev/null 2>&1 || err "Anchor CLI not found"

# Check network
NETWORK=$(solana config get | grep "RPC URL" | awk '{print $NF}')
if [[ "$NETWORK" != *"mainnet"* ]]; then
  warn "Not on mainnet! Current: $NETWORK"
  read -p "Switch to mainnet? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    solana config set --url mainnet-beta
  else
    err "Aborted — must deploy to mainnet"
  fi
fi

# Check balance
BALANCE=$(solana balance | awk '{print $1}')
log "Deployer balance: $BALANCE SOL"
if (( $(echo "$BALANCE < 5" | bc -l) )); then
  err "Insufficient balance — need ≥5 SOL per program"
fi

# Check program binaries
declare -A PROGRAMS=(
  [creature]="solmon_creature"
  [battle]="solmon_battle"
  [token]="solmon_token"
  [marketplace]="solmon_marketplace"
)

deploy_program() {
  local name=$1
  local lib=${PROGRAMS[$name]}
  local so="$DEPLOY_DIR/${lib}.so"
  local keypair="$DEPLOY_DIR/${lib}-keypair.json"

  if [[ ! -f "$so" ]]; then
    err "Binary not found: $so — run 'anchor build' first"
  fi

  if [[ ! -f "$keypair" ]]; then
    warn "Keypair not found: $keypair — generating new one"
    solana-keygen new --no-bip39-passphrase -o "$keypair"
  fi

  local PROGRAM_ID=$(solana-keygen pubkey "$keypair")
  log "Deploying $name → $PROGRAM_ID"

  # Deploy with max retries
  solana program deploy \
    "$so" \
    --program-id "$keypair" \
    --url mainnet-beta \
    --commitment confirmed \
    --max-signatures 600 \
    2>&1 | tee "$LOG_DIR/${name}_${TIMESTAMP}.log"

  if [[ ${PIPESTATUS[0]} -eq 0 ]]; then
    log "✅ $name deployed: $PROGRAM_ID"
    echo "$name=$PROGRAM_ID" >> "$LOG_DIR/program_ids_${TIMESTAMP}.txt"
  else
    err "❌ $name deployment failed — check $LOG_DIR/${name}_${TIMESTAMP}.log"
  fi
}

# ─── Deploy ────────────────────────────────────────────────

log "Starting mainnet deployment — $TIMESTAMP"

if [[ "$TARGET" == "all" ]]; then
  for prog in creature battle token marketplace; do
    deploy_program "$prog"
  done
else
  deploy_program "$TARGET"
fi

log "═══════════════════════════════════════"
log "  DEPLOYMENT COMPLETE"
log "═══════════════════════════════════════"
log "  Program IDs saved to: $LOG_DIR/program_ids_${TIMESTAMP}.txt"
log "  Logs: $LOG_DIR/"
log ""
log "  Next steps:"
log "  1. Update Anchor.toml with new program IDs"
log "  2. Update app/src/lib/constants.ts"
log "  3. Run initialization scripts"
log "  4. Verify programs on Solscan/SolanaFM"
