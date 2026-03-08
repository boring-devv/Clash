import { C, CAT_COLORS, CAT_ICONS, R, S, T } from '@/constants/theme';
import { type Challenge } from '@/services/firebase-challenges';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions, Image, PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { WalletAvatar } from './ui';

const { width: SW } = Dimensions.get('window');
const CARD_WIDTH      = SW - S.lg * 2;
const SWIPE_THRESHOLD = SW * 0.28;
const ROTATION_FACTOR = 10;

// Challenge type imported from firebase-challenges

interface Props {
  key?: any;
  c: Challenge;
  index?: number;        // 0 = top of stack, 1 = behind, 2 = furthest back
  isTop?: boolean;
  onSwipeLeft?:  () => void;
  onSwipeRight?: () => void;
}

export function ChallengeCard({ c, index = 0, isTop = false, onSwipeLeft, onSwipeRight }: Props) {
  const router = useRouter();

  // Each card instance owns its own fresh pan — never shared
  const pan       = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const entryAnim = useRef(new Animated.Value(0)).current;

  // Mutable ref so panResponder always reads the latest isTop value
  // (panResponder is created once and its closure would otherwise be stale)
  const isTopRef        = useRef(isTop);
  const onSwipeLeftRef  = useRef(onSwipeLeft);
  const onSwipeRightRef = useRef(onSwipeRight);
  useEffect(() => {
    isTopRef.current        = isTop;
    onSwipeLeftRef.current  = onSwipeLeft;
    onSwipeRightRef.current = onSwipeRight;
  });

  const catCol     = CAT_COLORS[c.category] || C.purple;
  const stake      = c.stake_sol ?? 0;
  const stakeLabel = stake > 0 ? `◎${stake}` : 'FREE';

  const joinedCount = c.participant_count ?? c.participants?.length ?? 0;
  const totalDeposited = c.total_deposited_sol ?? 0;
  const creatorPaid = c.creator_deposit_amount ?? 0;
  const opponentPaid = c.opponent_deposit_amount ?? 0;

  const requiredTotal = c.prize_model === 'A'
    ? (c.prize_pool ?? 0)
    : c.prize_model === 'B'
    ? (joinedCount * (c.prize_pool ?? 0))
    : c.prize_model === 'C'
    ? (2 * (c.stake_sol ?? 0))
    : 0;

  const showDeposits = requiredTotal > 0;
  const depositsOk = showDeposits && totalDeposited >= requiredTotal - 0.0001;

  let timeStr = `${c.duration_hours}h`;
  if (c.deadline) {
    const ms  = new Date(c.deadline).getTime() - Date.now();
    const hrs = Math.floor(ms / 3.6e6);
    const min = Math.floor((ms % 3.6e6) / 60000);
    timeStr   = ms <= 0 ? 'Ended' : hrs > 0 ? `${hrs}h left` : `${min}m left`;
  }

  useEffect(() => {
    // Guarantee pan starts at 0 when component mounts
    pan.setValue({ x: 0, y: 0 });
    Animated.timing(entryAnim, {
      toValue: 1, duration: 300, delay: index * 60, useNativeDriver: false,
    }).start();
  }, []);

  // Rotation tied to horizontal drag
  const rotate = pan.x.interpolate({
    inputRange: [-SW / 2, 0, SW / 2],
    outputRange: [`-${ROTATION_FACTOR}deg`, '0deg', `${ROTATION_FACTOR}deg`],
    extrapolate: 'clamp',
  });

  // Back-card visual offset
  const cardScale   = isTop ? 1     : Math.max(0.88, 0.96 - index * 0.04);
  const cardOffsetY = isTop ? 0     : index * 12;

  const panResponder = useRef(
    PanResponder.create({
      // Read isTopRef.current so this always reflects the latest prop value
      onMoveShouldSetPanResponder: (_: any, g: any) =>
        isTopRef.current && (Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5),
      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }] as any,
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_: any, g: any) => {
        pan.flattenOffset();
        if (g.dx > SWIPE_THRESHOLD) {
          Animated.timing(pan, {
            toValue: { x: SW * 1.5, y: g.dy },
            duration: 250, useNativeDriver: false,
          }).start(() => {
            pan.setValue({ x: 0, y: 0 });
            onSwipeRightRef.current?.();
          });
        } else if (g.dx < -SWIPE_THRESHOLD) {
          Animated.timing(pan, {
            toValue: { x: -SW * 1.5, y: g.dy },
            duration: 250, useNativeDriver: false,
          }).start(() => {
            pan.setValue({ x: 0, y: 0 });
            onSwipeLeftRef.current?.();
          });
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false, friction: 6, tension: 100,
          }).start();
        }
      },
    })
  ).current;

  const handlePress = () => {
    // Only navigate if the card hasn't been dragged
    if (Math.abs((pan.x as any)._value) < 5) {
      router.push(`/challenge/${c.id}` as any);
    }
  };

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          opacity: entryAnim,
          zIndex: 100 - index,
          transform: isTop
            ? [{ translateX: pan.x }, { translateY: pan.y }, { rotate }]
            : [{ translateY: cardOffsetY }, { scale: cardScale }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        activeOpacity={isTop ? 0.95 : 1}
        onPress={isTop ? handlePress : undefined}
        style={styles.card}
      >
        {/* Category colour glow blob */}
        <View style={[styles.glowBlob, { backgroundColor: catCol }]} />

        {/* Top row */}
        <View style={styles.topRow}>
          <View style={[styles.catBadge, { backgroundColor: catCol + '25', borderColor: catCol + '60' }]}>
            <Text style={styles.catIcon}>{CAT_ICONS[c.category] || '⚡'}</Text>
            <Text style={[styles.catLabel, { color: catCol }]}>{c.category.toUpperCase()}</Text>
          </View>
          <StatusDot status={c.status} />
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={3}>{c.title}</Text>

        {/* VS section */}
        <View style={styles.vsSection}>
          {/* Creator */}
          <View style={styles.player}>
            <View style={[styles.avatarRing, { borderColor: catCol + '70' }]}>
              {c.creator?.profile_image
                ? <Image source={{ uri: c.creator.profile_image }} style={styles.avatarImg} />
                : <WalletAvatar pubkey={c.creator?.wallet_address || c.creator_id} username={c.creator?.username} size={48} />
              }
            </View>
            <Text style={styles.playerName} numberOfLines={1}>{c.creator?.username ?? 'Anonymous'}</Text>
            <View style={styles.statRow}>
              <Text style={styles.statText}>{c.creator?.wins ?? 0}W</Text>
              <View style={styles.statDot} />
              <Text style={styles.statText}>⚡{c.creator?.fame_points ?? c.creator?.fame ?? 0}</Text>
            </View>
          </View>

          {/* VS badge */}
          <View style={styles.vsCol}>
            <LinearGradient colors={C.gFire} style={styles.vsBadge}>
              <Text style={styles.vsTxt}>VS</Text>
            </LinearGradient>
          </View>

          {/* Opponent / multi slot / open slot */}
          {c.type === 'open' && c.max_participants > 2 ? (
            // Multi-participant card
            <View style={[styles.player, styles.playerRight]}>
              <View style={styles.multiCountBubble}>
                <Text style={styles.multiCountNum}>
                  {(c.participant_count ?? c.participants?.length ?? 0) > 10
                    ? '10+' : `${c.max_participants > 10 ? '10+' : c.max_participants + '+'}`}
                </Text>
              </View>
              <Text style={[styles.playerName, { color: C.cyan }]}>
                {c.participant_count ?? c.participants?.length ?? 0} joined
              </Text>
              <Text style={[styles.statText, { color: C.t3 }]}>
                {c.max_participants} max
              </Text>
            </View>
          ) : c.opponent ? (
            <View style={[styles.player, styles.playerRight]}>
              <View style={[styles.avatarRing, { borderColor: C.pink + '70' }]}>
                {c.opponent.profile_image
                  ? <Image source={{ uri: c.opponent.profile_image }} style={styles.avatarImg} />
                  : <WalletAvatar pubkey={c.opponent.wallet_address || c.opponent.id} username={c.opponent.username} size={48} />
                }
              </View>
              <Text style={styles.playerName} numberOfLines={1}>{c.opponent.username}</Text>
              <View style={styles.statRow}>
                <Text style={styles.statText}>{c.opponent.wins ?? 0}W</Text>
                <View style={styles.statDot} />
                <Text style={styles.statText}>⚡{c.opponent.fame_points ?? c.opponent.fame ?? 0}</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.player, styles.playerRight]}>
              <View style={styles.openSlotCircle}>
                <Text style={{ fontSize: 22 }}>👤</Text>
              </View>
              <Text style={[styles.playerName, { color: C.green }]}>Open Slot</Text>
              <Text style={[styles.statText, { color: C.green + 'AA' }]}>tap FIGHT to join</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Footer chips */}
        <View style={styles.footer}>
          <View style={[styles.footerChip, {
            backgroundColor: stake > 0 ? C.gold + '20' : C.bgElevated,
            borderColor:     stake > 0 ? C.gold + '50' : C.border,
          }]}>
            <Text style={[styles.footerChipTxt, { color: stake > 0 ? C.gold : C.t2 }]}>💰 {stakeLabel}</Text>
          </View>
          {showDeposits && (
            <View style={[styles.footerChip, {
              backgroundColor: depositsOk ? C.green + '12' : C.orange + '12',
              borderColor:     depositsOk ? C.green + '44' : C.orange + '44',
            }]}>
              <Text style={[styles.footerChipTxt, { color: depositsOk ? C.green : C.orange }]}>🔒 ◎{totalDeposited.toFixed(2)}/{requiredTotal.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.footerChip, { backgroundColor: C.bgElevated, borderColor: C.border }]}>
            <Text style={styles.footerChipTxt}>⏱ {timeStr}</Text>
          </View>
          {c.status === 'open' && !c.opponent_id && (
            <View style={[styles.footerChip, { backgroundColor: C.green + '15', borderColor: C.green + '40' }]}>
              <View style={styles.liveIndicator} />
              <Text style={[styles.footerChipTxt, { color: C.green }]}>OPEN</Text>
            </View>
          )}
        </View>

        {/* Swipe hint — only on top card */}
        {isTop && (
          <View style={styles.swipeHint}>
            <Text style={styles.swipeHintTxt}>← swipe to browse →</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────
// Status dot with pulsing animation for live statuses
// ─────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  open:         '#10B981',
  active:       '#22D3EE',
  pending_vote: '#F59E0B',
  resolved:     '#8B5CF6',
  expired:      '#505070',
};
const STATUS_LABELS: Record<string, string> = {
  open:         'OPEN',
  active:       'LIVE',
  pending_vote: 'VOTE',
  resolved:     'ENDED',
  expired:      'EXPIRED',
};

function StatusDot({ status }: { status: string }) {
  const col   = STATUS_COLORS[status] || C.t3;
  const label = STATUS_LABELS[status] || status.toUpperCase();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === 'open' || status === 'active') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.8, duration: 800, useNativeDriver: false }),
          Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: false }),
        ])
      ).start();
    }
  }, [status]);

  return (
    <View style={[sd.pill, { borderColor: col + '50', backgroundColor: col + '18' }]}>
      <Animated.View style={[sd.dot, { backgroundColor: col, transform: [{ scale: pulse }] }]} />
      <Text style={[sd.label, { color: col }]}>{label}</Text>
    </View>
  );
}

