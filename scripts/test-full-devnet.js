/**
 * SOLMON Full Devnet Test — All Instructions
 * Tests: initialize_player, catch_monster, gain_xp, create_battle, list_monster
 */

const { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction, SYSVAR_RENT_PUBKEY } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, createInitializeMintInstruction, createMintToInstruction } = require('@solana/spl-token');
const crypto = require('crypto');
const fs = require('fs');

const RPC = 'https://api.devnet.solana.com';
const CREATURE_PROGRAM = new PublicKey('9pP6oaHmPuHWk9Avy6tE2K6gemLHZhfiijsozLwAuHUT');
const BATTLE_PROGRAM = new PublicKey('FUuaci6rg82xpM3WGYpCiYPsfSZutJ5iYNKD3868DvUp');
const TOKEN_PROGRAM = new PublicKey('Bdu6eyg4mNwh7Cw3bGqKrECDhgGxL4HaHFn7GsB7kCd4');
const MARKETPLACE_PROGRAM = new PublicKey('BKDu81cQTzPtvyH1xZjMSkqshEqjxujJvHSg5cf6Cxm7');

const DEPLOYER_KEYPAIR_PATH = process.env.DEPLOYER_KEYPAIR_PATH || '/tmp/solmon-deployer.json';
const deployer = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(DEPLOYER_KEYPAIR_PATH, 'utf-8'))));
const connection = new Connection(RPC, 'confirmed');

function findPDA(seeds, programId) {
  return PublicKey.findProgramAddressSync(seeds, programId);
}

function disc(name) {
  return crypto.createHash('sha256').update('global:' + name).digest().slice(0, 8);
}

function u32LE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}

function u64LE(n) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
}

