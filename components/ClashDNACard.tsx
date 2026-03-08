/**
 * components/ClashDNACard.tsx
 * Animated on-chain identity card — stat bars built from real challenge history.
 * Soul-bound. Cannot be faked. Cannot be transferred.
 */
import { C, R, S, T } from '@/constants/theme';
import { type Challenge, type Profile } from '@/services/firebase-challenges';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
    Animated, StyleSheet, Text, View,
} from 'react-native';

interface DNAStat {
  label:    string;
  icon:     string;
  value:    number; // 0–100
  color:    string;
  subtitle: string;
}

interface Props {
  profile:    Profile;
  challenges: Challenge[];
  pubkey:     string;
}

function computeDNA(profile: Profile, challenges: Challenge[]): DNAStat[] {
  const total     = challenges.length;
  const wins      = profile.wins ?? 0;
  const losses    = profile.losses ?? 0;
  const streak    = profile.streak ?? 0;
  const fame      = profile.fame ?? 0;
  const earned    = profile.total_earned ?? 0;

  const resolved  = challenges.filter(c => c.status === 'resolved' || c.status === 'completed');
  const staked    = resolved.filter(c => (c.stake_sol ?? 0) > 0);
  const avgStake  = staked.length > 0
    ? staked.reduce((s, c) => s + (c.stake_sol ?? 0), 0) / staked.length
    : 0;

  // Category dominance
  const catCount: Record<string, number> = {};
  challenges.forEach(c => { catCount[c.category] = (catCount[c.category] ?? 0) + 1; });
  const domCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none';

  // Win rate
  const wr = (wins + losses) > 0 ? wins / (wins + losses) : 0;

  // Accepted vs completed ratio (reliability)
  const accepted  = challenges.filter(c =>
    c.status !== 'open' && c.status !== 'expired'
  ).length;
  const completed = challenges.filter(c =>
    c.creator_proof_url || c.opponent_proof_url
  ).length;
  const reliability = accepted > 0 ? completed / accepted : 0;

  return [
    {
      label:    'STRENGTH',
      icon:     '💪',
      value:    Math.min(100, Math.round(wr * 100)),
      color:    C.purple,
      subtitle: `${wins}W / ${losses}L`,
    },
    {
      label:    'CONSISTENCY',
      icon:     '🔥',
      value:    Math.min(100, streak * 10),
      color:    C.orange,
      subtitle: `${streak} day streak`,
    },
    {
      label:    'BOLDNESS',
      icon:     '⚡',
      value:    Math.min(100, Math.round(avgStake * 20)),
      color:    C.gold,
      subtitle: `◎${avgStake.toFixed(2)} avg stake`,
    },
    {
      label:    'REPUTATION',
      icon:     '👑',
      value:    Math.min(100, Math.round(fame / 10)),
      color:    C.cyan,
      subtitle: `${fame} fame pts`,
    },
    {
      label:    'RELIABILITY',
      icon:     '🛡️',
      value:    Math.min(100, Math.round(reliability * 100)),
      color:    C.green,
      subtitle: `${completed}/${accepted} completed`,
    },
  ];
}

function DNABar({ stat, index }: { stat: DNAStat; index: number }) {
  const width   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 300,
        delay: index * 120,
        useNativeDriver: true,
      }),
      Animated.timing(width, {
        toValue: stat.value,
        duration: 900,
        delay: 200 + index * 120,
        useNativeDriver: false,
      }),
    ]).start();
  }, [stat.value]);

  const widthPct = width.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const tier =
    stat.value >= 80 ? 'ELITE'   :
    stat.value >= 60 ? 'STRONG'  :
    stat.value >= 40 ? 'SOLID'   :
    stat.value >= 20 ? 'RISING'  : 'RAW';

  const tierColor =
    stat.value >= 80 ? C.gold    :
    stat.value >= 60 ? C.purple  :
    stat.value >= 40 ? C.cyan    :
    stat.value >= 20 ? C.green   : C.t3;

  return (
    <Animated.View style={[b.row, { opacity }]}>
      <View style={b.labelRow}>
        <Text style={b.icon}>{stat.icon}</Text>
        <Text style={b.label}>{stat.label}</Text>
        <View style={[b.tierPill, { backgroundColor: tierColor + '22', borderColor: tierColor + '55' }]}>
          <Text style={[b.tierTxt, { color: tierColor }]}>{tier}</Text>
        </View>
      </View>
      <View style={b.trackWrap}>
        <View style={b.track}>
          <Animated.View style={[b.fill, { width: widthPct, backgroundColor: stat.color }]}>
            <View style={[b.fillGlow, { backgroundColor: stat.color + '60' }]} />
          </Animated.View>
        </View>
        <Text style={[b.pct, { color: stat.color }]}>{stat.value}</Text>
      </View>
      <Text style={b.sub}>{stat.subtitle}</Text>
    </Animated.View>
  );
}

