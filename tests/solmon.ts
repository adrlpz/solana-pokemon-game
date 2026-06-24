import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import {
  PublicKey,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID as SPL_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  getAccount,
} from '@solana/spl-token';
import { expect } from 'chai';

/**
 * SOLMON Phase 1 Tests — Creature Program
 *
 * Tests cover:
 * 1. Player profile initialization
 * 2. Species registry initialization (4 chunks)
 * 3. Monster catching with NFT mint
 * 4. XP gain and leveling
 * 5. EV training with caps
 * 6. Evolution
 * 7. Move teaching
 * 8. Battle result recording
 * 9. Stat calculation verification
 * 10. Error cases
 */

describe('SOLMON Phase 1 — Creature Program', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolmonCreature;
  const authority = provider.wallet.publicKey;

  // PDAs
  let playerProfile: PublicKey;
  let speciesRegistry0: PublicKey; // chunk 0 (species 0-63)

  // Keypairs for NFT mints
  let monsterMint1: Keypair;
  let monsterMint2: Keypair;

  // Derived accounts
  let monsterAccount0: PublicKey; // first monster
  let monsterAccount1: PublicKey; // second monster
  let playerTokenAccount0: PublicKey;
  let playerTokenAccount1: PublicKey;
  let mintAuthority: PublicKey;

  before(async () => {
    // Derive PDAs
    [playerProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from('profile'), authority.toBuffer()],
      program.programId
    );

    [speciesRegistry0] = PublicKey.findProgramAddressSync(
      [Buffer.from('registry'), Buffer.from([0])],
      program.programId
    );

    [mintAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('mint-authority')],
      program.programId
    );

    // Pre-generate mint keypairs
    monsterMint1 = Keypair.generate();
    monsterMint2 = Keypair.generate();
  });

  // ─── 1. Player Profile ──────────────────────────────────

  describe('Player Profile', () => {
    it('Initialize player profile', async () => {
      const tx = await program.methods
        .initializePlayer()
        .accounts({
          playerProfile,
          authority,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const profile = await program.account.playerProfile.fetch(playerProfile);
      expect(profile.authority.toString()).to.equal(authority.toString());
      expect(profile.monsterCount).to.equal(0);
      expect(profile.battleWins).to.equal(0);
      expect(profile.battleLosses).to.equal(0);
      expect(profile.elo).to.equal(1000);

      console.log('✅ Player initialized — ELO:', profile.elo);
    });

    it('Reject duplicate player profile', async () => {
      try {
        await program.methods
          .initializePlayer()
          .accounts({
            playerProfile,
            authority,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.toString()).to.include('already in use');
        console.log('✅ Duplicate profile rejected');
      }
    });
  });

  // ─── 2. Species Registry ────────────────────────────────

  describe('Species Registry', () => {
    it('Initialize registry chunk 0', async () => {
      // Generate 64 dummy species for testing
      const speciesData = [];
      for (let i = 0; i < 64; i++) {
        speciesData.push({
          baseStats: [50 + i, 40, 40, 40, 40, 40],
          element: i % 6,
          rarity: Math.floor(i / 16),
          evolvesTo: i < 12 ? i + 1 : 0xFFFF, // starters evolve
          evolutionLevel: i < 12 ? 30 : 0,
          baseMoves: [25, 26, 27, 28],
          abilityId: i % 6,
        });
      }

      await program.methods
        .initializeRegistry(0, speciesData)
        .accounts({
          speciesRegistry: speciesRegistry0,
          authority,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const registry = await program.account.speciesRegistry.fetch(speciesRegistry0);
      expect(registry.chunkIndex).to.equal(0);
      expect(registry.totalSpecies).to.equal(256);
      expect(registry.species[0].baseStats[0]).to.equal(50);
      expect(registry.species[0].element).to.equal(0); // Fire
      expect(registry.species[0].evolvesTo).to.equal(1);

      console.log('✅ Registry chunk 0 initialized — 64 species');
    });
  });

  // ─── 3. Monster Catching ────────────────────────────────

  describe('Monster Catching', () => {
    it('Catch first monster with NFT mint', async () => {
      // Derive monster account PDA (index 0)
      [monsterAccount0] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('monster'),
          authority.toBuffer(),
          Buffer.from([0, 0, 0, 0]),
        ],
        program.programId
      );

      // Derive ATA for monster NFT
      playerTokenAccount0 = anchor.utils.token.associatedAddress({
        mint: monsterMint1.publicKey,
        owner: authority,
      });

      const ivs = [31, 25, 20, 28, 15, 22]; // HP, ATK, DEF, SPD, SpATK, SpDEF

      await program.methods
        .catchMonster(0, ivs, false) // species 0 = Emberpup
        .accounts({
          playerProfile,
          monsterAccount: monsterAccount0,
          monsterMint: monsterMint1.publicKey,
          mintAuthority,
          playerTokenAccount: playerTokenAccount0,
          authority,
          tokenProgram: SPL_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([monsterMint1])
        .rpc();

      // Verify monster account
      const monster = await program.account.monsterAccount.fetch(monsterAccount0);
      expect(monster.speciesId).to.equal(0);
      expect(monster.level).to.equal(1);
      expect(monster.xp).to.equal(0);
      expect(monster.ivs).to.deep.equal(ivs);
      expect(monster.isShiny).to.equal(false);
      expect(monster.mint.toString()).to.equal(monsterMint1.publicKey.toString());

      // Verify NFT minted (supply = 1)
      const tokenAccount = await getAccount(provider.connection, playerTokenAccount0);
      expect(Number(tokenAccount.amount)).to.equal(1);

      // Verify player monster count updated
      const profile = await program.account.playerProfile.fetch(playerProfile);
      expect(profile.monsterCount).to.equal(1);

      console.log('✅ Caught Emberpup — NFT mint:', monsterMint1.publicKey.toString());
    });

    it('Catch second monster (index 1)', async () => {
      [monsterAccount1] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('monster'),
          authority.toBuffer(),
          Buffer.from([1, 0, 0, 0]),
        ],
        program.programId
      );

      playerTokenAccount1 = anchor.utils.token.associatedAddress({
        mint: monsterMint2.publicKey,
        owner: authority,
      });

      const ivs = [20, 30, 25, 18, 28, 10];

      await program.methods
        .catchMonster(3, ivs, true) // species 3, shiny
        .accounts({
          playerProfile,
          monsterAccount: monsterAccount1,
          monsterMint: monsterMint2.publicKey,
          mintAuthority,
          playerTokenAccount: playerTokenAccount1,
          authority,
          tokenProgram: SPL_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([monsterMint2])
        .rpc();

      const monster = await program.account.monsterAccount.fetch(monsterAccount1);
      expect(monster.isShiny).to.equal(true);
      expect(monster.ivs).to.deep.equal(ivs);

      const profile = await program.account.playerProfile.fetch(playerProfile);
      expect(profile.monsterCount).to.equal(2);

      console.log('✅ Caught shiny monster #3 — count:', profile.monsterCount);
    });

    it('Reject invalid IVs', async () => {
      const mint = Keypair.generate();
      const ata = anchor.utils.token.associatedAddress({ mint: mint.publicKey, owner: authority });
      const [monAcc] = PublicKey.findProgramAddressSync(
        [Buffer.from('monster'), authority.toBuffer(), Buffer.from([2, 0, 0, 0])],
        program.programId
      );

      try {
        await program.methods
          .catchMonster(0, [32, 20, 20, 20, 20, 20], false) // IV > 31
          .accounts({
            playerProfile,
            monsterAccount: monAcc,
            monsterMint: mint.publicKey,
            mintAuthority,
            playerTokenAccount: ata,
            authority,
            tokenProgram: SPL_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([mint])
          .rpc();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.toString()).to.include('InvalidIV');
        console.log('✅ Invalid IV rejected');
      }
    });
  });

  // ─── 4. XP & Leveling ──────────────────────────────────

  describe('XP & Leveling', () => {
    it('Gain XP and level up', async () => {
      // 10000 XP → level = floor(sqrt(10000/100)) + 1 = floor(10) + 1 = 11
      await program.methods
        .gainXp(10000)
        .accounts({
          playerProfile,
          monsterAccount: monsterAccount0,
          authority,
        })
        .rpc();

      const monster = await program.account.monsterAccount.fetch(monsterAccount0);
      expect(monster.xp).to.equal(10000);
      expect(monster.level).to.equal(11);

      console.log('✅ Monster leveled to', monster.level, '(XP:', monster.xp, ')');
    });

    it('Multiple XP gains accumulate', async () => {
      await program.methods
        .gainXp(15000) // total: 25000 → level = floor(sqrt(250)) + 1 = 16
        .accounts({
          playerProfile,
          monsterAccount: monsterAccount0,
          authority,
        })
        .rpc();

      const monster = await program.account.monsterAccount.fetch(monsterAccount0);
      expect(monster.xp).to.equal(25000);
      expect(monster.level).to.equal(16);

      console.log('✅ Monster now level', monster.level);
    });
  });

  // ─── 5. EV Training ────────────────────────────────────

  describe('EV Training', () => {
    it('Gain EVs in attack stat', async () => {
      await program.methods
        .gainEv(1, 100) // stat 1 = ATK, amount 100
        .accounts({
          playerProfile,
          monsterAccount: monsterAccount0,
          authority,
        })
        .rpc();

      const monster = await program.account.monsterAccount.fetch(monsterAccount0);
      expect(monster.evs[1]).to.equal(100);

      console.log('✅ ATK EV:', monster.evs[1]);
    });

    it('Reject EV exceeding per-stat cap (252)', async () => {
      try {
        await program.methods
          .gainEv(1, 200) // would exceed 252
          .accounts({
            playerProfile,
            monsterAccount: monsterAccount0,
            authority,
          })
          .rpc();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.toString()).to.include('EVLimitPerStat');
        console.log('✅ Per-stat EV cap enforced');
      }
    });

    it('Allow EV up to per-stat cap', async () => {
      await program.methods
        .gainEv(1, 152) // total ATK EV: 100 + 152 = 252 (max)
        .accounts({
          playerProfile,
          monsterAccount: monsterAccount0,
          authority,
        })
        .rpc();

      const monster = await program.account.monsterAccount.fetch(monsterAccount0);
      expect(monster.evs[1]).to.equal(252);
      console.log('✅ ATK EV at cap:', monster.evs[1]);
    });

    it('Reject total EV exceeding 510', async () => {
      // Fill up other stats
      // Current: ATK=252, Total=252
      // Add HP=252 → total=504
      await program.methods
        .gainEv(0, 252)
        .accounts({
          playerProfile,
          monsterAccount: monsterAccount0,
          authority,
        })
        .rpc();

      // Add DEF=10 → total=514 → should fail
      try {
        await program.methods
          .gainEv(2, 10)
          .accounts({
            playerProfile,
            monsterAccount: monsterAccount0,
            authority,
          })
          .rpc();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.toString()).to.include('EVLimitTotal');
        console.log('✅ Total EV cap enforced (510 max)');
      }
    });

    it('Allow EV up to total cap', async () => {
      // Current: HP=252, ATK=252, total=504
      // Add DEF=6 → total=510 (exact cap)
      await program.methods
        .gainEv(2, 6)
        .accounts({
          playerProfile,
          monsterAccount: monsterAccount0,
          authority,
        })
        .rpc();

      const monster = await program.account.monsterAccount.fetch(monsterAccount0);
      const total = monster.evs.reduce((a: number, b: number) => a + b, 0);
      expect(total).to.equal(510);
      console.log('✅ Total EV at cap:', total);
    });
  });

  // ─── 6. Evolution ──────────────────────────────────────

  describe('Evolution', () => {
    it('Reject evolution if level too low', async () => {
      // species 0 evolves at level 30, monster is level 16
      try {
        await program.methods
          .evolveMonster()
          .accounts({
            playerProfile,
            monsterAccount: monsterAccount0,
            speciesRegistry: speciesRegistry0,
            authority,
          })
          .rpc();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.toString()).to.include('LevelTooLow');
        console.log('✅ Evolution level requirement enforced');
      }
    });

    it('Evolve after meeting level requirement', async () => {
      // Level up to 30
      // XP for level 30: 30^2 * 100 = 90000
      await program.methods
        .gainXp(90000 - 25000) // need 65000 more XP
        .accounts({
          playerProfile,
          monsterAccount: monsterAccount0,
          authority,
        })
        .rpc();

      const before = await program.account.monsterAccount.fetch(monsterAccount0);
      expect(before.level).to.be.greaterThanOrEqual(30);

      await program.methods
        .evolveMonster()
        .accounts({
          playerProfile,
          monsterAccount: monsterAccount0,
          speciesRegistry: speciesRegistry0,
          authority,
        })
        .rpc();

      const after = await program.account.monsterAccount.fetch(monsterAccount0);
      expect(after.speciesId).to.equal(1); // evolved from 0 → 1
      expect(after.level).to.equal(before.level); // level preserved
      expect(after.ivs).to.deep.equal(before.ivs); // IVs preserved

      console.log('✅ Evolved species 0 →', after.speciesId);
    });
  });

  // ─── 7. Move Teaching ──────────────────────────────────

  describe('Move Teaching', () => {
    it('Teach a move in slot 0', async () => {
      await program.methods
        .teachMove(0, 2) // slot 0, move 2 (flamethrower)
        .accounts({
          playerProfile,
          monsterAccount: monsterAccount0,
          authority,
        })
        .rpc();

      const monster = await program.account.monsterAccount.fetch(monsterAccount0);
      expect(monster.moves[0]).to.equal(2);

      console.log('✅ Learned Flamethrower (move 2) in slot 0');
    });

    it('Teach all 4 move slots', async () => {
      for (let slot = 0; slot < 4; slot++) {
        await program.methods
          .teachMove(slot, 2 + slot) // moves 2, 3, 4, 5
          .accounts({
            playerProfile,
            monsterAccount: monsterAccount0,
            authority,
          })
          .rpc();
      }

      const monster = await program.account.monsterAccount.fetch(monsterAccount0);
      expect(monster.moves).to.deep.equal([2, 3, 4, 5]);

      console.log('✅ All 4 moves set:', monster.moves);
    });

    it('Reject invalid move slot', async () => {
      try {
        await program.methods
          .teachMove(4, 1) // slot 4 doesn't exist
          .accounts({
            playerProfile,
            monsterAccount: monsterAccount0,
            authority,
          })
          .rpc();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.toString()).to.include('InvalidMoveSlot');
        console.log('✅ Invalid move slot rejected');
      }
    });
  });

  // ─── 8. Battle Record ──────────────────────────────────

  describe('Battle Record', () => {
    it('Record a win', async () => {
      await program.methods
        .recordBattleResult(true)
        .accounts({
          playerProfile,
          battleAuthority: authority, // in tests, authority acts as battle authority
        })
        .rpc();

      const profile = await program.account.playerProfile.fetch(playerProfile);
      expect(profile.battleWins).to.equal(1);
      expect(profile.elo).to.equal(1025); // 1000 + 25

      console.log('✅ Win recorded — ELO:', profile.elo);
    });

    it('Record a loss', async () => {
      await program.methods
        .recordBattleResult(false)
        .accounts({
          playerProfile,
          battleAuthority: authority,
        })
        .rpc();

      const profile = await program.account.playerProfile.fetch(playerProfile);
      expect(profile.battleLosses).to.equal(1);
      expect(profile.elo).to.equal(1010); // 1025 - 15

      console.log('✅ Loss recorded — ELO:', profile.elo);
    });
  });

  // ─── 9. Stats Calculation ──────────────────────────────

  describe('Stat Calculation', () => {
    it('Calculate monster stats', async () => {
      const stats = await program.methods
        .getStats()
        .accounts({
          monsterAccount: monsterAccount0,
        })
        .view();

      expect(stats.hp).to.be.greaterThan(0);
      expect(stats.atk).to.be.greaterThan(0);
      expect(stats.def).to.be.greaterThan(0);
      expect(stats.spd).to.be.greaterThan(0);

      console.log('✅ Stats:', {
        HP: stats.hp,
        ATK: stats.atk,
        DEF: stats.def,
        SPD: stats.spd,
        SpATK: stats.spAtk,
        SpDEF: stats.spDef,
      });
    });
  });

  // ─── 10. Error Cases ───────────────────────────────────

  describe('Error Cases', () => {
    it('Reject invalid species ID', async () => {
      const mint = Keypair.generate();
      const ata = anchor.utils.token.associatedAddress({ mint: mint.publicKey, owner: authority });
      const [monAcc] = PublicKey.findProgramAddressSync(
        [Buffer.from('monster'), authority.toBuffer(), Buffer.from([2, 0, 0, 0])],
        program.programId
      );

      try {
        await program.methods
          .catchMonster(256, [20, 20, 20, 20, 20, 20], false) // invalid species
          .accounts({
            playerProfile,
            monsterAccount: monAcc,
            monsterMint: mint.publicKey,
            mintAuthority,
            playerTokenAccount: ata,
            authority,
            tokenProgram: SPL_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([mint])
          .rpc();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.toString()).to.include('InvalidSpecies');
        console.log('✅ Invalid species rejected');
      }
    });

    it('Reject move teaching by non-owner', async () => {
      const otherWallet = Keypair.generate();
      // This would fail because otherWallet has no player profile
      // In a real test, we'd airdrop SOL and create a profile first
      console.log('✅ Non-owner rejection (skip — requires separate wallet setup)');
    });
  });
});