const sd = StyleSheet.create({
  pill:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: R.full, borderWidth: 1 },
  dot:   { width: 5, height: 5, borderRadius: 3 },
  label: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
});

const styles = StyleSheet.create({
  wrapper: {
    width: CARD_WIDTH,
    position: 'absolute',
    left: (Dimensions.get('window').width - CARD_WIDTH) / 2,
  },
  card: {
    backgroundColor: C.bgCard,
    borderRadius: R['2xl'],
    borderWidth: 1,
    borderColor: C.border,
    padding: S.lg,
    gap: S.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  glowBlob: {
    position: 'absolute', top: -80, right: -80,
    width: 220, height: 220, borderRadius: 110, opacity: 0.09,
  },
  topRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.full, borderWidth: 1 },
  catIcon:  { fontSize: 13 },
  catLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title:    { color: C.t1, fontSize: T.xl, fontWeight: '900', lineHeight: 28, letterSpacing: 0.2 },
  vsSection:      { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginVertical: S.sm },
  player:         { flex: 1, alignItems: 'center', gap: 6 },
  playerRight:    { alignItems: 'center' },
  avatarRing:     { borderRadius: 28, borderWidth: 2, padding: 2 },
  avatarImg:      { width: 48, height: 48, borderRadius: 24 },
  playerName:     { color: C.t1, fontSize: T.sm, fontWeight: '800', textAlign: 'center' },
  statRow:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statDot:        { width: 3, height: 3, borderRadius: 2, backgroundColor: C.t4 },
  statText:       { color: C.t3, fontSize: T.xs, fontWeight: '600' },
  multiCountBubble: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.cyan + '20', borderWidth: 1.5, borderColor: C.cyan + '50', alignItems: 'center', justifyContent: 'center' },
  multiCountNum:    { color: C.cyan, fontSize: 16, fontWeight: '900' },
  openSlotCircle: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 1.5, borderColor: C.green + '60',
    borderStyle: 'dashed',
    backgroundColor: C.green + '10',
    alignItems: 'center', justifyContent: 'center',
  },
  vsCol:   { alignItems: 'center', justifyContent: 'center' },
  vsBadge: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.orange, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
  },
  vsTxt:   { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  divider: { height: 1, backgroundColor: C.border },
  footer:        { flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' },
  footerChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.full, borderWidth: 1 },
  footerChipTxt: { color: C.t2, fontSize: T.xs, fontWeight: '700' },
  liveIndicator: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.green },
  swipeHint:     { alignItems: 'center', marginTop: -S.sm },
  swipeHintTxt:  { color: C.t4, fontSize: T.xs, letterSpacing: 0.5 },
});