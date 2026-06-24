import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { expect } from 'chai';

// These will be populated by anchor test
describe('SOLMON', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const creatureProgram = anchor.workspace.SolmonCreature;
  const battleProgram = anchor.workspace.SolmonBattle;

  const authority = provider.wallet;

  // Derive PDAs
  const [playerProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from('profile'), authority.publicKey.toBuffer()],
    creatureProgram.programId
  );

  const [speciesRegistry] = PublicKey.findProgramAddressSync(
    [Buffer.from('registry')],
    creatureProgram.programId
  );

  describe('Creature Program', () => {
    it('Initialize player profile', async () => {
      const tx = await creatureProgram.methods
        .initializePlayer()
        .accounts({
          playerProfile,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const profile = await creatureProgram.account.playerProfile.fetch(playerProfile);
      expect(profile.authority.toString()).to.equal(authority.publicKey.toString());
      expect(profile.monsterCount).to.equal(0);
      expect(profile.elo).to.equal(1000);
      console.log('✅ Player initialized, ELO:', profile.elo);
    });

    it('Catch first monster', async () => {
      const [monster] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('monster'),
          authority.publicKey.toBuffer(),
          Buffer.from([0, 0, 0, 0]), // index 0
        ],
        creatureProgram.programId
      );

      const ivs = [31, 25, 20, 28, 15, 22]; // HP, ATK, DEF, SPD, SpATK, SpDEF

      await creatureProgram.methods
        .catchMonster(0, ivs, false)
        .accounts({
          playerProfile,
          monsterAccount: monster,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const monsterData = await creatureProgram.account.monsterAccount.fetch(monster);
      expect(monsterData.speciesId).to.equal(0);
      expect(monsterData.level).to.equal(1);
      expect(monsterData.ivs).to.deep.equal(ivs);
      console.log('✅ Caught monster, species:', monsterData.speciesId);
    });

    it('Gain XP and level up', async () => {
      const [monster] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('monster'),
          authority.publicKey.toBuffer(),
          Buffer.from([0, 0, 0, 0]),
        ],
        creatureProgram.programId
      );

      await creatureProgram.methods
        .gainXp(10000) // should level up significantly
        .accounts({
          playerProfile,
          monsterAccount: monster,
          authority: authority.publicKey,
        })
        .rpc();

      const monsterData = await creatureProgram.account.monsterAccount.fetch(monster);
      expect(monsterData.level).to.be.greaterThan(1);
      console.log('✅ Monster leveled to:', monsterData.level);
    });

    it('Teach a move', async () => {
      const [monster] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('monster'),
          authority.publicKey.toBuffer(),
          Buffer.from([0, 0, 0, 0]),
        ],
        creatureProgram.programId
      );

      await creatureProgram.methods
        .teachMove(0, 1) // slot 0, move ID 1
        .accounts({
          playerProfile,
          monsterAccount: monster,
          authority: authority.publicKey,
        })
        .rpc();

      const monsterData = await creatureProgram.account.monsterAccount.fetch(monster);
      expect(monsterData.moves[0]).to.equal(1);
      console.log('✅ Learned move 1 in slot 0');
    });
  });

  describe('Battle Program', () => {
    it('Create battle session', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const [battle] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('battle'),
          authority.publicKey.toBuffer(),
          new anchor.BN(timestamp).toArrayLike(Buffer, 'le', 8),
        ],
        battleProgram.programId
      );

      await battleProgram.methods
        .createBattle(new anchor.BN(0)) // no wager
        .accounts({
          battleSession: battle,
          player1: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const battleData = await battleProgram.account.battleSession.fetch(battle);
      expect(battleData.player1.toString()).to.equal(authority.publicKey.toString());
      expect(battleData.wager.toNumber()).to.equal(0);
      console.log('✅ Battle created');
    });
  });
});
