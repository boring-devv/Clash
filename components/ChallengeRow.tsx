import { WalletAvatar } from '@/components/ui';
import { C, CAT_COLORS, CAT_ICONS, R, S, STATUS_META, T } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { type Challenge as FirebaseChallenge } from '@/services/firebase-challenges';

type Challenge = Omit<FirebaseChallenge, 'deadline' | 'voting_deadline'> & {
  deadline?: string | null | undefined;
  voting_deadline?: string | null | undefined;
};

// Keep for backward compat — Challenge satisfies this shape
export type ChallengeRowItem = Challenge;

interface Props {
  key?: any;
  challenge: Challenge;
  index?: number;
  pubkey?: string | null;
}

export function ChallengeRow({ challenge: c, index = 0, pubkey }: Props) {
  const router  = useRouter();
  const slideX  = useRef(new Animated.Value(-16)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const catCol  = CAT_COLORS[c.category] || C.purple;
  const stake   = c.stake_sol ?? 0;
  const sm      = STATUS_META[c.status] || { label: c.status.toUpperCase(), color: C.t3 };
  const isMyWin = pubkey ? c.winner_id === pubkey : false;

  let timeStr = '';
  if (c.deadline) {
    const ms  = new Date(c.deadline).getTime() - Date.now();
    const hrs = Math.floor(ms / 3.6e6);
    const min = Math.floor((ms % 3.6e6) / 60000);
    timeStr = ms <= 0 ? 'Ended' : hrs > 0 ? `${hrs}h left` : `${min}m left`;
  }

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideX,  { toValue: 0, duration: 320, delay: index * 45, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 320, delay: index * 45, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[cr.wrap, { opacity, transform: [{ translateX: slideX }] }]}>
      <TouchableOpacity
        onPress={() => router.push(`/challenge/${c.id}` as any)}
        activeOpacity={0.86}
        style={[cr.card, isMyWin && { borderColor: C.gold + '55' }]}
      >
        {/* Left accent */}
        <View style={[cr.accent, { backgroundColor: catCol }]} />

        <View style={cr.body}>
          {/* Row 1: category + status */}
          <View style={cr.topRow}>
            <View style={[cr.catChip, { backgroundColor: catCol + '20', borderColor: catCol + '50' }]}>
              <Text style={{ fontSize: 10 }}>{CAT_ICONS[c.category] || '⚡'}</Text>
              <Text style={[cr.catLabel, { color: catCol }]}>{c.category.toUpperCase()}</Text>
            </View>
            <View style={[cr.statusChip, { borderColor: sm.color + '50', backgroundColor: sm.color + '18' }]}>
              <View style={[cr.statusDot, { backgroundColor: sm.color }]} />
              <Text style={[cr.statusLabel, { color: sm.color }]}>{sm.label}</Text>
            </View>
          </View>

          {/* Row 2: title */}
          <Text style={cr.title} numberOfLines={1}>{c.title}</Text>

          {/* Row 3: opponent + meta */}
          <View style={cr.footRow}>
            {c.opponent ? (
              <View style={cr.vsWrap}>
                <Text style={cr.vsLabel}>vs</Text>
                <WalletAvatar
                  pubkey={c.opponent.wallet_address || c.opponent.id}
                  username={c.opponent.username}
                  size={18}
                />
                <Text style={cr.opponentName} numberOfLines={1}>{c.opponent.username}</Text>
              </View>
            ) : c.creator ? (
              <View style={cr.vsWrap}>
                <WalletAvatar
                  pubkey={c.creator.wallet_address || c.creator.id}
                  username={c.creator.username}
                  size={18}
                />
                <Text style={cr.opponentName} numberOfLines={1}>{c.creator.username}</Text>
                <Text style={[cr.vsLabel, { color: C.green }]}>· open</Text>
              </View>
            ) : (
              <View style={cr.vsWrap}>
                <Text style={[cr.opponentName, { color: C.t4 }]}>Anonymous</Text>
              </View>
            )}

            <View style={cr.rightMeta}>
              {stake > 0 && <Text style={cr.stake}>◎{stake}</Text>}
              {timeStr !== '' && <Text style={cr.time}>{timeStr}</Text>}
            </View>
          </View>
        </View>

        {isMyWin && <Text style={cr.crown}>👑</Text>}
        <Ionicons name="chevron-forward" size={13} color={C.t4} style={{ marginRight: S.sm }} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const cr = StyleSheet.create({
  wrap:   { marginBottom: S.sm },
  card:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, elevation: 2 },
  accent: { width: 3, alignSelf: 'stretch' },
  body:   { flex: 1, paddingVertical: 12, paddingHorizontal: S.md, gap: 5 },

  topRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.full, borderWidth: 1 },
  catLabel:   { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.full, borderWidth: 1 },
  statusDot:  { width: 4, height: 4, borderRadius: 2 },
  statusLabel:{ fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },

  title:  { color: C.t1, fontSize: T.base, fontWeight: '800' },

  footRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vsWrap:      { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  vsLabel:     { color: C.t4, fontSize: T.xs, fontWeight: '700' },
  opponentName:{ color: C.t2, fontSize: T.xs, fontWeight: '700', maxWidth: 100 },
  rightMeta:   { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  stake:       { color: C.gold, fontSize: T.xs, fontWeight: '900' },
  time:        { color: C.t3, fontSize: T.xs },
  crown:       { fontSize: 15, paddingHorizontal: S.xs },
});