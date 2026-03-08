/**
 * components/EscrowDepositSheet.tsx
 * ─────────────────────────────────────────────────────────────────
 * Shows escrow info and handles the SOL deposit flow.
 * Used in both create-challenge and join screens.
 */
import { C, R, S, T } from '@/constants/theme';
import { useWallet } from '@/context/WalletContext';
import { useEscrow } from '@/hooks/useEscrow';
import { accountUrl, getEscrowAddress } from '@/services/solana';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
    ActivityIndicator, Animated, Linking,
    StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

interface Props {
  challengeId: string;
  stakeSOL:    number;
  role:        'creator' | 'opponent';
  onSuccess:   (txSig: string) => void;
  onSkip?:     () => void;
}

const STATUS_COPY = {
  idle:       { label: 'Send SOL to Escrow',  icon: '🔒', color: '#ffffff' },
  building:   { label: 'Building transaction', icon: '⚙️', color: C.t2    },
  signing:    { label: 'Open wallet to sign',  icon: '✍️', color: C.gold   },
  confirming: { label: 'Confirming on-chain',  icon: '⏳', color: C.cyan   },
  funded:     { label: 'Escrow funded!',        icon: '✅', color: C.green  },
  claiming:   { label: 'Claiming prize...',     icon: '🏆', color: C.gold   },
  claimed:    { label: 'Prize claimed!',         icon: '🎉', color: C.green  },
  error:      { label: 'Transaction failed',    icon: '❌', color: C.red    },
};

