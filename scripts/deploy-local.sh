#!/usr/bin/env bash
set -euo pipefail

# Deploy SOLMON programs to localnet
echo "🚀 Deploying SOLMON programs to localnet..."

# Ensure validator is running
if ! solana cluster-version &>/dev/null; then
  echo "❌ Solana validator not running. Start with: solana-test-validator"
  exit 1
fi

# Build if needed
if [ ! -f target/deploy/solmon_creature-keypair.json ]; then
  echo "🔨 Building programs..."
  anchor build
fi

# Deploy
echo "📦 Deploying programs..."
anchor deploy --provider.cluster localnet

# Initialize species registry
echo "📋 Initializing species registry..."
# TODO: run initialization script with species data

# Initialize tokens
echo "🪙 Initializing $SOLMON and $SOLTREAT tokens..."
# TODO: run token initialization

echo ""
echo "✅ Deploy complete!"
echo ""
echo "Program IDs:"
echo "  Creature:    Crea1111111111111111111111111111111111111111"
echo "  Battle:      Batt1e1111111111111111111111111111111111111111"
echo "  Token:       TokeN11111111111111111111111111111111111111111"
echo "  Marketplace: Marke7111111111111111111111111111111111111111"
