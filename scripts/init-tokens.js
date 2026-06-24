/**
 * SOLMON Token Initialization (plain Node.js)
 * Calls initialize_solmon + initialize_soltreat + mint_solmon_initial on devnet
 */

const { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync } = require('@solana/spl-token');
const fs = require('fs');

const RPC = 'https://api.devnet.solana.com';
const TOKEN_PROGRAM = new PublicKey('Bdu6eyg4mNwh7Cw3bGqKrECDhgGxL4HaHFn7GsB7kCd4');
const SYSVAR_RENT = new PublicKey('SysvarRent111111111111111111111111111111111');

const DEPLOYER_KEYPAIR_PATH = process.env.DEPLOYER_KEYPAIR_PATH || '/tmp/solmon-deployer.json';
const deployer = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(DEPLOYER_KEYPAIR_PATH, 'utf-8'))));
const connection = new Connection(RPC, 'confirmed');

function findPDA(seeds, programId) {
  return PublicKey.findProgramAddressSync(seeds, programId);
}

// Correct Anchor discriminators (sha256("global:<name>")[0..8])
const DISC = {
  initialize_solmon:    Buffer.from([91, 88, 220, 233, 114, 195, 84, 152]),
  initialize_soltreat:  Buffer.from([234, 181, 93, 180, 75, 181, 89, 39]),
  mint_solmon_initial:  Buffer.from([60, 241, 137, 45, 152, 94, 74, 134]),
};

