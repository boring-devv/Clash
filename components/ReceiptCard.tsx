/**
 * components/ReceiptCard.tsx
 * Shareable win receipt — shows when a user wins a challenge.
 * Looks like a hype card / receipt you'd screenshot and post.
 */
import { C, CAT_COLORS, CAT_ICONS, R, S, T } from '@/constants/theme';
import { type Challenge, type Profile } from '@/services/firebase-challenges';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
    Animated, Share, StyleSheet, Text,
    TouchableOpacity, View,
} from 'react-native';
import { WalletAvatar } from './ui';

interface Props {
  challenge: Challenge;
  winner:    Profile;
  pubkey:    string;
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export function ReceiptCard({ challenge: c, winner, pubkey }: Props) {
  const router    = useRouter();
  const isMyWin   = winner.wallet_address === pubkey || winner.id === pubkey;
  const catCol    = CAT_COLORS[c.category] || C.purple;
  const stakeAmt  = c.stake_sol ?? 0;
  const prize     = c.prize_pool ?? stakeAmt * 2;
  const entryAnim = useRef(new Animated.Value(0)).current;
  const shimmer   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entryAnim, {
      toValue: 1, useNativeDriver: true,
      tension: 60, friction: 10,
    }).start();

    if (isMyWin) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(shimmer, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, []);

  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.12] });

  const handleShare = async () => {
    try {
      await Share.share({
        message: isMyWin
          ? `🏆 I just won "${c.title}" on CLASH${prize > 0 ? ` and took ◎${prize.toFixed(2)} SOL` : ''}! clash.app`
          : `⚔️ "${c.title}" just resolved on CLASH. Check it out! clash.app`,
      });
    } catch {}
  };

  return (
    <Animated.View style={[rc.wrap, { opacity: entryAnim, transform: [{ scale: entryAnim }] }]}>
      <LinearGradient
        colors={isMyWin ? ['#1A1000', '#0E0E1C'] : ['#101020', '#0E0E1C']}
        style={rc.card}
      >
        {/* Shimmer overlay for wins */}
        {isMyWin && (
          <Animated.View style={[rc.shimmer, { opacity: shimmerOpacity, backgroundColor: C.gold }]} />
        )}

        {/* Top dashed border (receipt look) */}
        <View style={rc.dashedTop} />

        {/* Receipt header */}
        <View style={rc.receiptHeader}>
          <Text style={rc.receiptBrand}>CLASH RECEIPT</Text>
          <Text style={rc.receiptDate}>{timeAgo(c.created_at)}</Text>
        </View>

        {/* Trophy / result */}
        <View style={rc.resultRow}>
          <Text style={rc.trophy}>{isMyWin ? '👑' : '🏆'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[rc.resultLabel, { color: isMyWin ? C.gold : C.t2 }]}>
              {isMyWin ? 'YOU WON' : 'WINNER'}
            </Text>
            <Text style={rc.winnerName} numberOfLines={1}>
              {winner.username ?? winner.wallet_address?.slice(0, 10)}
            </Text>
          </View>
          <WalletAvatar
            pubkey={winner.wallet_address || winner.id}
            username={winner.username}
            size={44}
          />
        </View>

        {/* Divider row */}
        <View style={rc.dividerRow}>
          <View style={rc.dividerCircleLeft} />
          <View style={rc.dividerLine} />
          <View style={rc.dividerCircleRight} />
        </View>

        {/* Challenge details */}
        <View style={rc.detailRows}>
          <View style={rc.detailRow}>
            <Text style={rc.detailKey}>CHALLENGE</Text>
            <Text style={rc.detailVal} numberOfLines={1}>{c.title}</Text>
          </View>
          <View style={rc.detailRow}>
            <Text style={rc.detailKey}>CATEGORY</Text>
            <View style={rc.catPill}>
              <Text style={{ fontSize: 11 }}>{CAT_ICONS[c.category] || '⚡'}</Text>
              <Text style={[rc.catTxt, { color: catCol }]}>{c.category.toUpperCase()}</Text>
            </View>
          </View>
          {prize > 0 && (
            <View style={rc.detailRow}>
              <Text style={rc.detailKey}>PRIZE</Text>
              <Text style={[rc.detailVal, { color: C.gold, fontWeight: '900' }]}>
                ◎{prize.toFixed(3)} SOL
              </Text>
            </View>
          )}
          <View style={rc.detailRow}>
            <Text style={rc.detailKey}>VERIFIED</Text>
            <View style={rc.chainBadge}>
              <View style={rc.chainDot} />
              <Text style={rc.chainTxt}>ON-CHAIN</Text>
            </View>
          </View>
        </View>

        {/* Dashed separator */}
        <View style={rc.dashedMid} />

        {/* Action buttons */}
        <View style={rc.actions}>
          <TouchableOpacity
            onPress={() => router.push(`/challenge/${c.id}` as any)}
            style={rc.viewBtn}
          >
            <Ionicons name="eye-outline" size={15} color={C.t2} />
            <Text style={rc.viewBtnTxt}>VIEW BATTLE</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleShare} style={rc.shareBtn} activeOpacity={0.85}>
            <LinearGradient
              colors={isMyWin ? [C.gold, '#D97706'] : C.gPurple}
              style={rc.shareBtnGrad}
            >
              <Ionicons name="share-social" size={15} color="#fff" />
              <Text style={rc.shareBtnTxt}>SHARE RECEIPT</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Bottom barcode-style decoration */}
        <View style={rc.barcode}>
          {Array.from({ length: 28 }).map((_, i) => (
            <View
              key={i}
              style={[rc.bar, {
                height: 12 + (i % 3 === 0 ? 8 : i % 2 === 0 ? 4 : 0),
                backgroundColor: i % 4 === 0 ? C.t3 : C.border,
              }]}
            />
          ))}
        </View>
        <Text style={rc.txHash}>
          {c.id.slice(0, 8).toUpperCase()}...{c.id.slice(-8).toUpperCase()}
        </Text>
      </LinearGradient>
    </Animated.View>
  );
}