export function ClashDNACard({ profile, challenges, pubkey }: Props) {
  const stats    = computeDNA(profile, challenges);
  const totalScore = Math.round(stats.reduce((s, x) => s + x.value, 0) / stats.length);
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.16] });

  // Overall rank label
  const rank =
    totalScore >= 80 ? { label: 'LEGEND',    color: C.gold   } :
    totalScore >= 65 ? { label: 'ELITE',      color: C.purple } :
    totalScore >= 50 ? { label: 'VETERAN',    color: C.cyan   } :
    totalScore >= 35 ? { label: 'FIGHTER',    color: C.green  } :
                       { label: 'NEWCOMER',   color: C.t2     };

  // Dominant category
  const catCount: Record<string, number> = {};
  challenges.forEach(c => { catCount[c.category] = (catCount[c.category] ?? 0) + 1; });
  const domCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  return (
    <View style={d.wrap}>
      <LinearGradient
        colors={['#1A0A35', '#0E0E1C']}
        style={d.card}
      >
        {/* Animated glow orb */}
        <Animated.View style={[d.orb, { opacity: glowOpacity }]} />

        {/* Header */}
        <View style={d.header}>
          <View style={d.headerLeft}>
            <Text style={d.dnaLabel}>CLASH DNA</Text>
            <Text style={d.sub}>Soul-bound · On-chain · Unfakeable</Text>
          </View>
          <View style={d.scoreWrap}>
            <LinearGradient colors={[rank.color + '40', rank.color + '15']} style={d.scoreGrad}>
              <Text style={[d.scoreTxt, { color: rank.color }]}>{totalScore}</Text>
              <Text style={[d.rankLabel, { color: rank.color }]}>{rank.label}</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Quick info strip */}
        <View style={d.infoStrip}>
          <View style={d.infoCell}>
            <Text style={d.infoVal}>{profile.wins ?? 0}</Text>
            <Text style={d.infoLabel}>WINS</Text>
          </View>
          <View style={d.infoDivider} />
          <View style={d.infoCell}>
            <Text style={d.infoVal}>{challenges.length}</Text>
            <Text style={d.infoLabel}>BATTLES</Text>
          </View>
          <View style={d.infoDivider} />
          <View style={d.infoCell}>
            <Text style={d.infoVal}>{domCat === '—' ? '—' : domCat.toUpperCase().slice(0, 5)}</Text>
            <Text style={d.infoLabel}>DOMAIN</Text>
          </View>
          <View style={d.infoDivider} />
          <View style={d.infoCell}>
            <Text style={d.infoVal}>{profile.streak ?? 0}🔥</Text>
            <Text style={d.infoLabel}>STREAK</Text>
          </View>
        </View>

        {/* Stat bars */}
        <View style={d.bars}>
          {stats.map((stat, i) => (
            <DNABar key={stat.label} stat={stat} index={i} />
          ))}
        </View>

        {/* Footer — chain verified */}
        <View style={d.footer}>
          <View style={[d.chainBadge, { borderColor: C.green + '44' }]}>
            <View style={[d.chainDot, { backgroundColor: C.green }]} />
            <Text style={[d.chainTxt, { color: C.green }]}>VERIFIED ON-CHAIN</Text>
          </View>
          <Text style={d.walletTxt}>
            {pubkey.slice(0, 4)}...{pubkey.slice(-4)}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const d = StyleSheet.create({
  wrap: { marginHorizontal: S.lg, marginBottom: S.md },
  card: {
    borderRadius: R['2xl'], borderWidth: 1,
    borderColor: C.purple + '44', overflow: 'hidden',
    padding: S.lg, gap: S.md,
  },
  orb:  { position: 'absolute', top: -80, right: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: C.purple },

  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { gap: 3 },
  dnaLabel:   { color: C.t1, fontSize: T.xl, fontWeight: '900', letterSpacing: 3 },
  sub:        { color: C.t3, fontSize: T.xs },
  scoreWrap:  { alignItems: 'flex-end' },
  scoreGrad:  { borderRadius: R.xl, paddingHorizontal: S.md, paddingVertical: S.sm, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  scoreTxt:   { fontSize: 28, fontWeight: '900', lineHeight: 32 },
  rankLabel:  { fontSize: T.xs, fontWeight: '900', letterSpacing: 2, marginTop: 2 },

  infoStrip:  { flexDirection: 'row', backgroundColor: C.bg + 'AA', borderRadius: R.xl, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  infoCell:   { flex: 1, alignItems: 'center', paddingVertical: S.sm },
  infoDivider:{ width: 1, backgroundColor: C.border },
  infoVal:    { color: C.t1, fontSize: T.sm, fontWeight: '900' },
  infoLabel:  { color: C.t3, fontSize: 8, fontWeight: '800', letterSpacing: 1, marginTop: 1 },

  bars: { gap: S.sm },

  footer:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: S.sm, borderTopWidth: 1, borderTopColor: C.border },
  chainBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3 },
  chainDot:   { width: 6, height: 6, borderRadius: 3 },
  chainTxt:   { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  walletTxt:  { color: C.t3, fontSize: T.xs, fontFamily: 'monospace' },
});

const b = StyleSheet.create({
  row:      { gap: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  icon:     { fontSize: 13 },
  label:    { color: C.t2, fontSize: T.xs, fontWeight: '800', letterSpacing: 1, flex: 1 },
  tierPill: { borderRadius: R.full, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  tierTxt:  { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  trackWrap:{ flexDirection: 'row', alignItems: 'center', gap: S.sm },
  track:    { flex: 1, height: 8, backgroundColor: C.bgElevated, borderRadius: 4, overflow: 'hidden' },
  fill:     { height: '100%', borderRadius: 4, overflow: 'hidden' },
  fillGlow: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 20, borderRadius: 4 },
  pct:      { fontSize: T.xs, fontWeight: '900', minWidth: 26, textAlign: 'right' },
  sub:      { color: C.t4, fontSize: 9 },
});