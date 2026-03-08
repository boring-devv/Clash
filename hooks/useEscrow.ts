/**
 * hooks/useEscrow.ts
 * ─────────────────────────────────────────────────────────────────
 * Manages the full escrow lifecycle for a challenge:
 *   deposit → poll confirmation → claim
 *
 * Usage:
 *   const { deposit, claim, escrowInfo, status, txSig } = useEscrow(challengeId, stakeSOL);
 */
import { useWallet } from '@/context/WalletContext';
import {
    claimEscrow,
    explorerUrl,
    getEscrowInfo,
    isEscrowFunded,
    OnChainResult,
} from '@/services/solana';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';

export type EscrowStatus =
  | 'idle'
  | 'building'
  | 'signing'
  | 'confirming'
  | 'funded'
  | 'claiming'
  | 'claimed'
  | 'error';

interface EscrowState {
  status:     EscrowStatus;
  txSig:      string | null;
  errorMsg:   string | null;
  escrowAddr: string | null;
  escrowBal:  number;
}

export function useEscrow(challengeId: string | undefined, stakeSOL: number) {
  const { signAndDeposit, pubkey, isDemoMode } = useWallet();

  const [state, setState] = useState<EscrowState>({
    status:     'idle',
    txSig:      null,
    errorMsg:   null,
    escrowAddr: null,
    escrowBal:  0,
  });

  // Load escrow info on mount
  useEffect(() => {
    if (!challengeId) return;
    (async () => {
      const info = await getEscrowInfo(challengeId);
      setState(s => ({
        ...s,
        escrowAddr: info.address,
        escrowBal:  info.balance,
        status: info.balance >= stakeSOL - 0.001 ? 'funded' : 'idle',
      }));
    })();
  }, [challengeId, stakeSOL]);

  // ── Deposit ───────────────────────────────────────────────────
  const deposit = useCallback(async (): Promise<string | null> => {
    if (!challengeId || !pubkey) return null;

    setState(s => ({ ...s, status: 'building', errorMsg: null }));

    try {
      setState(s => ({ ...s, status: 'signing' }));
      const sig = await signAndDeposit(challengeId, stakeSOL);

      setState(s => ({ ...s, status: 'confirming', txSig: sig }));

      // Poll escrow balance to confirm (MWA already confirmed on-chain,
      // but we verify the escrow received the funds)
      if (!isDemoMode) {
        let attempts = 0;
        while (attempts < 15) {
          await new Promise(r => setTimeout(r, 2000));
          const funded = await isEscrowFunded(challengeId, stakeSOL);
          if (funded) break;
          attempts++;
        }
      }

      // Refresh escrow balance
      const info = await getEscrowInfo(challengeId);
      setState(s => ({
        ...s,
        status:    'funded',
        txSig:     sig,
        escrowBal: info.balance,
      }));

      return sig;
    } catch (e: any) {
      const msg = e?.message || 'Transaction failed';
      setState(s => ({ ...s, status: 'error', errorMsg: msg }));
      Alert.alert('Deposit Failed', msg);
      return null;
    }
  }, [challengeId, pubkey, stakeSOL, signAndDeposit, isDemoMode]);

  // ── Claim (winner) ─────────────────────────────────────────────
  const claim = useCallback(async (winnerPubkey: string): Promise<OnChainResult | null> => {
    if (!challengeId) return null;

    setState(s => ({ ...s, status: 'claiming', errorMsg: null }));

    try {
      if (isDemoMode) {
        await new Promise(r => setTimeout(r, 1500));
        const fakeSig = 'DEMO_CLAIM_' + Math.random().toString(36).slice(2, 10).toUpperCase();
        setState(s => ({ ...s, status: 'claimed', txSig: fakeSig, escrowBal: 0 }));
        return { signature: fakeSig, explorerUrl: '' };
      }

      const result = await claimEscrow(challengeId, winnerPubkey);
      setState(s => ({ ...s, status: 'claimed', txSig: result.signature, escrowBal: 0 }));
      return result;
    } catch (e: any) {
      const msg = e?.message || 'Claim failed';
      setState(s => ({ ...s, status: 'error', errorMsg: msg }));
      Alert.alert('Claim Failed', msg);
      return null;
    }
  }, [challengeId, isDemoMode]);

  // ── Open in Explorer ──────────────────────────────────────────
  const openExplorer = useCallback(() => {
    if (state.txSig && !state.txSig.startsWith('DEMO')) {
      Linking.openURL(explorerUrl(state.txSig));
    }
  }, [state.txSig]);

  return {
    ...state,
    deposit,
    claim,
    openExplorer,
    isLoading: ['building', 'signing', 'confirming', 'claiming'].includes(state.status),
  };
}