const rc = StyleSheet.create({
  wrap: { marginHorizontal: S.lg, marginBottom: S.md },
  card: {
    borderRadius: R['2xl'], borderWidth: 1,
    borderColor: C.gold + '33', overflow: 'hidden',
    padding: S.lg, gap: S.md,
  },
  shimmer: { position: 'absolute', inset: 0 },

  dashedTop: {
    height: 1, borderWidth: 1, borderColor: C.border,
    borderStyle: 'dashed', marginBottom: S.xs,
  },
  receiptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  receiptBrand:  { color: C.t3, fontSize: T.xs, fontWeight: '900', letterSpacing: 3, fontFamily: 'monospace' },
  receiptDate:   { color: C.t4, fontSize: T.xs, fontFamily: 'monospace' },

  resultRow:   { flexDirection: 'row', alignItems: 'center', gap: S.md },
  trophy:      { fontSize: 36 },
  resultLabel: { fontSize: T.xs, fontWeight: '900', letterSpacing: 2 },
  winnerName:  { color: C.t1, fontSize: T.xl, fontWeight: '900' },

  dividerRow:         { flexDirection: 'row', alignItems: 'center' },
  dividerCircleLeft:  { width: 18, height: 18, borderRadius: 9, backgroundColor: C.bg, marginLeft: -S.lg - 1, borderWidth: 1, borderColor: C.gold + '33' },
  dividerCircleRight: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.bg, marginRight: -S.lg - 1, borderWidth: 1, borderColor: C.gold + '33' },
  dividerLine:        { flex: 1, height: 1, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed' },

  detailRows: { gap: S.sm },
  detailRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailKey:  { color: C.t3, fontSize: T.xs, fontWeight: '800', letterSpacing: 1.5, fontFamily: 'monospace' },
  detailVal:  { color: C.t1, fontSize: T.sm, fontWeight: '700', maxWidth: '55%', textAlign: 'right' },

  catPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  catTxt:  { fontSize: T.xs, fontWeight: '900' },

  chainBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chainDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  chainTxt:   { color: C.green, fontSize: T.xs, fontWeight: '900', letterSpacing: 1 },

  dashedMid: { height: 1, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed' },

  actions:      { flexDirection: 'row', gap: S.sm },
  viewBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, paddingVertical: S.md, borderRadius: R.xl, backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border },
  viewBtnTxt:   { color: C.t2, fontSize: T.xs, fontWeight: '800', letterSpacing: 1 },
  shareBtn:     { flex: 2, borderRadius: R.xl, overflow: 'hidden' },
  shareBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, paddingVertical: S.md },
  shareBtnTxt:  { color: '#fff', fontSize: T.xs, fontWeight: '900', letterSpacing: 1 },

  barcode: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2, height: 24 },
  bar:     { width: 2, borderRadius: 1 },
  txHash:  { color: C.t4, fontSize: 8, textAlign: 'center', fontFamily: 'monospace', letterSpacing: 1 },
});