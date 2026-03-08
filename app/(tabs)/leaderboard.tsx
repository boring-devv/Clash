/**
 * app/(tabs)/leaderboard.tsx — Day 3 rewrite
 * Leaderboard: Fame | Wins | Streak tabs, proper Firebase
 */
import { WalletAvatar } from '@/components/ui';
import { C, R, S, T } from '@/constants/theme';
import { useWallet } from '@/context/WalletContext';
import { getLeaderboard, type Profile } from '@/services/firebase-challenges';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, FlatList,
  Platform, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type SortKey = 'fame' | 'wins' | 'streak';
type Entry = Profile & { rank: number };

const MEDALS = ['🥇', '🥈', '🥉'];
const TABS: { key: SortKey; label: string; icon: string }[] = [
  { key: 'fame',   label: 'FAME',   icon: '⚡' },
  { key: 'wins',   label: 'WINS',   icon: '🏆' },
  { key: 'streak', label: 'STREAK', icon: '🔥' },
];

export default function LeaderboardScreen() {
  const { pubkey } = useWallet();
  const router     = useRouter();

  const [data,    setData]    = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<SortKey>('fame');

  const headerO  = useRef(new Animated.Value(0)).current;
  const myRowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerO, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    load();
  }, []);

  useEffect(() => { sortData(tab); }, [tab]);

  const [raw, setRaw] = useState<Profile[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const profiles = await getLeaderboard(100);
      setRaw(profiles);
      sort(profiles, tab);
    } catch { setData([]); }
    finally { setLoading(false); }
  };

  const sort = (profiles: Profile[], key: SortKey) => {
    const sorted = [...profiles].sort((a, b) => {
      if (key === 'fame')   return (b.fame ?? 0) - (a.fame ?? 0);
      if (key === 'wins')   return (b.wins ?? 0) - (a.wins ?? 0);
      if (key === 'streak') return (b.streak ?? 0) - (a.streak ?? 0);
      return 0;
    });
    setData(sorted.map((p, i) => ({ ...p, rank: i + 1 })));
    Animated.spring(myRowAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }).start();
  };

  const sortData = (key: SortKey) => sort(raw, key);

  const myEntry = data.find(e => e.wallet_address === pubkey || e.id === pubkey);
  const myRank  = myEntry?.rank;

  const getVal = (e: Entry) => {
    if (tab === 'fame')   return `⚡ ${e.fame ?? 0}`;
    if (tab === 'wins')   return `🏆 ${e.wins ?? 0}W`;
    if (tab === 'streak') return `🔥 ${e.streak ?? 0}d`;
    return '';
  };

  const renderRow = ({ item, index }: { item: Entry; index: number }) => {
    const isMe   = item.wallet_address === pubkey || item.id === pubkey;
    const isTop3 = index < 3;
    const medal  = MEDALS[index];

    return (
      <TouchableOpacity
        onPress={() => router.push(`/user/${item.wallet_address || item.id}` as any)}
        activeOpacity={0.85}
        style={[
          r.row,
          isMe    && r.myRow,
          isTop3  && { borderColor: ['#F59E0B', '#9CA3AF', '#CD7C2F'][index] + '55' },
        ]}
      >
        {/* Rank */}
        <View style={r.rankWrap}>
          {isTop3
            ? <Text style={r.medal}>{medal}</Text>
            : <Text style={[r.rank, isMe && { color: C.purple }]}>#{item.rank}</Text>
          }
        </View>

        {/* Avatar */}
        <WalletAvatar pubkey={item.wallet_address || item.id} username={item.username} size={40} />

        {/* Info */}
        <View style={r.info}>
          <Text style={[r.name, isMe && { color: C.purple }]} numberOfLines={1}>
            {item.username ?? item.wallet_address?.slice(0, 10) ?? 'Anonymous'}
            {isMe ? ' (you)' : ''}
          </Text>
          <Text style={r.sub}>{item.wins ?? 0}W · {item.losses ?? 0}L · {item.streak ?? 0}🔥</Text>
        </View>

        {/* Score */}
        <Text style={[r.score, isTop3 && { color: ['#F59E0B','#9CA3AF','#CD7C2F'][index] }]}>
          {getVal(item)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <Animated.View style={[s.header, { opacity: headerO }]}>
        <View>
          <Text style={s.sup}>GLOBAL</Text>
          <Text style={s.title}>RANKINGS</Text>
        </View>
        <LinearGradient colors={C.gFire} style={s.livePill}>
          <View style={s.liveDot} />
          <Text style={s.liveTxt}>LIVE</Text>
        </LinearGradient>
      </Animated.View>

      {/* My rank banner */}
      {myRank && (
        <Animated.View style={[s.myRankBanner, { opacity: myRowAnim, transform: [{ scale: myRowAnim }] }]}>
          <LinearGradient colors={[C.purple + '30', C.purple + '10']} style={s.myRankInner}>
            <WalletAvatar pubkey={pubkey} username={myEntry?.username} size={32} />
            <View style={{ flex: 1 }}>
              <Text style={s.myRankLabel}>YOUR RANK</Text>
              <Text style={s.myRankVal}>#{myRank} globally</Text>
            </View>
            <Text style={s.myRankScore}>{myEntry ? getVal(myEntry) : ''}</Text>
          </LinearGradient>
        </Animated.View>
      )}

      {/* Tabs */}
      <View style={s.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[s.tabBtn, tab === t.key && s.tabBtnOn]}
            activeOpacity={0.8}
          >
            <Text style={s.tabIcon}>{t.icon}</Text>
            <Text style={[s.tabTxt, tab === t.key && { color: C.t1 }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.loading}>
          <ActivityIndicator color={C.purple} size="large" />
          <Text style={s.loadingTxt}>Loading rankings...</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={i => i.id || i.wallet_address || String(i.rank)}
          renderItem={renderRow}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          onRefresh={load}
          refreshing={loading}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 48 }}>👻</Text>
              <Text style={s.emptyTxt}>No rankings yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg, paddingBottom: Platform.OS === 'ios' ? 86 : 68 },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg, paddingVertical: S.sm },
  sup:     { color: C.t3, fontSize: T.xs, fontWeight: '800', letterSpacing: 2 },
  title:   { color: C.t1, fontSize: T['3xl'], fontWeight: '900', letterSpacing: 2 },
  livePill:{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.full },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveTxt: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1 },

  myRankBanner: { marginHorizontal: S.lg, marginBottom: S.sm, borderRadius: R.xl, overflow: 'hidden' },
  myRankInner:  { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.md, borderRadius: R.xl, borderWidth: 1, borderColor: C.purple + '44' },
  myRankLabel:  { color: C.purple, fontSize: T.xs, fontWeight: '800', letterSpacing: 1 },
  myRankVal:    { color: C.t1, fontSize: T.base, fontWeight: '900' },
  myRankScore:  { color: C.purple, fontSize: T.base, fontWeight: '900' },

  tabs:     { flexDirection: 'row', marginHorizontal: S.lg, marginBottom: S.sm, backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, padding: 4, gap: 4 },
  tabBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: S.sm, borderRadius: R.lg },
  tabBtnOn: { backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.borderLight },
  tabIcon:  { fontSize: 13 },
  tabTxt:   { color: C.t3, fontSize: T.xs, fontWeight: '800', letterSpacing: 0.5 },

  loading:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md },
  loadingTxt: { color: C.t2, fontSize: T.sm },
  list:       { paddingHorizontal: S.lg, paddingBottom: 20, gap: S.sm },
  empty:      { alignItems: 'center', paddingVertical: 60, gap: S.md },
  emptyTxt:   { color: C.t2, fontSize: T.base, fontWeight: '700' },
});

const r = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, padding: S.md },
  myRow:   { borderColor: C.purple + '55', backgroundColor: C.purple + '0C' },
  rankWrap:{ width: 36, alignItems: 'center' },
  medal:   { fontSize: 22 },
  rank:    { color: C.t3, fontSize: T.sm, fontWeight: '800' },
  info:    { flex: 1, gap: 2 },
  name:    { color: C.t1, fontSize: T.sm, fontWeight: '800' },
  sub:     { color: C.t3, fontSize: T.xs },
  score:   { color: C.t2, fontSize: T.base, fontWeight: '900' },
});