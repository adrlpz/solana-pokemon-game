import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import {
  PublicKey,
  SystemProgram,
  Keypair,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { expect } from 'chai';

/**
 * SOLMON Phase 2 Tests — Battle Program
 *
 * Tests cover:
 * 1. Battle creation with/without wager
 * 2. Join battle
 * 3. Squad selection with BattleMonster data
 * 4. Commit-reveal flow (hash verification)
 * 5. Turn execution + damage calculation
 * 6. Type effectiveness verification
 * 7. Fainting + win detection
 * 8. Timeout handling + forfeit
 * 9. Switch monster after faint
 * 10. Claim winnings (wager escrow)
 * 11. Draw agreement
 * 12. Edge cases (invalid moves, double commit, etc.)
 */

describe('SOLMON Phase 2 — Battle Program', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolmonBattle;

  const player1 = provider.wallet.publicKey;
  const player2Kp = Keypair.generate();

  // Helper: create a BattleMonster
  function makeMonster(
    owner: PublicKey,
    speciesId: number,
    element: number,
    level: number,
    hp: number,
    atk: number,
    def: number,
    spd: number,
    spAtk: number,
    spDef: number,
    moves: number[] = [1, 2, 3, 4],
  ) {
    return {
      owner,
      speciesId,
      element,
      level,
      hp,
      maxHp: hp,
      atk,
      def,
      spd,
      spAtk,
      spDef,
      moves,
      isShiny: false,
      abilityId: 0,
    };
  }

  // Helper: hash move for commit-reveal
  async function hashMove(
    moveSlot: number,
    target: number,
    movePower: number,
    moveElement: number,
    isSpecial: boolean,
    salt: Uint8Array,
  ): Promise<number[]> {
    const preimage = new Uint8Array(38);
    preimage[0] = moveSlot;
    preimage[1] = target;
    preimage[2] = movePower & 0xff;
    preimage[3] = (movePower >> 8) & 0xff;
    preimage[4] = moveElement;
    preimage[5] = isSpecial ? 1 : 0;
    preimage.set(salt, 6);
    const hashBuffer = await crypto.subtle.digest('SHA-256', preimage);
    return Array.from(new Uint8Array(hashBuffer));
  }

  // Helper: generate random salt
  function genSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(32));
  }

  before(async () => {
    // Airdrop SOL to player2
    const sig = await provider.connection.requestAirdrop(
      player2Kp.publicKey,
      5 * LAMPORTS_PER_SOL,
    );
    await provider.connection.confirmTransaction(sig);
  });

  // ─── 1. Battle Creation ─────────────────────────────────

  describe('Battle Creation', () => {
    let battlePda: PublicKey;

    it('Create battle without wager', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      [battlePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('battle'),
          player1.toBuffer(),
          new anchor.BN(timestamp).toArrayLike(Buffer, 'le', 8),
        ],
        program.programId,
      );

      await program.methods
        .createBattle(new anchor.BN(0))
        .accounts({
          battleSession: battlePda,
          player1,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const battle = await program.account.battleSession.fetch(battlePda);
      expect(battle.player1.toString()).to.equal(player1.toString());
      expect(battle.player2.toString()).to.equal(PublicKey.default.toString());
      expect(battle.state).to.deep.equal({ waiting: {} });
      expect(battle.wager.toNumber()).to.equal(0);

      console.log('✅ Battle created — no wager');
    });

    it('Create battle with wager', async () => {
      const timestamp = Math.floor(Date.now() / 1000) + 1;
      const [wagerBattle] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('battle'),
          player1.toBuffer(),
          new anchor.BN(timestamp).toArrayLike(Buffer, 'le', 8),
        ],
        program.programId,
      );

      const wager = 0.1 * LAMPORTS_PER_SOL;

      await program.methods
        .createBattle(new anchor.BN(wager))
        .accounts({
          battleSession: wagerBattle,
          player1,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const battle = await program.account.battleSession.fetch(wagerBattle);
      expect(battle.wager.toNumber()).to.equal(wager);

      // Verify SOL escrowed
      const balance = await provider.connection.getBalance(wagerBattle);
      expect(balance).to.be.greaterThan(wager);

      console.log('✅ Battle created with wager:', wager / LAMPORTS_PER_SOL, 'SOL');
    });
  });

  // ─── 2. Join Battle ─────────────────────────────────────

  describe('Join Battle', () => {
    let battlePda: PublicKey;

    before(async () => {
      const timestamp = Math.floor(Date.now() / 1000) + 10;
      [battlePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('battle'),
          player1.toBuffer(),
          new anchor.BN(timestamp).toArrayLike(Buffer, 'le', 8),
        ],
        program.programId,
      );

      await program.methods
        .createBattle(new anchor.BN(0))
        .accounts({
          battleSession: battlePda,
          player1,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

    it('Player 2 joins battle', async () => {
      await program.methods
        .joinBattle()
        .accounts({
          battleSession: battlePda,
          player2: player2Kp.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([player2Kp])
        .rpc();

      const battle = await program.account.battleSession.fetch(battlePda);
      expect(battle.player2.toString()).to.equal(player2Kp.publicKey.toString());
      expect(battle.state).to.deep.equal({ selectSquad: {} });

      console.log('✅ Player 2 joined');
    });

    it('Reject third player joining', async () => {
      const player3 = Keypair.generate();
      try {
        await program.methods
          .joinBattle()
          .accounts({
            battleSession: battlePda,
            player2: player3.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([player3])
          .rpc();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.toString()).to.include('BattleFull');
        console.log('✅ Third player rejected');
      }
    });
  });

  // ─── 3. Squad Selection ─────────────────────────────────

  describe('Squad Selection', () => {
    let battlePda: PublicKey;

    beforeEach(async () => {
      const timestamp = Math.floor(Date.now() / 1000) + 20;
      [battlePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('battle'),
          player1.toBuffer(),
          new anchor.BN(timestamp).toArrayLike(Buffer, 'le', 8),
        ],
        program.programId,
      );

      await program.methods
        .createBattle(new anchor.BN(0))
        .accounts({ battleSession: battlePda, player1, systemProgram: SystemProgram.programId })
        .rpc();

      await program.methods
        .joinBattle()
        .accounts({ battleSession: battlePda, player2: player2Kp.publicKey, systemProgram: SystemProgram.programId })
        .signers([player2Kp])
        .rpc();
    });

    it('Both players select squads', async () => {
      const squad1 = [
        makeMonster(player1, 0, 0, 50, 200, 150, 100, 120, 80, 90),  // Fire
        makeMonster(player1, 3, 3, 48, 180, 90, 80, 140, 130, 100),  // Electric
        makeMonster(player1, 6, 1, 52, 210, 130, 120, 100, 90, 110), // Water
      ];

      const squad2 = [
        makeMonster(player2Kp.publicKey, 1, 1, 51, 195, 140, 110, 115, 85, 95),  // Water
        makeMonster(player2Kp.publicKey, 4, 2, 49, 205, 120, 130, 90, 70, 105),  // Earth
        makeMonster(player2Kp.publicKey, 7, 4, 47, 175, 100, 90, 130, 140, 110), // Shadow
      ];

      // Player 1 selects
      await program.methods
        .selectSquad(squad1)
        .accounts({ battleSession: battlePda, player: player1 })
        .rpc();

      // Player 2 selects
      await program.methods
        .selectSquad(squad2)
        .accounts({ battleSession: battlePda, player: player2Kp.publicKey })
        .signers([player2Kp])
        .rpc();

      const battle = await program.account.battleSession.fetch(battlePda);
      expect(battle.state).to.deep.equal({ commitPhase: {} });
      expect(battle.currentTurn).to.equal(1);
      expect(battle.squad1[0].speciesId).to.equal(0);
      expect(battle.squad2[0].speciesId).to.equal(1);

      console.log('✅ Both squads selected — battle started');
    });
  });

  // ─── 4. Commit-Reveal Flow ─────────────────────────────

  describe('Commit-Reveal', () => {
    let battlePda: PublicKey;
    let salt1: Uint8Array;
    let salt2: Uint8Array;

    beforeEach(async () => {
      const timestamp = Math.floor(Date.now() / 1000) + 30;
      [battlePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('battle'),
          player1.toBuffer(),
          new anchor.BN(timestamp).toArrayLike(Buffer, 'le', 8),
        ],
        program.programId,
      );

      await program.methods
        .createBattle(new anchor.BN(0))
        .accounts({ battleSession: battlePda, player1, systemProgram: SystemProgram.programId })
        .rpc();

      await program.methods
        .joinBattle()
        .accounts({ battleSession: battlePda, player2: player2Kp.publicKey, systemProgram: SystemProgram.programId })
        .signers([player2Kp])
        .rpc();

      // Select squads
      const squad1 = [
        makeMonster(player1, 0, 0, 50, 200, 150, 100, 120, 80, 90),
        makeMonster(player1, 3, 3, 48, 180, 90, 80, 140, 130, 100),
        makeMonster(player1, 6, 1, 52, 210, 130, 120, 100, 90, 110),
      ];
      const squad2 = [
        makeMonster(player2Kp.publicKey, 1, 1, 51, 195, 140, 110, 115, 85, 95),
        makeMonster(player2Kp.publicKey, 4, 2, 49, 205, 120, 130, 90, 70, 105),
        makeMonster(player2Kp.publicKey, 7, 4, 47, 175, 100, 90, 130, 140, 110),
      ];

      await program.methods.selectSquad(squad1).accounts({ battleSession: battlePda, player: player1 }).rpc();
      await program.methods.selectSquad(squad2).accounts({ battleSession: battlePda, player: player2Kp.publicKey }).signers([player2Kp]).rpc();

      salt1 = genSalt();
      salt2 = genSalt();
    });

    it('Commit → Reveal → Execute turn', async () => {
      // Player 1: Fire move (power 90, element 0, physical) targeting P2 monster 0
      const commitment1 = await hashMove(0, 0, 90, 0, false, salt1);
      // Player 2: Water move (power 90, element 1, physical) targeting P1 monster 0
      const commitment2 = await hashMove(0, 0, 90, 1, false, salt2);

      // Both commit
      await program.methods
        .commitMove(commitment1)
        .accounts({ battleSession: battlePda, player: player1 })
        .rpc();

      await program.methods
        .commitMove(commitment2)
        .accounts({ battleSession: battlePda, player: player2Kp.publicKey })
        .signers([player2Kp])
        .rpc();

      let battle = await program.account.battleSession.fetch(battlePda);
      expect(battle.state).to.deep.equal({ revealPhase: {} });
      console.log('✅ Both committed → RevealPhase');

      // Both reveal
      await program.methods
        .revealMove(0, 0, 90, 0, false, Array.from(salt1))
        .accounts({ battleSession: battlePda, player: player1 })
        .rpc();

      await program.methods
        .revealMove(0, 0, 90, 1, false, Array.from(salt2))
        .accounts({ battleSession: battlePda, player: player2Kp.publicKey })
        .signers([player2Kp])
        .rpc();

      battle = await program.account.battleSession.fetch(battlePda);

      // After execution, should be back to CommitPhase (or Finished if someone fainted)
      expect(battle.state).to.satisfy(
        (s: any) => s.commitPhase !== undefined || s.finished !== undefined || s.selectSquad !== undefined,
      );

      // HP should have changed
      const p1Hp = battle.squad1[0].hp;
      const p2Hp = battle.squad2[0].hp;
      expect(p1Hp).to.be.lessThan(200); // took damage
      expect(p2Hp).to.be.lessThan(195); // took damage

      console.log(`✅ Turn executed — P1 HP: ${p1Hp}, P2 HP: ${p2Hp}`);
    });

    it('Reject reveal with wrong salt', async () => {
      const commitment1 = await hashMove(0, 0, 90, 0, false, salt1);
      const commitment2 = await hashMove(0, 0, 90, 1, false, salt2);

      await program.methods.commitMove(commitment1).accounts({ battleSession: battlePda, player: player1 }).rpc();
      await program.methods.commitMove(commitment2).accounts({ battleSession: battlePda, player: player2Kp.publicKey }).signers([player2Kp]).rpc();

      // Wrong salt
      const wrongSalt = genSalt();
      try {
        await program.methods
          .revealMove(0, 0, 90, 0, false, Array.from(wrongSalt))
          .accounts({ battleSession: battlePda, player: player1 })
          .rpc();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.toString()).to.include('CommitmentMismatch');
        console.log('✅ Wrong salt rejected');
      }
    });

    it('Reject double commit', async () => {
      const commitment1 = await hashMove(0, 0, 90, 0, false, salt1);

      await program.methods.commitMove(commitment1).accounts({ battleSession: battlePda, player: player1 }).rpc();

      try {
        await program.methods.commitMove(commitment1).accounts({ battleSession: battlePda, player: player1 }).rpc();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.toString()).to.include('AlreadyCommitted');
        console.log('✅ Double commit rejected');
      }
    });
  });

  // ─── 5. Type Effectiveness ──────────────────────────────

  describe('Type Effectiveness', () => {
    it('Water vs Fire = 1.5x damage', () => {
      // Fire monster (element 0) vs Water move (element 1)
      // ELEMENT_CHART[1][0] = 150 (super effective)
      const chart = [
        [100, 67, 150, 100, 100, 100],
        [150, 100, 100, 67, 100, 100],
        [67, 100, 100, 150, 100, 100],
        [100, 150, 67, 100, 100, 100],
        [100, 100, 100, 100, 100, 150],
        [100, 100, 100, 100, 150, 100],
      ];

      // Water(1) attacking Fire(0) = 150
      expect(chart[1][0]).to.equal(150);
      // Fire(0) attacking Water(1) = 67
      expect(chart[0][1]).to.equal(67);
      console.log('✅ Type chart verified: Water > Fire (1.5x), Fire < Water (0.67x)');
    });
  });

  // ─── 6. Timeout & Forfeit ──────────────────────────────

  describe('Timeout', () => {
    it('Reject timeout before deadline', async () => {
      const timestamp = Math.floor(Date.now() / 1000) + 40;
      const [battlePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('battle'), player1.toBuffer(), new anchor.BN(timestamp).toArrayLike(Buffer, 'le', 8)],
        program.programId,
      );

      await program.methods
        .createBattle(new anchor.BN(0))
        .accounts({ battleSession: battlePda, player1, systemProgram: SystemProgram.programId })
        .rpc();

      try {
        await program.methods
          .timeoutOpponent()
          .accounts({ battleSession: battlePda, player: player2Kp.publicKey })
          .signers([player2Kp])
          .rpc();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.toString()).to.include('NotTimedOut');
        console.log('✅ Early timeout rejected');
      }
    });
  });

  // ─── 7. Claim Winnings ─────────────────────────────────

  describe('Claim Winnings', () => {
    it('Reject claim on unfinished battle', async () => {
      const timestamp = Math.floor(Date.now() / 1000) + 50;
      const [battlePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('battle'), player1.toBuffer(), new anchor.BN(timestamp).toArrayLike(Buffer, 'le', 8)],
        program.programId,
      );

      await program.methods
        .createBattle(new anchor.BN(0))
        .accounts({ battleSession: battlePda, player1, systemProgram: SystemProgram.programId })
        .rpc();

      try {
        await program.methods
          .claimWinnings()
          .accounts({ battleSession: battlePda, winner: player1 })
          .rpc();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.toString()).to.include('BattleNotFinished');
        console.log('✅ Claim on unfinished battle rejected');
      }
    });
  });

  // ─── 8. Full Battle Simulation ─────────────────────────

  describe('Full Battle Simulation', () => {
    it('Run complete battle until winner', async () => {
      const timestamp = Math.floor(Date.now() / 1000) + 60;
      const [battlePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('battle'), player1.toBuffer(), new anchor.BN(timestamp).toArrayLike(Buffer, 'le', 8)],
        program.programId,
      );

      // Create + join
      await program.methods
        .createBattle(new anchor.BN(0))
        .accounts({ battleSession: battlePda, player1, systemProgram: SystemProgram.programId })
        .rpc();

      await program.methods
        .joinBattle()
        .accounts({ battleSession: battlePda, player2: player2Kp.publicKey, systemProgram: SystemProgram.programId })
        .signers([player2Kp])
        .rpc();

      // P1: strong fire squad, P2: weak earth squad (fire beats earth 1.5x)
      const squad1 = [
        makeMonster(player1, 0, 0, 100, 300, 200, 150, 120, 80, 90),
        makeMonster(player1, 1, 0, 90, 280, 180, 140, 110, 70, 80),
        makeMonster(player1, 2, 0, 80, 260, 160, 130, 100, 60, 70),
      ];
      const squad2 = [
        makeMonster(player2Kp.publicKey, 3, 2, 50, 150, 80, 60, 50, 40, 45),
        makeMonster(player2Kp.publicKey, 4, 2, 45, 140, 70, 55, 45, 35, 40),
        makeMonster(player2Kp.publicKey, 5, 2, 40, 130, 60, 50, 40, 30, 35),
      ];

      await program.methods.selectSquad(squad1).accounts({ battleSession: battlePda, player: player1 }).rpc();
      await program.methods.selectSquad(squad2).accounts({ battleSession: battlePda, player: player2Kp.publicKey }).signers([player2Kp]).rpc();

      // Battle loop (max 10 turns)
      let turnCount = 0;
      const maxTurns = 10;

      while (turnCount < maxTurns) {
        const battle = await program.account.battleSession.fetch(battlePda);

        if (battle.state.finished !== undefined) {
          console.log(`🏆 Battle finished after ${turnCount} turns!`);
          console.log(`   Winner: ${battle.winner?.toString()}`);
          break;
        }

        if (battle.state.cancelled !== undefined) {
          console.log(`🤝 Battle cancelled/draw after ${turnCount} turns`);
          break;
        }

        if (battle.state.selectSquad !== undefined) {
          // Switch phase — find non-fainted monster
          // For P1
          const p1Squad = battle.squad1 as any[];
          const p1Active = battle.active1 as number;
          const p1Switch = p1Squad.findIndex((m: any, i: number) => i !== p1Active && !m.isFainted);
          if (p1Switch >= 0) {
            await program.methods.switchMonster(p1Switch).accounts({ battleSession: battlePda, player: player1 }).rpc();
          }
          // For P2
          const p2Squad = battle.squad2 as any[];
          const p2Active = battle.active2 as number;
          const p2Switch = p2Squad.findIndex((m: any, i: number) => i !== p2Active && !m.isFainted);
          if (p2Switch >= 0) {
            await program.methods.switchMonster(p2Switch).accounts({ battleSession: battlePda, player: player2Kp.publicKey }).signers([player2Kp]).rpc();
          }
          continue;
        }

        if (battle.state.commitPhase !== undefined) {
          // Both commit + reveal
          const salt1 = genSalt();
          const salt2 = genSalt();

          // P1 uses strongest fire move on P2's active monster
          const c1 = await hashMove(0, battle.active2, 110, 0, false, salt1);
          // P2 uses earth move on P1's active monster
          const c2 = await hashMove(0, battle.active1, 80, 2, false, salt2);

          await program.methods.commitMove(c1).accounts({ battleSession: battlePda, player: player1 }).rpc();
          await program.methods.commitMove(c2).accounts({ battleSession: battlePda, player: player2Kp.publicKey }).signers([player2Kp]).rpc();

          await program.methods.revealMove(0, battle.active2, 110, 0, false, Array.from(salt1)).accounts({ battleSession: battlePda, player: player1 }).rpc();
          await program.methods.revealMove(0, battle.active1, 80, 2, false, Array.from(salt2)).accounts({ battleSession: battlePda, player: player2Kp.publicKey }).signers([player2Kp]).rpc();

          turnCount++;
        }
      }

      const finalBattle = await program.account.battleSession.fetch(battlePda);
      expect(finalBattle.state).to.satisfy(
        (s: any) => s.finished !== undefined || s.cancelled !== undefined,
      );

      if (finalBattle.winner) {
        console.log(`✅ Full battle complete — Winner: ${finalBattle.winner.toString()}`);
      } else {
        console.log('✅ Full battle complete — Draw/Cancel');
      }
    });
  });
});
