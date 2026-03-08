/**
 * services/solana.ts
 * ─────────────────────────────────────────────────────────────────
 * All on-chain Solana logic for CLASH on testnet.
 *
 * ESCROW STRATEGY (no Rust program needed):
 *   - Each challenge gets a deterministic keypair via
 *     Keypair.fromSeed(sha256("clash-escrow:" + challengeId))
 *   - Creator sends SOL → escrow address (plain SystemProgram transfer)
 *   - Opponent sends SOL → same escrow address
 *   - Winner claims: escrow keypair signs a transfer back to winner
 *     (escrow seed is reconstructed server-side / in-app from challengeId)
 *
 * This is real on-chain SOL — verifiable on Solana Explorer testnet.
 * ─────────────────────────────────────────────────────────────────
 */

import {
  clusterApiUrl,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';

// ── Config ────────────────────────────────────────────────────────
export const NETWORK    = 'testnet';
export const RPC_URL    = clusterApiUrl('testnet');
export const EXPLORER   = 'https://explorer.solana.com';
export const connection = new Connection(RPC_URL, 'confirmed');

// SKR mint on testnet (use this for demo; on mainnet swap to real SKR mint)
export const SKR_MINT_DEVNET = 'So11111111111111111111111111111111111111112'; // wrapped SOL as placeholder
// Real SKR mainnet mint (for reference / switch on launch):
export const SKR_MINT_MAINNET = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';

// App identity for MWA
export const APP_IDENTITY = {
  name:   'CLASH',
  uri:    'https://clash.app',
  icon:   'assets/icon.png',
};

// ── Types ─────────────────────────────────────────────────────────
export interface EscrowInfo {
  address:    string;
  balance:    number;   // in SOL
  lamports:   number;
}

export interface OnChainResult {
  signature: string;
  explorerUrl: string;
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Derive a deterministic escrow keypair from a challengeId.
 * Uses first 32 bytes of UTF-8 encoded seed string.
 * Same challengeId → same escrow address every time.
 */
export function getEscrowKeypair(challengeId: string): Keypair {
  const seed = `clash-escrow:${challengeId}`;
  // Pad/truncate to exactly 32 bytes
  const seedBytes = new Uint8Array(32);
  const encoded   = new TextEncoder().encode(seed);
  seedBytes.set(encoded.slice(0, 32));
  return Keypair.fromSeed(seedBytes);
}

export function getEscrowAddress(challengeId: string): string {
  return getEscrowKeypair(challengeId).publicKey.toBase58();
}

export function explorerUrl(signature: string): string {
  return `${EXPLORER}/tx/${signature}?cluster=testnet`;
}

export function accountUrl(address: string): string {
  return `${EXPLORER}/address/${address}?cluster=testnet`;
}

// ── SOL Balance ───────────────────────────────────────────────────

export async function getSOLBalance(pubkeyStr: string): Promise<number> {
  try {
    const pk       = new PublicKey(pubkeyStr);
    const lamports = await connection.getBalance(pk);
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

// ── Escrow Info ───────────────────────────────────────────────────

export async function getEscrowInfo(challengeId: string): Promise<EscrowInfo> {
  const kp       = getEscrowKeypair(challengeId);
  const addr     = kp.publicKey.toBase58();
  try {
    const lamports = await connection.getBalance(kp.publicKey);
    return { address: addr, balance: lamports / LAMPORTS_PER_SOL, lamports };
  } catch {
    return { address: addr, balance: 0, lamports: 0 };
  }
}

// ── Airdrop (testnet only) ─────────────────────────────────────────

export async function requestAirdrop(pubkeyStr: string, solAmount = 1): Promise<string> {
  const pk  = new PublicKey(pubkeyStr);
  const sig = await connection.requestAirdrop(pk, solAmount * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

// ── Build deposit transaction ─────────────────────────────────────
/**
 * Build an unsigned VersionedTransaction that transfers `solAmount`
 * from `fromPubkey` to the challenge's escrow address.
 * The MWA wallet will sign and send this.
 */
export async function buildDepositTransaction(
  fromPubkeyStr: string,
  challengeId:   string,
  solAmount:     number,
): Promise<Transaction> {
  const fromPubkey   = new PublicKey(fromPubkeyStr);
  const escrowPubkey = getEscrowKeypair(challengeId).publicKey;
  const lamports     = Math.round(solAmount * LAMPORTS_PER_SOL);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  // Use legacy Transaction — wider MWA wallet compatibility than VersionedTransaction
  const tx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: fromPubkey,
  }).add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey: escrowPubkey,
      lamports,
    })
  );

  return tx;
}

// ── Claim (escrow → winner) ───────────────────────────────────────
/**
 * Transfer all SOL from escrow to the winner.
 * The escrow keypair is deterministic, so we can sign server-side.
 *
 * In production: this would be gated behind vote verification.
 * For demo: called after winner_id is set in DB.
 */
export async function claimEscrow(
  challengeId: string,
  winnerPubkeyStr: string,
): Promise<OnChainResult> {
  const escrowKp     = getEscrowKeypair(challengeId);
  const winnerPubkey = new PublicKey(winnerPubkeyStr);

  const lamports = await connection.getBalance(escrowKp.publicKey);
  if (lamports === 0) throw new Error('Escrow is empty');

  // Keep enough for tx fee (~5000 lamports)
  const FEE           = 5_000;
  const sendLamports  = lamports - FEE;
  if (sendLamports <= 0) throw new Error('Escrow balance too low to cover fees');

  const { blockhash } = await connection.getLatestBlockhash();

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: escrowKp.publicKey,
      toPubkey:   winnerPubkey,
      lamports:   sendLamports,
    })
  );
  tx.recentBlockhash = blockhash;
  tx.feePayer        = escrowKp.publicKey;
  tx.sign(escrowKp);

  const raw = tx.serialize();
  const sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
  await connection.confirmTransaction(sig, 'confirmed');

  return { signature: sig, explorerUrl: explorerUrl(sig) };
}