async function main() {
  console.log('🪙 SOLMON Token Initialization');
  console.log(`  Deployer: ${deployer.publicKey.toString()}`);
  const bal = await connection.getBalance(deployer.publicKey);
  console.log(`  Balance: ${bal / 1e9} SOL`);
  console.log('');

  const [tokenConfig] = findPDA([Buffer.from('token-config')], TOKEN_PROGRAM);
  const [solmonMint] = findPDA([Buffer.from('solmon-mint')], TOKEN_PROGRAM);
  const [soltreatMint] = findPDA([Buffer.from('soltreat-mint')], TOKEN_PROGRAM);
  const [tokenAuthority] = findPDA([Buffer.from('token-authority')], TOKEN_PROGRAM);

  console.log('  PDAs:');
  console.log(`    Token Config:    ${tokenConfig.toString()}`);
  console.log(`    $SOLMON Mint:    ${solmonMint.toString()}`);
  console.log(`    $SOLTREAT Mint:  ${soltreatMint.toString()}`);
  console.log(`    Token Authority: ${tokenAuthority.toString()}`);
  console.log('');

  // ─── Step 1: Initialize $SOLMON ────────────────────────
  const configInfo = await connection.getAccountInfo(tokenConfig);
  if (configInfo) {
    console.log('⏭️  Token config already initialized');
  } else {
    console.log('📤 Step 1: Initialize $SOLMON...');

    // InitializeSOLMON accounts:
    // token_config(init), solmon_mint(init), token_authority, treasury, authority(signer), token_program, system_program, rent
    const initIx = new TransactionInstruction({
      programId: TOKEN_PROGRAM,
      keys: [
        { pubkey: tokenConfig, isSigner: false, isWritable: true },
        { pubkey: solmonMint, isSigner: false, isWritable: true },
        { pubkey: tokenAuthority, isSigner: false, isWritable: false },
        { pubkey: deployer.publicKey, isSigner: false, isWritable: false }, // treasury
        { pubkey: deployer.publicKey, isSigner: true, isWritable: true },   // authority (payer)
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT, isSigner: false, isWritable: false },
      ],
      data: DISC.initialize_solmon,
    });

    try {
      const sig = await sendAndConfirmTransaction(connection, new Transaction().add(initIx), [deployer]);
      console.log(`  ✅ $SOLMON initialized: ${sig}`);
      console.log(`  🔗 https://solscan.io/tx/${sig}?cluster=devnet`);
    } catch (e) {
      console.log(`  ❌ Failed: ${e.message}`);
      if (e.getLogs) console.log('  Logs:', await e.getLogs());
    }
  }

  // ─── Step 2: Initialize $SOLTREAT ──────────────────────
  const soltreatInfo = await connection.getAccountInfo(soltreatMint);
  if (soltreatInfo) {
    console.log('⏭️  $SOLTREAT already initialized');
  } else {
    console.log('📤 Step 2: Initialize $SOLTREAT...');

    // InitializeSOLTREAT accounts:
    // token_config(mut), soltreat_mint(init), token_authority, authority(signer), token_program, system_program, rent
    const initIx = new TransactionInstruction({
      programId: TOKEN_PROGRAM,
      keys: [
        { pubkey: tokenConfig, isSigner: false, isWritable: true },
        { pubkey: soltreatMint, isSigner: false, isWritable: true },
        { pubkey: tokenAuthority, isSigner: false, isWritable: false },
        { pubkey: deployer.publicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT, isSigner: false, isWritable: false },
      ],
      data: DISC.initialize_soltreat,
    });

    try {
      const sig = await sendAndConfirmTransaction(connection, new Transaction().add(initIx), [deployer]);
      console.log(`  ✅ $SOLTREAT initialized: ${sig}`);
      console.log(`  🔗 https://solscan.io/tx/${sig}?cluster=devnet`);
    } catch (e) {
      console.log(`  ❌ Failed: ${e.message}`);
      if (e.getLogs) console.log('  Logs:', await e.getLogs());
    }
  }

  // ─── Step 3: Create ATA + Mint 1B $SOLMON ─────────────
  console.log('📤 Step 3: Create treasury ATA + mint 1B $SOLMON...');

  const treasuryATA = getAssociatedTokenAddressSync(solmonMint, deployer.publicKey);
  console.log(`  ATA: ${treasuryATA.toString()}`);

  const ataInfo = await connection.getAccountInfo(treasuryATA);
  if (!ataInfo) {
    const ataIx = createAssociatedTokenAccountInstruction(
      deployer.publicKey, treasuryATA, deployer.publicKey, solmonMint,
    );
    try {
      const sig = await sendAndConfirmTransaction(connection, new Transaction().add(ataIx), [deployer]);
      console.log(`  ✅ ATA created: ${sig}`);
    } catch (e) {
      console.log(`  ❌ ATA failed: ${e.message}`);
      return;
    }
  } else {
    console.log('  ⏭️  ATA already exists');
  }

  // MintSolmonInitial accounts:
  // token_config, solmon_mint(mut), token_authority, treasury_token_account(mut), token_program
  const mintIx = new TransactionInstruction({
    programId: TOKEN_PROGRAM,
    keys: [
      { pubkey: tokenConfig, isSigner: false, isWritable: false },
      { pubkey: solmonMint, isSigner: false, isWritable: true },
      { pubkey: tokenAuthority, isSigner: false, isWritable: false },
      { pubkey: treasuryATA, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: DISC.mint_solmon_initial,
  });

  try {
    const sig = await sendAndConfirmTransaction(connection, new Transaction().add(mintIx), [deployer]);
    console.log(`  ✅ 1B $SOLMON minted: ${sig}`);
    console.log(`  🔗 https://solscan.io/tx/${sig}?cluster=devnet`);
  } catch (e) {
    console.log(`  ❌ Mint failed: ${e.message}`);
    if (e.getLogs) console.log('  Logs:', await e.getLogs());
  }

  // ─── Summary ───────────────────────────────────────────
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  TOKEN INIT SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`  $SOLMON Mint:    ${solmonMint.toString()}`);
  console.log(`  $SOLTREAT Mint:  ${soltreatMint.toString()}`);
  console.log(`  Token Config:    ${tokenConfig.toString()}`);
  console.log(`  Token Authority: ${tokenAuthority.toString()}`);
  console.log(`  Treasury ATA:    ${treasuryATA.toString()}`);
  console.log(`  Solscan: https://solscan.io/token/${solmonMint.toString()}?cluster=devnet`);
}

main().catch(console.error);
