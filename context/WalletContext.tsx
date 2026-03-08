/**
 * context/WalletContext.tsx
 * MWA + Firebase. No Supabase.
 */
import {
  addDoc,
  collection,
  db,
  getDocs,
  query,
  where
} from '@/lib/firebase';
import {
  APP_IDENTITY,
  buildDepositTransaction,
  confirmTx,
  connection,
  getSOLBalance,
  NETWORK,
  requestAirdrop,
} from '@/services/solana';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { PublicKey } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Alert, Platform } from 'react-native';

// ── Storage (web fallback) ────────────────────────────────────────
const secureStore =
  Platform.OS === 'web'
    ? {
        getItemAsync:    async (k: string) => (typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null),
        setItemAsync:    async (k: string, v: string) => { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); },
        deleteItemAsync: async (k: string) => { if (typeof localStorage !== 'undefined') localStorage.removeItem(k); },
      }
    : SecureStore;

// base64 → Uint8Array (no extra dep)
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

// ── Types ─────────────────────────────────────────────────────────
interface WalletContextType {
  connected:      boolean;
  connecting:     boolean;
  pubkey:         string | null;
  publicKey:      string | null;
  profile:        any;
  walletName:     string;
  solBalance:     number;
  skrBalance:     number;
  isDemoMode:     boolean;
  connect:        () => Promise<void>;
  connectDemo:    (fakePk?: string) => Promise<void>;
  disconnect:     () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshBalances:() => Promise<void>;
  signAndDeposit: (challengeId: string, solAmount: number) => Promise<string>;
  airdropDevnet:  () => Promise<void>;
  handlePhantomCallback: (p: any) => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({} as WalletContextType);

const PROFILES_COLLECTION = 'profiles';

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [pubkey,     setPubkey]     = useState<string | null>(null);
  const [profile,    setProfile]    = useState<any>(null);
  const [connecting, setConnecting] = useState(false);
  const [walletName, setWalletName] = useState('');
  const [solBalance, setSolBalance] = useState(0);
  const [skrBalance, setSkrBalance] = useState(0);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const authTokenRef = useRef<string | null>(null);

  // ── Restore session on mount ────────────────────────────────────
  useEffect(() => {
    (async () => {
      const stored    = await secureStore.getItemAsync('clash_pubkey');
      const demo      = await secureStore.getItemAsync('clash_demo');
      const authToken = await secureStore.getItemAsync('clash_auth_token');
      // v2 = tokens obtained with chain: (MWA 2.0 SDK 2.2.5)
      // Wipe any token obtained with old cluster: field — it will cause blank screen
      const tokenVer  = await secureStore.getItemAsync('clash_auth_token_ver');
      if (stored) {
        setPubkey(stored);
        setIsDemoMode(demo === '1');
        setWalletName(demo === '1' ? 'Demo Wallet' : 'MWA Wallet');
        // Only restore token if it was obtained with chain: (ver=2)
        if (authToken && tokenVer === '2') {
          authTokenRef.current = authToken;
        } else {
          // Wipe stale MWA 1.0 token
          await secureStore.deleteItemAsync('clash_auth_token');
          authTokenRef.current = null;
        }
        fetchOrCreate(stored);
        loadBalances(stored);
      }
    })();
  }, []);