export function EscrowDepositSheet({ challengeId, stakeSOL, role, onSuccess, onSkip }: Props) {
  const { solBalance, isDemoMode, airdropDevnet } = useWallet();
  const {
    status, txSig, errorMsg, escrowAddr, escrowBal,
    deposit, isLoading, openExplorer,
  } = useEscrow(challengeId, stakeSOL);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'signing') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
    if (status === 'funded') {
      Animated.spring(checkAnim, { toValue: 1, useNativeDriver: true, tension: 60 }).start();
    }
  }, [status]);

  useEffect(() => {
    if (status === 'funded' && txSig) {
      setTimeout(() => onSuccess(txSig), 800);
    }
  }, [status, txSig]);

  const meta       = STATUS_COPY[status] || STATUS_COPY.idle;
  const hasBalance = solBalance >= stakeSOL;
  const escrowShort = escrowAddr
    ? `${escrowAddr.slice(0, 6)}...${escrowAddr.slice(-6)}`
    : getEscrowAddress(challengeId).slice(0, 10) + '...';

  return (
    <View style={s.wrap}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>STAKE ESCROW</Text>
        <View style={s.networkBadge}>
          <View style={s.networkDot} />
          <Text style={s.networkTxt}>DEVNET</Text>
        </View>
      </View>

      {/* Status indicator */}
      <Animated.View style={[s.statusCard, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={s.statusIcon}>{meta.icon}</Text>
        <Text style={[s.statusLabel, { color: meta.color }]}>{meta.label}</Text>
        {isLoading && <ActivityIndicator color={meta.color} size="small" style={{ marginTop: 4 }} />}
      </Animated.View>

      {/* Escrow details */}
      <View style={s.detailsCard}>
        <Row label="Stake amount" value={`◎ ${stakeSOL} SOL`} valueColor={C.gold} />
        <Row label="Your balance"  value={`◎ ${solBalance.toFixed(4)}`} valueColor={hasBalance ? C.green : C.red} />
        <Row label="Escrow address" value={escrowShort} mono />
        {escrowBal > 0 && <Row label="Escrow balance" value={`◎ ${escrowBal.toFixed(4)}`} valueColor={C.cyan} />}
        {isDemoMode && <Row label="Mode" value="Demo (simulated)" valueColor={C.purple} />}
      </View>

      {/* Low balance warning */}
      {!hasBalance && !isDemoMode && (
        <View style={s.warningCard}>
          <Ionicons name="warning-outline" size={14} color={C.orange} />
          <Text style={s.warningTxt}>
            Need ◎{(stakeSOL - solBalance).toFixed(4)} more SOL.
          </Text>
          <TouchableOpacity onPress={airdropDevnet} style={s.airdropMini}>
            <Text style={s.airdropMiniTxt}>Get devnet SOL</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* TX link */}
      {txSig && !txSig.startsWith('DEMO') && (
        <TouchableOpacity onPress={openExplorer} style={s.txLink}>
          <Ionicons name="open-outline" size={12} color={C.cyan} />
          <Text style={s.txLinkTxt}>View on Solana Explorer</Text>
        </TouchableOpacity>
      )}
      {txSig && txSig.startsWith('DEMO') && (
        <View style={s.txLink}>
          <Text style={s.txLinkTxt}>Simulated TX: {txSig}</Text>
        </View>
      )}

      {/* Error */}
      {errorMsg && (
        <View style={s.errorCard}>
          <Text style={s.errorTxt}>{errorMsg}</Text>
        </View>
      )}

      {/* CTA */}
      {status !== 'funded' && status !== 'claimed' && (
        <Animated.View style={{ transform: [{ scale: status === 'idle' || status === 'error' ? pulseAnim : new Animated.Value(1) }] }}>
          <TouchableOpacity
            onPress={deposit}
            disabled={isLoading || (!hasBalance && !isDemoMode)}
            style={[s.ctaBtn, (isLoading || (!hasBalance && !isDemoMode)) && s.ctaBtnDisabled]}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={isLoading ? [C.bgElevated, C.bgElevated] : C.gPurple}
              style={s.ctaBtnGrad}
            >
              {isLoading
                ? <ActivityIndicator color={C.t2} />
                : (
                  <>
                    <Text style={s.ctaBtnEmoji}>🔒</Text>
                    <Text style={s.ctaBtnTxt}>
                      {isDemoMode ? `SIMULATE ◎${stakeSOL} DEPOSIT` : `SEND ◎${stakeSOL} TO ESCROW`}
                    </Text>
                  </>
                )
              }
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Skip (for free challenges) */}
      {stakeSOL === 0 && onSkip && (
        <TouchableOpacity onPress={onSkip} style={s.skipBtn}>
          <Text style={s.skipTxt}>No stake — continue free</Text>
        </TouchableOpacity>
      )}

      {/* Explainer */}
      <View style={s.explainer}>
        <Text style={s.explainerTxt}>
          SOL is locked in a deterministic escrow address derived from this challenge ID.
          The winner automatically receives both stakes when voting resolves.
        </Text>
        {escrowAddr && (
          <TouchableOpacity onPress={() => Linking.openURL(accountUrl(escrowAddr))}>
            <Text style={[s.explainerTxt, { color: C.purple, marginTop: 4 }]}>
              Verify escrow on-chain →
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function Row({ label, value, valueColor, mono }: {
  label: string; value: string; valueColor?: string; mono?: boolean;
}) {
  return (
    <View style={r.row}>
      <Text style={r.label}>{label}</Text>
      <Text style={[r.value, valueColor && { color: valueColor }, mono && { fontFamily: 'monospace', fontSize: 11 }]}>
        {value}
      </Text>
    </View>
  );
}

const r = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  label: { color: C.t3, fontSize: T.xs, fontWeight: '700' },
  value: { color: C.t1, fontSize: T.sm, fontWeight: '800' },
});

const s = StyleSheet.create({
  wrap: { gap: S.md },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:  { color: C.t1, fontSize: T.xl, fontWeight: '900', letterSpacing: 2 },
  networkBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.green + '15', borderRadius: R.full, borderWidth: 1, borderColor: C.green + '35', paddingHorizontal: 8, paddingVertical: 4 },
  networkDot:   { width: 5, height: 5, borderRadius: 3, backgroundColor: C.green },
  networkTxt:   { color: C.green, fontSize: 9, fontWeight: '900', letterSpacing: 1 },

  statusCard:  { backgroundColor: C.bgElevated, borderRadius: R.xl, padding: S.md, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.border },
  statusIcon:  { fontSize: 28 },
  statusLabel: { fontSize: T.sm, fontWeight: '800', letterSpacing: 0.5 },

  detailsCard: { backgroundColor: C.bgCard, borderRadius: R.xl, padding: S.md, borderWidth: 1, borderColor: C.border },

  warningCard: { flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.orange + '12', borderRadius: R.xl, borderWidth: 1, borderColor: C.orange + '35', padding: S.sm, flexWrap: 'wrap' },
  warningTxt:  { color: C.orange, fontSize: T.xs, flex: 1 },
  airdropMini: { backgroundColor: C.orange + '20', borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 4 },
  airdropMiniTxt: { color: C.orange, fontSize: T.xs, fontWeight: '900' },

  txLink:    { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' },
  txLinkTxt: { color: C.cyan, fontSize: T.xs },

  errorCard: { backgroundColor: C.red + '12', borderRadius: R.xl, borderWidth: 1, borderColor: C.red + '35', padding: S.sm },
  errorTxt:  { color: C.red, fontSize: T.xs, textAlign: 'center' },

  ctaBtn:         { borderRadius: R['2xl'], overflow: 'hidden' },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaBtnGrad:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, paddingVertical: S.lg },
  ctaBtnEmoji:    { fontSize: 18 },
  ctaBtnTxt:      { color: '#fff', fontSize: T.base, fontWeight: '900', letterSpacing: 1 },

  skipBtn: { alignItems: 'center', paddingVertical: S.sm },
  skipTxt: { color: C.t3, fontSize: T.xs, fontWeight: '700' },

  explainer:    { backgroundColor: C.bgCard, borderRadius: R.lg, padding: S.sm, borderWidth: 1, borderColor: C.border },
  explainerTxt: { color: C.t4, fontSize: 10, lineHeight: 15, textAlign: 'center' },
});