// ── Confirm transaction ───────────────────────────────────────────

export async function confirmTx(signature: string): Promise<boolean> {
  try {
    const result = await connection.confirmTransaction(signature, 'confirmed');
    return !result.value.err;
  } catch {
    return false;
  }
}

// ── Check if escrow is funded ─────────────────────────────────────

export async function isEscrowFunded(
  challengeId: string,
  expectedSol: number,
  tolerance = 0.001,
): Promise<boolean> {
  const info = await getEscrowInfo(challengeId);
  return info.balance >= expectedSol - tolerance;
}

// ── Get transaction details ───────────────────────────────────────

export async function getTransaction(signature: string) {
  try {
    return await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
  } catch {
    return null;
  }
}

// ── Refund multiple depositors (Model B pool) ─────────────────────
/**
 * Refund each participant their entry fee from the escrow.
 * Used when a pool challenge expires without enough participants.
 */
export async function refundDepositors(
  challengeId: string,
  depositors: { wallet: string; amount: number }[],
): Promise<OnChainResult[]> {
  const escrowKp  = getEscrowKeypair(challengeId);
  const results: OnChainResult[] = [];

  for (const { wallet, amount } of depositors) {
    try {
      const lamports = Math.round(amount * LAMPORTS_PER_SOL);
      const { blockhash } = await connection.getLatestBlockhash();

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: escrowKp.publicKey,
          toPubkey:   new PublicKey(wallet),
          lamports,
        })
      );
      tx.recentBlockhash = blockhash;
      tx.feePayer        = escrowKp.publicKey;
      tx.sign(escrowKp);

      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(sig, 'confirmed');
      results.push({ signature: sig, explorerUrl: explorerUrl(sig) });
    } catch (e) {
      console.warn(`Refund failed for ${wallet}:`, e);
    }
  }

  return results;
}