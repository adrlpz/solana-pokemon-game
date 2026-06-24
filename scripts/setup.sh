#!/usr/bin/env bash
set -euo pipefail

# SOLMON Setup Script
# Usage: ./scripts/setup.sh

echo "🎮 Setting up SOLMON development environment..."

# Check dependencies
check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo "❌ $1 is required but not installed."
    return 1
  fi
  echo "✅ $1 found"
}

check_command node
check_command solana
check_command anchor

# Install JS dependencies
echo "📦 Installing dependencies..."
yarn install

# Configure Solana for localnet
echo "⚙️ Configuring Solana..."
solana config set --url localhost

# Generate keypair if not exists
if [ ! -f ~/.config/solana/id.json ]; then
  echo "🔑 Generating Solana keypair..."
  solana-keygen new --no-bip39-passphrase
fi

# Airdrop SOL for testing
echo "💰 Requesting airdrop..."
solana airdrop 10 --url localhost 2>/dev/null || echo "(start validator first)"

# Build programs
echo "🔨 Building Anchor programs..."
anchor build

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start local validator:  solana-test-validator"
echo "  2. Start Docker services:  docker compose up -d"
echo "  3. Deploy programs:        ./scripts/deploy-local.sh"
echo "  4. Start frontend:         cd app && npm run dev"
echo "  5. Run tests:              anchor test"