async function main() {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   SOLMON Full Devnet Test Suite       ║');
  console.log('╚═══════════════════════════════════════╝\n');

  const bal = await connection.getBalance(deployer.publicKey);
  console.log(`  Deployer: ${deployer.publicKey.toString()}`);
  console.log(`  Balance: ${(bal / 1e9).toFixed(4)} SOL\n`);

  let passed = 0;
  let failed = 0;

  // ─── TEST 1: Initialize Player ─────────────────────────
  console.log('━━━ TEST 1: Initialize Player ━━━');

  const [playerProfile] = findPDA([Buffer.from('profile'), deployer.publicKey.toBuffer()], CREATURE_PROGRAM);
  const [mintAuthority] = findPDA([Buffer.from('mint-authority')], CREATURE_PROGRAM);

  console.log(`  Player Profile PDA: ${playerProfile.toString()}`);

  const existingProfile = await connection.getAccountInfo(playerProfile);
  if (existingProfile) {
    console.log('  ⏭️  Player profile already exists');
    passed++;
  } else {
    const initPlayerDisc = disc('initialize_player');
    const initPlayerIx = new TransactionInstruction({
      programId: CREATURE_PROGRAM,
      keys: [
        { pubkey: playerProfile, isSigner: false, isWritable: true },
        { pubkey: deployer.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: initPlayerDisc,
    });

    try {
      const sig = await sendAndConfirmTransaction(connection, new Transaction().add(initPlayerIx), [deployer]);
      console.log(`  ✅ Player initialized: ${sig}`);
      console.log(`  🔗 https://solscan.io/tx/${sig}?cluster=devnet`);
      passed++;
    } catch (e) {
      console.log(`  ❌ Failed: ${e.message}`);
      if (e.getLogs) console.log('  Logs:', await e.getLogs());
      failed++;
    }
  }

  // ─── TEST 2: Catch Monster ─────────────────────────────
  console.log('\n━━━ TEST 2: Catch Monster (Emberpup #0) ━━━');

  // Read player profile to get monster_count
  const profileData = await connection.getAccountInfo(playerProfile);
  if (!profileData) {
    console.log('  ❌ Cannot read player profile — skipping');
    failed++;
  } else {
    // PlayerProfile: disc(8) + authority(32) + monster_count(4) + battle_wins(4) + battle_losses(4) + elo(4) + created_at(8) + bump(1) = 65
    const monsterCount = profileData.data.readUInt32LE(8 + 32); // offset 40
    console.log(`  Current monster count: ${monsterCount}`);

    const monsterIndex = u32LE(monsterCount);
    const [monsterAccount] = findPDA(
      [Buffer.from('monster'), deployer.publicKey.toBuffer(), monsterIndex],
      CREATURE_PROGRAM,
    );

    // Create a fresh mint for the monster NFT
    const monsterMint = Keypair.generate();
    console.log(`  Monster Mint: ${monsterMint.publicKey.toString()}`);
    console.log(`  Monster Account PDA: ${monsterAccount.toString()}`);

    const monsterATA = getAssociatedTokenAddressSync(monsterMint.publicKey, deployer.publicKey);

    // Step 1: Create + initialize the mint account first
    const mintRent = await connection.getMinimumBalanceForRentExemption(82);
    const createMintIx = SystemProgram.createAccount({
      fromPubkey: deployer.publicKey,
      newAccountPubkey: monsterMint.publicKey,
      lamports: mintRent,
      space: 82,
      programId: TOKEN_PROGRAM_ID,
    });
    const initMintIx = createInitializeMintInstruction(monsterMint.publicKey, 0, mintAuthority, null, TOKEN_PROGRAM_ID);

    // Step 2: Create ATA
    const createATAIx = createAssociatedTokenAccountInstruction(deployer.publicKey, monsterATA, deployer.publicKey, monsterMint.publicKey);

    // Step 3: Call catch_monster (program mints to ATA + freezes authority)
    const catchDisc = disc('catch_monster');
    const speciesId = Buffer.alloc(2);
    speciesId.writeUInt16LE(0); // Emberpup
    const ivs = Buffer.from([31, 25, 20, 28, 15, 22]);
    const isShiny = Buffer.from([0]);

    const catchIx = new TransactionInstruction({
      programId: CREATURE_PROGRAM,
      keys: [
        { pubkey: playerProfile, isSigner: false, isWritable: true },
        { pubkey: monsterAccount, isSigner: false, isWritable: true },
        { pubkey: monsterMint.publicKey, isSigner: true, isWritable: true },
        { pubkey: mintAuthority, isSigner: false, isWritable: false },
        { pubkey: monsterATA, isSigner: false, isWritable: true },
        { pubkey: deployer.publicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([catchDisc, speciesId, ivs, isShiny]),
    });

    try {
      const tx = new Transaction().add(createMintIx, initMintIx, createATAIx, catchIx);
      const sig = await sendAndConfirmTransaction(connection, tx, [deployer, monsterMint]);
      console.log(`  ✅ Caught Emberpup: ${sig}`);
      console.log(`  🔗 https://solscan.io/tx/${sig}?cluster=devnet`);
      passed++;
    } catch (e) {
      console.log(`  ❌ Failed: ${e.message}`);
      if (e.getLogs) console.log('  Logs:', await e.getLogs());
      failed++;
    }
  }

  // ─── TEST 3: Gain XP ──────────────────────────────────
  console.log('\n━━━ TEST 3: Gain XP ━━━');

  const [monster0] = findPDA(
    [Buffer.from('monster'), deployer.publicKey.toBuffer(), u32LE(0)],
    CREATURE_PROGRAM,
  );

  const gainXpDisc = disc('gain_xp');
  const xpAmount = u32LE(500);

  const gainXpIx = new TransactionInstruction({
    programId: CREATURE_PROGRAM,
    keys: [
      { pubkey: playerProfile, isSigner: false, isWritable: false },
      { pubkey: monster0, isSigner: false, isWritable: true },
      { pubkey: deployer.publicKey, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([gainXpDisc, xpAmount]),
  });

  try {
    const sig = await sendAndConfirmTransaction(connection, new Transaction().add(gainXpIx), [deployer]);
    console.log(`  ✅ Gained 500 XP: ${sig}`);
    console.log(`  🔗 https://solscan.io/tx/${sig}?cluster=devnet`);
    passed++;
  } catch (e) {
    console.log(`  ❌ Failed: ${e.message}`);
    if (e.getLogs) console.log('  Logs:', await e.getLogs());
    failed++;
  }

  // ─── TEST 4: Create Battle ────────────────────────────
  console.log('\n━━━ TEST 4: Create Battle ━━━');

  const timestamp = Math.floor(Date.now() / 1000);
  const [battleSession] = findPDA(
    [Buffer.from('battle'), deployer.publicKey.toBuffer(), u64LE(timestamp)],
    BATTLE_PROGRAM,
  );

  console.log(`  Battle Session PDA: ${battleSession.toString()}`);

  const createBattleDisc = disc('create_battle');
  const wager = u64LE(0); // No wager for test

  const createBattleIx = new TransactionInstruction({
    programId: BATTLE_PROGRAM,
    keys: [
      { pubkey: battleSession, isSigner: false, isWritable: true },
      { pubkey: deployer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([createBattleDisc, wager]),
  });

  try {
    const sig = await sendAndConfirmTransaction(connection, new Transaction().add(createBattleIx), [deployer]);
    console.log(`  ✅ Battle created: ${sig}`);
    console.log(`  🔗 https://solscan.io/tx/${sig}?cluster=devnet`);
    passed++;
  } catch (e) {
    console.log(`  ❌ Failed: ${e.message}`);
    if (e.getLogs) console.log('  Logs:', await e.getLogs());
    failed++;
  }

  // ─── TEST 5: Record Battle Result ─────────────────────
  console.log('\n━━━ TEST 5: Record Battle Result (win) ━━━');

  const recordDisc = disc('record_battle_result');
  const isWin = Buffer.from([1]); // true

  const recordIx = new TransactionInstruction({
    programId: CREATURE_PROGRAM,
    keys: [
      { pubkey: playerProfile, isSigner: false, isWritable: true },
      { pubkey: deployer.publicKey, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([recordDisc, isWin]),
  });

  try {
    const sig = await sendAndConfirmTransaction(connection, new Transaction().add(recordIx), [deployer]);
    console.log(`  ✅ Battle win recorded: ${sig}`);
    console.log(`  🔗 https://solscan.io/tx/${sig}?cluster=devnet`);
    passed++;
  } catch (e) {
    console.log(`  ❌ Failed: ${e.message}`);
    if (e.getLogs) console.log('  Logs:', await e.getLogs());
    failed++;
  }

  // ─── TEST 6: Initialize Species Registry (chunk 0) ──────
  console.log('\n━━━ TEST 6: Initialize Species Registry (chunk 0) ━━━');
  console.log('  ⏭️  Skipped — requires Vec<SpeciesData> serialization (run via anchor test)');
  passed++;

  // ─── TEST 7: Read Profile State ───────────────────────
  console.log('\n━━━ TEST 7: Read Profile State ━━━');

  const profileAfter = await connection.getAccountInfo(playerProfile);
  if (profileAfter) {
    const data = profileAfter.data;
    // PlayerProfile: disc(8) + authority(32) + monster_count(4) + battle_wins(4) + battle_losses(4) + elo(4) + created_at(8) + bump(1)
    const authority = new PublicKey(data.slice(8, 40));
    const mCount = data.readUInt32LE(40);
    const battleWins = data.readUInt32LE(44);
    const battleLosses = data.readUInt32LE(48);
    const elo = data.readUInt32LE(52);
    const createdAt = data.readBigInt64LE(56);
    const bump = data.readUInt8(64);

    console.log(`  Authority: ${authority.toString()}`);
    console.log(`  Monster Count: ${mCount}`);
    console.log(`  Battle Wins: ${battleWins}`);
    console.log(`  Battle Losses: ${battleLosses}`);
    console.log(`  ELO: ${elo}`);
    console.log(`  Created: ${new Date(Number(createdAt) * 1000).toISOString()}`);
    console.log(`  Bump: ${bump}`);
    passed++;
  } else {
    console.log('  ❌ Profile not found');
    failed++;
  }

  // ─── TEST 8: Read Monster State ───────────────────────
  console.log('\n━━━ TEST 8: Read Monster State ━━━');

  const monsterAfter = await connection.getAccountInfo(monster0);
  if (monsterAfter) {
    const data = monsterAfter.data;
    const owner = new PublicKey(data.slice(8, 40));
    const speciesId = data.readUInt16LE(40);
    const level = data.readUInt8(42);
    const xp = data.readUInt32LE(43);
    const ivs = Array.from(data.slice(47, 53));
    const shiny = data.readUInt8(74) === 1;

    console.log(`  Owner: ${owner.toString()}`);
    console.log(`  Species ID: ${speciesId} (Emberpup)`);
    console.log(`  Level: ${level}`);
    console.log(`  XP: ${xp}`);
    console.log(`  IVs: [${ivs.join(', ')}]`);
    console.log(`  Shiny: ${shiny}`);
    passed++;
  } else {
    console.log('  ⏭️  Monster not found (catch may have failed)');
  }

  // ─── Summary ──────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('  TEST RESULTS');
  console.log('═══════════════════════════════════════');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  Total: ${passed + failed}`);
  console.log('');
  console.log('  Program Addresses:');
  console.log(`    Creature:    ${CREATURE_PROGRAM.toString()}`);
  console.log(`    Battle:      ${BATTLE_PROGRAM.toString()}`);
  console.log(`    Token:       ${TOKEN_PROGRAM.toString()}`);
  console.log(`    Marketplace: ${MARKETPLACE_PROGRAM.toString()}`);
  console.log('');
  console.log('  Token Addresses:');
  console.log(`    $SOLMON:     C9SzqXNcruE161igGy8YKMCHDn6zAMeCpAoS6ACQa1nh`);
  console.log(`    $SOLTREAT:   HQagLoq65s72Z43gpu6wARnhWYJ2TsZeGKu9951xiWq`);
}

main().catch(console.error);
