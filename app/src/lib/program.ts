import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { useMemo } from 'react';

// Program IDs (match Anchor.toml)
export const CREATURE_PROGRAM_ID = new PublicKey('9pP6oaHmPuHWk9Avy6tE2K6gemLHZhfiijsozLwAuHUT');
export const BATTLE_PROGRAM_ID = new PublicKey('FUuaci6rg82xpM3WGYpCiYPsfSZutJ5iYNKD3868DvUp');
export const TOKEN_PROGRAM_ID = new PublicKey('Bdu6eyg4mNwh7Cw3bGqKrECDhgGxL4HaHFn7GsB7kCd4');
export const MARKETPLACE_PROGRAM_ID = new PublicKey('BKDu81cQTzPtvyH1xZjMSkqshEqjxujJvHSg5cf6Cxm7');

// PDA seeds
export const PROFILE_SEED = 'profile';
export const MONSTER_SEED = 'monster';
export const BATTLE_SEED = 'battle';
export const REGISTRY_SEED = 'registry';
export const LISTING_SEED = 'listing';
export const TOKEN_CONFIG_SEED = 'token-config';

/**
 * Derive player profile PDA
 */
export function derivePlayerProfile(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PROFILE_SEED), authority.toBuffer()],
    CREATURE_PROGRAM_ID
  );
}

/**
 * Derive monster account PDA
 */
export function deriveMonsterAccount(
  authority: PublicKey,
  monsterIndex: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(MONSTER_SEED),
      authority.toBuffer(),
      new BN(monsterIndex).toArrayLike(Buffer, 'le', 4),
    ],
    CREATURE_PROGRAM_ID
  );
}

/**
 * Derive battle session PDA
 */
export function deriveBattleSession(
  player1: PublicKey,
  timestamp: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(BATTLE_SEED),
      player1.toBuffer(),
      new BN(timestamp).toArrayLike(Buffer, 'le', 8),
    ],
    BATTLE_PROGRAM_ID
  );
}

/**
 * Derive listing PDA
 */
export function deriveListing(monsterOrMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(LISTING_SEED), monsterOrMint.toBuffer()],
    MARKETPLACE_PROGRAM_ID
  );
}

/**
 * Derive token config PDA
 */
export function deriveTokenConfig(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TOKEN_CONFIG_SEED)],
    TOKEN_PROGRAM_ID
  );
}

/**
 * Hash move for commit-reveal: SHA256(moveSlot + target + salt)
 */
export async function hashMove(moveSlot: number, target: number, salt: Uint8Array): Promise<Uint8Array> {
  const preimage = new Uint8Array(34);
  preimage[0] = moveSlot;
  preimage[1] = target;
  preimage.set(salt, 2);

  const hashBuffer = await crypto.subtle.digest('SHA-256', preimage);
  return new Uint8Array(hashBuffer);
}

/**
 * Generate random salt for commit-reveal
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}
