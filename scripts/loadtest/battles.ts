#!/usr/bin/env npx ts-node

/**
 * SOLMON Load Test — Simulate concurrent battles
 *
 * Tests program throughput under load:
 * - N concurrent battle creations
 * - M concurrent commit-reveal rounds
 * - Measure TPS, latency, failure rate
 *
 * Usage: npx ts-node scripts/loadtest/battles.ts [--concurrent 50] [--rounds 10]
 */

import * as anchor from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';

const CONCURRENT = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--concurrent') || '10');
const ROUNDS = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--rounds') || '5');

interface LoadResult {
  totalTx: number;
  successful: number;
  failed: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  tps: number;
}

async function runLoadTest(): Promise<LoadResult> {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SolmonBattle;

  const latencies: number[] = [];
  let successful = 0;
  let failed = 0;
  const startAll = Date.now();

  console.log(`🔥 Load test: ${CONCURRENT} concurrent battles × ${ROUNDS} rounds`);
  console.log(`   RPC: ${provider.connection.rpcEndpoint}\n`);

  // Create battle wallets
  const wallets = Array.from({ length: CONCURRENT }, () => Keypair.generate());

  // Airdrop in batches
  console.log('💰 Airdropping SOL to test wallets...');
  for (let i = 0; i < wallets.length; i += 5) {
    const batch = wallets.slice(i, i + 5);
    await Promise.all(
      batch.map(async (kp) => {
        try {
          const sig = await provider.connection.requestAirdrop(kp.publicKey, 0.5 * LAMPORTS_PER_SOL);
          await provider.connection.confirmTransaction(sig);
        } catch {}
      }),
    );
  }
  console.log('   Done.\n');

  // Create battles concurrently
  console.log('⚔️ Creating battles...');
  const battlePromises = wallets.map(async (kp, i) => {
    const timestamp = Math.floor(Date.now() / 1000) + i;
    const [battle] = PublicKey.findProgramAddressSync(
      [Buffer.from('battle'), kp.publicKey.toBuffer(), new anchor.BN(timestamp).toArrayLike(Buffer, 'le', 8)],
      program.programId,
    );

    const start = Date.now();
    try {
      await program.methods
        .createBattle(new anchor.BN(0))
        .accounts({ battleSession: battle, player1: kp.publicKey, systemProgram: SystemProgram.programId })
        .signers([kp])
        .rpc();

      latencies.push(Date.now() - start);
      successful++;
      return { battle, kp, success: true };
    } catch (err: any) {
      latencies.push(Date.now() - start);
      failed++;
      return { battle, kp, success: false, error: err.message };
    }
  });

  const results = await Promise.all(battlePromises);
  const created = results.filter((r) => r.success);

  console.log(`   Created: ${created.length}/${CONCURRENT}`);
  console.log(`   Failed: ${failed}\n`);

  // Simulate commit-reveal rounds (just hash commits for speed)
  if (ROUNDS > 0) {
    console.log(`📝 Simulating ${ROUNDS} commit rounds...`);
    for (let round = 0; round < ROUNDS; round++) {
      const roundStart = Date.now();
      const commitPromises = created.map(async ({ battle, kp }) => {
        const commitment = new Uint8Array(32); // dummy commitment
        try {
          await program.methods
            .commitMove(Array.from(commitment))
            .accounts({ battleSession: battle, player: kp.publicKey })
            .signers([kp])
            .rpc();
          successful++;
        } catch {
          failed++;
        }
      });
      await Promise.all(commitPromises);
      const roundMs = Date.now() - roundStart;
      console.log(`   Round ${round + 1}: ${roundMs}ms`);
    }
  }

  const totalMs = Date.now() - startAll;
  const totalTx = successful + failed;
  const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
  const tps = totalTx / (totalMs / 1000);

  return { totalTx, successful, failed, avgLatencyMs: avgLatency, maxLatencyMs: maxLatency, tps };
}

// ─── Main ──────────────────────────────────────────────────

runLoadTest()
  .then((result) => {
    console.log('\n═══════════════════════════════════════');
    console.log('         LOAD TEST RESULTS');
    console.log('═══════════════════════════════════════');
    console.log(`  Total TX:      ${result.totalTx}`);
    console.log(`  Successful:    ${result.successful}`);
    console.log(`  Failed:        ${result.failed}`);
    console.log(`  Avg Latency:   ${result.avgLatencyMs.toFixed(0)}ms`);
    console.log(`  Max Latency:   ${result.maxLatencyMs.toFixed(0)}ms`);
    console.log(`  TPS:           ${result.tps.toFixed(2)}`);
    console.log('═══════════════════════════════════════\n');

    if (result.failed > result.totalTx * 0.1) {
      console.log('⚠️  High failure rate (>10%) — check RPC limits');
    }
    if (result.avgLatencyMs > 5000) {
      console.log('⚠️  High latency (>5s) — consider dedicated RPC');
    }
  })
  .catch(console.error);
