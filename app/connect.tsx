/**
 * app/connect.tsx
 * Wallet connect screen — MWA on Android, Demo on other platforms.
 * Shows testnet badge + airdrop button.
 */
import { C, R, S, T } from '@/constants/theme';
import { useWallet } from '@/context/WalletContext';
import { accountUrl, NETWORK } from '@/services/solana';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Linking,
  Platform, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ConnectScreen() {
  const { connect, connectDemo, connected, connecting, pubkey, solBalance, airdropDevnet, isDemoMode } = useWallet();
  const router  = useRouter();
  const logoAnim  = useRef(new Animated.Value(0)).current;
  const cardsAnim = useRef(new Animated.Value(0)).current;
  const [airdropping, setAirdropping] = useState(false);

  useEffect(() => {
    if (connected) { router.replace('/(tabs)/feed'); return; }
    Animated.stagger(200, [
      Animated.spring(logoAnim,  { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.spring(cardsAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 12 }),
    ]).start();
  }, [connected]);

  const handleAirdrop = async () => {
    setAirdropping(true);
    try { await airdropDevnet(); } finally { setAirdropping(false); }
  };

  const logoScale = logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const cardsY    = cardsAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <SafeAreaView style={s.root}>
      {/* BG gradient */}
      <LinearGradient colors={['#0D0118', '#120224', C.bg]} style={StyleSheet.absoluteFill} />

      {/* Testnet badge */}
      <View style={s.netBadge}>
        <View style={s.netDot} />
        <Text style={s.netTxt}>SOLANA {NETWORK.toUpperCase()}</Text>
      </View>

      {/* Logo */}
      <Animated.View style={[s.logoWrap, { opacity: logoAnim, transform: [{ scale: logoScale }] }]}>
        <LinearGradient colors={C.gPurple} style={s.logoCircle}>
          <Text style={s.logoEmoji}>⚔️</Text>
        </LinearGradient>
        <Text style={s.appName}>CLASH</Text>
        <Text style={s.tagline}>Challenge. Prove. Win.</Text>
      </Animated.View>

      {/* Cards */}
      <Animated.View style={[s.cards, { opacity: cardsAnim, transform: [{ translateY: cardsY }] }]}>

        {/* If already connected, show balance + shortcut */}
        {connected && pubkey ? (
          <View style={s.connectedCard}>
            <Text style={s.connectedTitle}>Connected ✅</Text>
            <Text style={s.connectedAddr}>{pubkey.slice(0, 8)}...{pubkey.slice(-8)}</Text>
            <Text style={s.connectedBal}>◎ {solBalance.toFixed(4)} SOL</Text>
            {solBalance < 0.1 && (
              <TouchableOpacity onPress={handleAirdrop} style={s.airdropBtn} disabled={airdropping}>
                {airdropping
                  ? <ActivityIndicator color={C.cyan} size="small" />
                  : <Text style={s.airdropTxt}>🪂 Get testnet SOL</Text>
                }
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => router.replace('/(tabs)/feed')} style={s.enterBtn}>
              <LinearGradient colors={C.gPurple} style={s.enterBtnGrad}>
                <Text style={s.enterBtnTxt}>ENTER ARENA →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* MWA connect */}
            <TouchableOpacity
              onPress={connect}
              disabled={connecting}
              style={s.primaryBtn}
              activeOpacity={0.85}
            >
              <LinearGradient colors={C.gPurple} style={s.primaryBtnGrad}>
                {connecting
                  ? <ActivityIndicator color="#fff" />
                  : (
                    <>
                      <Ionicons name="wallet-outline" size={20} color="#fff" />
                      <Text style={s.primaryBtnTxt}>
                        {Platform.OS === 'android' ? 'Connect Wallet (MWA)' : 'Connect Wallet'}
                      </Text>
                    </>
                  )
                }
              </LinearGradient>
            </TouchableOpacity>

            {/* MWA info */}
            <View style={s.mwaInfo}>
              <Ionicons name="shield-checkmark-outline" size={13} color={C.t3} />
              <Text style={s.mwaInfoTxt}>
                Works with Phantom, Backpack, Seed Vault — any MWA wallet
              </Text>
            </View>

            <View style={s.dividerRow}>
              <View style={s.divider} />
              <Text style={s.dividerTxt}>or</Text>
              <View style={s.divider} />
            </View>

            {/* Demo */}
            <TouchableOpacity onPress={() => connectDemo()} style={s.demoBtn} activeOpacity={0.8}>
              <Ionicons name="flask-outline" size={16} color={C.t2} />
              <Text style={s.demoBtnTxt}>Try Demo Mode</Text>
            </TouchableOpacity>

            <Text style={s.demoNote}>
              Demo uses a simulated wallet. Real SOL transactions require MWA on Android.
            </Text>
          </>
        )}
      </Animated.View>

      {/* Solana Explorer link */}
      {connected && pubkey && (
        <TouchableOpacity
          onPress={() => Linking.openURL(accountUrl(pubkey))}
          style={s.explorerLink}
        >
          <Ionicons name="open-outline" size={12} color={C.t4} />
          <Text style={s.explorerLinkTxt}>View on Solana Explorer</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: S.lg },

  netBadge: {
    position: 'absolute', top: 56, right: S.lg,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.bgCard, borderRadius: R.full,
    borderWidth: 1, borderColor: C.green + '40',
    paddingHorizontal: 10, paddingVertical: 5,
  },
  netDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  netTxt: { color: C.green, fontSize: 9, fontWeight: '900', letterSpacing: 1 },

  logoWrap:   { alignItems: 'center', marginBottom: S.xl * 2, gap: S.md },
  logoCircle: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', shadowColor: C.purple, shadowOpacity: 0.8, shadowRadius: 30, elevation: 20 },
  logoEmoji:  { fontSize: 44 },
  appName:    { color: C.t1, fontSize: 52, fontWeight: '900', letterSpacing: 8 },
  tagline:    { color: C.t3, fontSize: T.sm, letterSpacing: 2 },

  cards: { width: '100%', gap: S.md },

  connectedCard: { backgroundColor: C.bgCard, borderRadius: R['2xl'], borderWidth: 1, borderColor: C.purple + '40', padding: S.lg, alignItems: 'center', gap: S.sm },
  connectedTitle:{ color: C.t1, fontSize: T.xl, fontWeight: '900' },
  connectedAddr: { color: C.t3, fontSize: T.xs, fontFamily: 'monospace' },
  connectedBal:  { color: C.gold, fontSize: T['2xl'], fontWeight: '900' },
  airdropBtn:    { borderRadius: R.xl, borderWidth: 1, borderColor: C.cyan + '40', backgroundColor: C.cyan + '12', paddingHorizontal: S.lg, paddingVertical: S.sm },
  airdropTxt:    { color: C.cyan, fontSize: T.sm, fontWeight: '800' },
  enterBtn:      { borderRadius: R.xl, overflow: 'hidden', width: '100%', marginTop: S.sm },
  enterBtnGrad:  { paddingVertical: S.md, alignItems: 'center' },
  enterBtnTxt:   { color: '#fff', fontSize: T.base, fontWeight: '900', letterSpacing: 2 },

  primaryBtn:     { borderRadius: R['2xl'], overflow: 'hidden' },
  primaryBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, paddingVertical: S.lg, paddingHorizontal: S.xl },
  primaryBtnTxt:  { color: '#fff', fontSize: T.lg, fontWeight: '900', letterSpacing: 1 },

  mwaInfo:    { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center' },
  mwaInfoTxt: { color: C.t3, fontSize: T.xs, textAlign: 'center' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  divider:    { flex: 1, height: 1, backgroundColor: C.border },
  dividerTxt: { color: C.t3, fontSize: T.xs },

  demoBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, paddingVertical: S.md },
  demoBtnTxt: { color: C.t2, fontSize: T.base, fontWeight: '700' },
  demoNote:   { color: C.t4, fontSize: T.xs, textAlign: 'center', lineHeight: 18 },

  explorerLink:    { position: 'absolute', bottom: 32, flexDirection: 'row', alignItems: 'center', gap: 4 },
  explorerLinkTxt: { color: C.t4, fontSize: T.xs },
});