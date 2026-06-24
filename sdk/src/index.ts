import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID as SPL_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';

// Program IDs
export const CREATURE_PROGRAM_ID = new PublicKey('Crea1111111111111111111111111111111111111111');
export const BATTLE_PROGRAM_ID = new PublicKey('Batt1e1111111111111111111111111111111111111111');
export const TOKEN_PROGRAM_ID = new PublicKey('TokeN11111111111111111111111111111111111111111');
export const MARKETPLACE_PROGRAM_ID = new PublicKey('Marke7111111111111111111111111111111111111111');

// PDA derivation helpers
export function derivePlayerProfile(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('profile'), authority.toBuffer()],
    CREATURE_PROGRAM_ID
  );
}

export function deriveMonsterAccount(authority: PublicKey, index: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('monster'),
      authority.toBuffer(),
      new BN(index).toArrayLike(Buffer, 'le', 4),
    ],
    CREATURE_PROGRAM_ID
  );
}

export function deriveBattleSession(player1: PublicKey, timestamp: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('battle'),
      player1.toBuffer(),
      new BN(timestamp).toArrayLike(Buffer, 'le', 8),
    ],
    BATTLE_PROGRAM_ID
  );
}

export function deriveListing(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('listing'), mint.toBuffer()],
    MARKETPLACE_PROGRAM_ID
  );
}

export function deriveTokenConfig(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('token-config')],
    TOKEN_PROGRAM_ID
  );
}

export function deriveSolmonMint(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('solmon-mint')],
    TOKEN_PROGRAM_ID
  );
}

export function deriveSoltreatMint(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('soltreat-mint')],
    TOKEN_PROGRAM_ID
  );
}

export function deriveTokenAuthority(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('token-authority')],
    TOKEN_PROGRAM_ID
  );
}

export function deriveSpeciesRegistry(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('registry')],
    CREATURE_PROGRAM_ID
  );
}

/**
 * SOLMON Client — high-level wrapper for all 4 programs
 */
export class SolmonClient {
  constructor(
    private provider: AnchorProvider,
    private creatureProgram: Program,
    private battleProgram: Program,
    private tokenProgram: Program,
    private marketplaceProgram: Program
  ) {}

  // ─── Creature Methods ─────────────────────────

  async initializePlayer(authority: PublicKey) {
    const [profile] = derivePlayerProfile(authority);
    return this.creatureProgram.methods
      .initializePlayer()
      .accounts({
        playerProfile: profile,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async catchMonster(authority: PublicKey, speciesId: number, ivs: number[], isShiny: boolean) {
    const [profile] = derivePlayerProfile(authority);
    const profileData = await this.creatureProgram.account.playerProfile.fetch(profile);
    const [monster] = deriveMonsterAccount(authority, profileData.monsterCount as number);

    return this.creatureProgram.methods
      .catchMonster(speciesId, ivs, isShiny)
      .accounts({
        playerProfile: profile,
        monsterAccount: monster,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async gainXp(authority: PublicKey, monsterPubkey: PublicKey, amount: number) {
    const [profile] = derivePlayerProfile(authority);
    return this.creatureProgram.methods
      .gainXp(amount)
      .accounts({
        playerProfile: profile,
        monsterAccount: monsterPubkey,
        authority,
      })
      .rpc();
  }

  async evolveMonster(authority: PublicKey, monsterPubkey: PublicKey) {
    const [profile] = derivePlayerProfile(authority);
    const [registry] = deriveSpeciesRegistry();
    return this.creatureProgram.methods
      .evolveMonster()
      .accounts({
        playerProfile: profile,
        monsterAccount: monsterPubkey,
        speciesRegistry: registry,
        authority,
      })
      .rpc();
  }

  // ─── Battle Methods ───────────────────────────

  async createBattle(player1: PublicKey, wager: number) {
    const timestamp = Math.floor(Date.now() / 1000);
    const [battle] = deriveBattleSession(player1, timestamp);

    return this.battleProgram.methods
      .createBattle(new BN(wager))
      .accounts({
        battleSession: battle,
        player1,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async commitMove(player: PublicKey, battlePubkey: PublicKey, commitment: number[]) {
    return this.battleProgram.methods
      .commitMove(commitment)
      .accounts({
        battleSession: battlePubkey,
        player,
      })
      .rpc();
  }

  async revealMove(
    player: PublicKey,
    battlePubkey: PublicKey,
    moveSlot: number,
    target: number,
    salt: number[]
  ) {
    return this.battleProgram.methods
      .revealMove(moveSlot, target, salt)
      .accounts({
        battleSession: battlePubkey,
        player,
      })
      .rpc();
  }

  // ─── Marketplace Methods ──────────────────────

  async listMonster(seller: PublicKey, monsterPubkey: PublicKey, price: number) {
    const [listing] = deriveListing(monsterPubkey);
    return this.marketplaceProgram.methods
      .listMonster(new BN(price))
      .accounts({
        listing,
        monster: monsterPubkey,
        seller,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async buyMonster(buyer: PublicKey, listingPubkey: PublicKey, seller: PublicKey, treasury: PublicKey) {
    return this.marketplaceProgram.methods
      .buyMonster()
      .accounts({
        listing: listingPubkey,
        seller,
        treasury,
        buyer,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }
}
