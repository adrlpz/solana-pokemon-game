#!/bin/bash

# SOLMON Devnet Test Script
# Tests deployed programs via Solana CLI + curl
#
# Usage: bash scripts/test-devnet.sh

set -euo pipefail

SOLANA=/home/ubuntu/.local/share/solana/install/releases/v1.18.17/solana-release/bin/solana
KEYGEN=/home/ubuntu/.local/share/solana/install/releases/v1.18.17/solana-release/bin/solana-keygen
RPC="https://api.devnet.solana.com"

CREATURE="9pP6oaHmPuHWk9Avy6tE2K6gemLHZhfiijsozLwAuHUT"
BATTLE="FUuaci6rg82xpM3WGYpCiYPsfSZutJ5iYNKD3868DvUp"
TOKEN="Bdu6eyg4mNwh7Cw3bGqKrECDhgGxL4HaHFn7GsB7kCd4"
MARKETPLACE="BKDu81cQTzPtvyH1xZjMSkqshEqjxujJvHSg5cf6Cxm7"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; }
info() { echo -e "${YELLOW}ℹ️  $1${NC}"; }

echo "╔═══════════════════════════════════════╗"
echo "║   SOLMON Devnet Test Suite            ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# ─── Test 1: Programs exist on devnet ──────────────────────

info "Test 1: Verify programs deployed"

for prog in creature:$CREATURE battle:$BATTLE token:$TOKEN marketplace:$MARKETPLACE; do
  name=${prog%%:*}
  addr=${prog#*:}
  SIZE=$($SOLANA account "$addr" --url devnet 2>/dev/null | grep "Data Length" | awk '{print $NF}' || echo "0")
  if [[ "$SIZE" != "0" ]] && [[ -n "$SIZE" ]]; then
    pass "$name: $addr ($SIZE bytes)"
  else
    fail "$name: NOT FOUND at $addr"
  fi
done

echo ""

# ─── Test 2: Program executable check ─────────────────────

info "Test 2: Verify programs are executable"

for prog in creature:$CREATURE battle:$BATTLE token:$TOKEN marketplace:$MARKETPLACE; do
  name=${prog%%:*}
  addr=${prog#*:}
  EXEC=$($SOLANA account "$addr" --url devnet 2>/dev/null | grep "Owner" | awk '{print $NF}' || echo "unknown")
  if [[ "$EXEC" == "BPFLoaderUpgradeab1e11111111111111111111111" ]]; then
    pass "$name: executable (BPF Loader)"
  else
    info "$name: owner=$EXEC"
  fi
done

echo ""

# ─── Test 3: RPC connectivity ─────────────────────────────

info "Test 3: RPC connectivity"

SLOT=$(curl -s "$RPC" -X POST -H "Content-Type: application/json" -d '{
  "jsonrpc":"2.0","id":1,"method":"getSlot"
}' | python3 -c "import json,sys; print(json.load(sys.stdin).get('result',0))" 2>/dev/null)

if [[ "$SLOT" -gt 0 ]]; then
  pass "RPC connected, current slot: $SLOT"
else
  fail "RPC not responding"
fi

echo ""

# ─── Test 4: Wallet balance ───────────────────────────────

info "Test 4: Deployer wallet balance"

BALANCE=$($SOLANA balance HYXrhG7NbeUSVNjg9evdTm1B5yTwbFCBoT7QfrdTYKBJ --url devnet 2>/dev/null | awk '{print $1}')
info "Balance: $BALANCE SOL"

echo ""

# ─── Test 5: Fetch program accounts ───────────────────────

info "Test 5: Program account info"

for prog in creature:$CREATURE battle:$BATTLE token:$TOKEN marketplace:$MARKETPLACE; do
  name=${prog%%:*}
  addr=${prog#*:}
  echo "  --- $name ---"
  $SOLANA account "$addr" --url devnet 2>/dev/null | grep -E "Public Key|Balance|Owner|Data Length|Executable" | sed 's/^/  /'
  echo ""
done

# ─── Summary ───────────────────────────────────────────────

echo "═══════════════════════════════════════"
echo "  TEST COMPLETE"
echo "═══════════════════════════════════════"
echo ""
echo "  Programs:"
echo "    Creature:    $CREATURE"
echo "    Battle:      $BATTLE"
echo "    Token:       $TOKEN"
echo "    Marketplace: $MARKETPLACE"
echo ""
echo "  Solscan Links:"
echo "    https://solscan.io/account/$CREATURE?cluster=devnet"
echo "    https://solscan.io/account/$BATTLE?cluster=devnet"
echo "    https://solscan.io/account/$TOKEN?cluster=devnet"
echo "    https://solscan.io/account/$MARKETPLACE?cluster=devnet"