  // ── Firebase profile upsert ────────────────────────────────────
  const fetchOrCreate = async (pk: string) => {
    try {
      // Look up profile by wallet_address
      const q = query(
        collection(db, PROFILES_COLLECTION),
        where('wallet_address', '==', pk)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        setProfile({ id: snap.docs[0].id, ...snap.docs[0].data() });
        return;
      }

      // Create new profile
      const username  = 'user_' + pk.slice(0, 6);
      const newProfile = {
        wallet_address: pk,
        user_id:        pk,
        username,
        profile_image:  null,
        wins:           0,
        losses:         0,
        win_rate:       0,
        fame:           0,
        total_earned:   0,
        created_at:     new Date().toISOString(),
        updated_at:     new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, PROFILES_COLLECTION), newProfile);
      setProfile({ id: docRef.id, ...newProfile });
    } catch (e) {
      console.warn('Firebase profile error, using mock:', e);
      setProfile({
        id: pk, wallet_address: pk, user_id: pk,
        username: 'user_' + pk.slice(0, 6),
        profile_image: null,
        wins: 0, losses: 0, win_rate: 0, fame: 0, total_earned: 0,
      });
    }
  };

  // ── Balances ───────────────────────────────────────────────────
  const loadBalances = async (pk: string) => {
    try {
      const sol = await getSOLBalance(pk);
      setSolBalance(sol);
      setSkrBalance(0); // devnet: no real SKR; mainnet: fetch SPL token account
    } catch (e) {
      console.warn('Balance fetch error:', e);
    }
  };

  const refreshBalances = useCallback(async () => {
    if (pubkey) await loadBalances(pubkey);
  }, [pubkey]);

  // ── Finalize connection ────────────────────────────────────────
  const finalize = async (pk: string, wallet: string, demo = false, authToken?: string) => {
    await secureStore.setItemAsync('clash_pubkey', pk);
    await secureStore.setItemAsync('clash_demo', demo ? '1' : '0');
    // Persist auth_token so it survives app restarts
    // ver=2 means token was obtained with chain: (MWA 2.0 SDK 2.2.5)
    if (authToken) {
      await secureStore.setItemAsync('clash_auth_token', authToken);
      await secureStore.setItemAsync('clash_auth_token_ver', '2');
      authTokenRef.current = authToken;
    }
    setPubkey(pk);
    setWalletName(wallet);
    setIsDemoMode(demo);
    setConnecting(false);
    await fetchOrCreate(pk);
    await loadBalances(pk);
  };

  // ── MWA Connect ────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (Platform.OS !== 'android') {
      Alert.alert(
        'Android Required',
        'Mobile Wallet Adapter only works on Android.',
        [{ text: 'Use Demo', onPress: () => connectDemo() }, { text: 'Cancel' }]
      );
      return;
    }
    setConnecting(true);
    try {
      const result = await transact(async (wallet: Web3MobileWallet) => {
        const authResult = await wallet.authorize({
          chain: `solana:${NETWORK}` as any,
          identity: APP_IDENTITY,
        });
        authTokenRef.current = authResult.auth_token;
        const bytes = b64ToBytes(authResult.accounts[0].address);
        return { pk: new PublicKey(bytes).toBase58(), authToken: authResult.auth_token };
      });
      await finalize(result.pk, 'MWA Wallet', false, result.authToken);
    } catch (e: any) {
      console.error('MWA connect error:', e);
      setConnecting(false);
      if (!e?.message?.includes('cancel') && !e?.message?.includes('Cancel')) {
        Alert.alert('Connection Failed', 'Could not connect wallet.', [
          { text: 'Use Demo', onPress: () => connectDemo() },
          { text: 'Cancel' },
        ]);
      }
    }
  }, []);

  // ── Demo Connect ──────────────────────────────────────────────
  const connectDemo = useCallback(async (fakePk?: string) => {
    setConnecting(true);
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const pk = fakePk || Array.from({ length: 44 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    await finalize(pk, 'Demo Wallet', true);
  }, []);

  // ── Disconnect ────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    await secureStore.deleteItemAsync('clash_pubkey');
    await secureStore.deleteItemAsync('clash_demo');
    await secureStore.deleteItemAsync('clash_auth_token');
    await secureStore.deleteItemAsync('clash_auth_token_ver');
    setPubkey(null); setProfile(null);
    setSolBalance(0); setSkrBalance(0);
    setIsDemoMode(false);
    authTokenRef.current = null;
  }, []);

  // ── Refresh Profile ───────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (!pubkey) return;
    try {
      const q = query(
        collection(db, PROFILES_COLLECTION),
        where('wallet_address', '==', pubkey)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setProfile({ id: snap.docs[0].id, ...snap.docs[0].data() });
      }
    } catch (e) {
      console.warn('refreshProfile error:', e);
    }
  }, [pubkey]);

  // ── Sign & Deposit via MWA ────────────────────────────────────
  const signAndDeposit = useCallback(async (
    challengeId: string,
    solAmount: number,
  ): Promise<string> => {
    console.log('[signAndDeposit] Start', { challengeId, solAmount, isDemoMode, pubkey });
    if (!pubkey) throw new Error('No wallet connected');

    // Demo mode — simulate tx
    if (isDemoMode) {
      console.log('[signAndDeposit] Demo mode simulation');
      await new Promise(r => setTimeout(r, 1500));
      return 'DEMO_' + Math.random().toString(36).slice(2, 14).toUpperCase();
    }

    if (Platform.OS !== 'android') throw new Error('MWA requires Android');

    console.log('[signAndDeposit] Invoking transact...');
    return await transact(async (wallet: Web3MobileWallet) => {
      let authResult: any;
      console.log('[signAndDeposit] Authorizing with token:', !!authTokenRef.current);
      try {
        authResult = await wallet.authorize({
          chain: `solana:${NETWORK}` as any,
          identity: APP_IDENTITY,
          ...(authTokenRef.current ? { auth_token: authTokenRef.current } : {}),
        });
      } catch (e) {
        console.warn('[signAndDeposit] authorize failed, retrying without token:', e);
        authTokenRef.current = null;
        authResult = await wallet.authorize({
          chain: `solana:${NETWORK}` as any,
          identity: APP_IDENTITY,
        });
      }

      console.log('[signAndDeposit] Authorized:', authResult.accounts[0].address);
      authTokenRef.current = authResult.auth_token;
      secureStore.setItemAsync('clash_auth_token', authResult.auth_token);
      secureStore.setItemAsync('clash_auth_token_ver', '2');
      
      const from = new PublicKey(b64ToBytes(authResult.accounts[0].address)).toBase58();
      console.log('[signAndDeposit] Building transaction for:', from);

      const tx   = await buildDepositTransaction(from, challengeId, solAmount);
      console.log('[signAndDeposit] Requesting signature...');
      const signedTxs = await wallet.signTransactions({ transactions: [tx] });
      const signedTx = signedTxs[0];

      console.log('[signAndDeposit] Submitting via RPC...');
      const sig = await connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: false });
      console.log('[signAndDeposit] Submitted sig:', sig);

      const ok = await confirmTx(sig);
      if (!ok) throw new Error('Transaction not confirmed');
      console.log('[signAndDeposit] Confirmed');

      loadBalances(from); // refresh balance async

      return sig;
    });
  }, [pubkey, isDemoMode]);

  // ── Testnet Airdrop ─────────────────────────────────────────────
  const airdropDevnet = useCallback(async () => {
    if (!pubkey) return;
    try {
      await requestAirdrop(pubkey, 1);
      await loadBalances(pubkey);
      Alert.alert('✅ Airdrop received!', '1 SOL added to your testnet wallet.');
    } catch {
      Alert.alert('Airdrop failed', 'Testnet faucet may be rate-limited. Try again in 30s.');
    }
  }, [pubkey]);

  // Legacy compat
  const handlePhantomCallback = useCallback(async (_p: any) => {
    console.warn('handlePhantomCallback is deprecated — using MWA');
  }, []);

  return (
    <WalletContext.Provider value={{
      connected:  !!pubkey,
      connecting,
      pubkey,
      publicKey:  pubkey,
      profile,
      walletName,
      solBalance,
      skrBalance,
      isDemoMode,
      connect,
      connectDemo,
      disconnect,
      refreshProfile,
      refreshBalances,
      signAndDeposit,
      airdropDevnet,
      handlePhantomCallback,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);