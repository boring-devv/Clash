/**
 * app/(tabs)/feed.tsx — Day 3 rewrite
 * 3 tabs: ARENA (open/active) | JUDGE (pending_vote) | RESULTS (resolved)
 * Category dropdown, searchbar on explore
 */
import { useNotifBadge } from '@/app/_layout';
import { ChallengeCard } from '@/components/ChallengeCard';
import { WalletAvatar } from '@/components/ui';
import { C, CAT_COLORS, CAT_ICONS, R, S, T } from '@/constants/theme';
import { useWallet } from '@/context/WalletContext';
import { getFeed, getVoteTally, type Challenge } from '@/services/firebase-challenges';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Dimensions, FlatList,
  Modal, Platform, Pressable,
  StyleSheet,
  Text,
  TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height: SH, width: SW } = Dimensions.get('window');
const STACK_SIZE = 3;
const CATS = ['all','fitness','gaming','cooking','art','music','dance','sport','other'];

type Tab = 'arena' | 'judge' | 'results';

export default function FeedScreen() {
  const { profile, pubkey, solBalance, isDemoMode } = useWallet();
  const { unreadCount }    = useNotifBadge();
  const router = useRouter();

  const [all,        setAll]        = useState<Challenge[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState<Tab>('arena');
  const [cat,        setCat]        = useState('all');
  const [catDropdown,setCatDropdown]= useState(false);
  const [cursor,     setCursor]     = useState(0);
  const [search,     setSearch]     = useState('');

  const headerAnim = useRef(new Animated.Value(0)).current;
  const tabAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getFeed(120);
      setAll(data);
      setCursor(0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const onRefresh = useCallback(() => { load(); }, []);

  // Switch tab with animation
  const switchTab = (t: Tab) => {
    setTab(t);
    setCursor(0);
    Animated.spring(tabAnim, { toValue: t === 'arena' ? 0 : t === 'judge' ? 1 : 2, useNativeDriver: false, tension: 80, friction: 12 }).start();
  };

  const now = Date.now();

  // Partition data
  const arena   = all.filter(c => {
    const deadline = c.deadline ? new Date(c.deadline).getTime() : Infinity;
    const open = (c.status === 'open' || c.status === 'active') && deadline > now;
    const matchCat = cat === 'all' || c.category === cat;
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase());
    return open && matchCat && matchSearch;
  });

  const judge = all.filter(c => {
    const vd = c.voting_deadline ? new Date(c.voting_deadline).getTime() : null;
    const votingOpen = c.status === 'pending_vote' && (!vd || now < vd);
    const matchCat = cat === 'all' || c.category === cat;
    return votingOpen && matchCat;
  });

  const results = all.filter(c => {
    const ended = c.status === 'resolved' || c.status === 'completed' || c.status === 'expired';
    const deadlinePassed = c.deadline ? new Date(c.deadline).getTime() < now : false;
    const matchCat = cat === 'all' || c.category === cat;
    return (ended || deadlinePassed) && matchCat;
  });

  // Arena uses card stack
  const filtered     = arena;
  const visibleSlice = filtered.slice(cursor, cursor + STACK_SIZE);
  const remaining    = Math.max(0, filtered.length - cursor);
  const topChallenge = visibleSlice[0] ?? null;
  const handleSwipe  = useCallback(() => setCursor(p => p + 1), []);

  const TAB_W = (SW - S.lg * 2) / 3;
  const indicatorLeft = tabAnim.interpolate({ inputRange: [0,1,2], outputRange: [0, TAB_W, TAB_W * 2] });

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <Animated.View style={[s.header, { opacity: headerAnim }]}>
        <View>
          <Text style={s.greeting}>gm, {pubkey ? pubkey.slice(0,6)+'...' : 'anon'}</Text>
          <View style={s.balanceRow}>
            <Text style={s.balanceAmt}>◎ {solBalance.toFixed(3)}</Text>
            {isDemoMode && <View style={s.demoPill}><Text style={s.demoPillTxt}>DEMO</Text></View>}
          </View>
        </View>
        <View style={s.headerRight}>
          {/* Category dropdown trigger */}
          <TouchableOpacity onPress={() => setCatDropdown(true)} style={s.catDropBtn}>
            <Text style={s.catDropIcon}>{cat === 'all' ? '🎯' : CAT_ICONS[cat]}</Text>
            <Text style={s.catDropTxt}>{cat === 'all' ? 'ALL' : cat.toUpperCase()}</Text>
            <Ionicons name="chevron-down" size={12} color={C.t3} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/notifications' as any)} style={s.avatarBtn}>
            <WalletAvatar pubkey={pubkey} username={profile?.username} size={36} />
            <View style={s.notifDot} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Tabs */}
      <View style={s.tabWrap}>
        <View style={s.tabTrack}>
          <Animated.View style={[s.tabIndicator, { left: indicatorLeft, width: TAB_W }]} />
          {([
            { key: 'arena',   label: 'ARENA',  icon: '⚔️',  count: arena.length,   color: C.purple },
            { key: 'judge',   label: 'JUDGE',  icon: '🗳️',  count: judge.length,   color: C.gold   },
            { key: 'results', label: 'RESULTS',icon: '🏆',  count: results.length, color: C.green  },
          ] as const).map(tb => (
            <TouchableOpacity key={tb.key} style={s.tabBtn} onPress={() => switchTab(tb.key)} activeOpacity={0.8}>
              <Text style={s.tabIcon}>{tb.icon}</Text>
              <Text style={[s.tabTxt, tab === tb.key && { color: C.t1 }]}>{tb.label}</Text>
              {tb.count > 0 && (
                <View style={[s.tabBadge, { backgroundColor: tab === tb.key ? tb.color : C.t4 }]}>
                  <Text style={s.tabBadgeTxt}>{tb.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── ARENA TAB ── */}
      {tab === 'arena' && (
        <FlatList
          data={[]}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          onRefresh={onRefresh}
          refreshing={loading}
          ListHeaderComponent={
            <>
              {loading ? (
                <View style={s.centered}><ActivityIndicator color={C.purple} size="large" /></View>
              ) : remaining === 0 && filtered.length === 0 ? (
                <View style={s.centered}>
                  <Text style={{ fontSize: 48 }}>⚔️</Text>
                  <Text style={s.emptyTitle}>No challenges open</Text>
                  <Text style={s.emptySub}>Drop the first challenge</Text>
                </View>
              ) : remaining === 0 ? (
                <View style={s.centered}>
                  <Text style={{ fontSize: 48 }}>🏆</Text>
                  <Text style={s.emptyTitle}>You've seen them all</Text>
                  <TouchableOpacity onPress={onRefresh} style={s.refreshBtn}>
                    <LinearGradient colors={C.gPurple} style={s.refreshGrad}>
                      <Text style={s.refreshTxt}>🔄 Refresh</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.stackContainer}>
                  {[...visibleSlice].reverse().map((challenge, ri) => {
                    const stackIdx = visibleSlice.length - 1 - ri;
                    return (
                      <ChallengeCard
                        key={challenge.id}
                        c={challenge as unknown as Challenge}
                        index={stackIdx}
                        isTop={stackIdx === 0}
                        onSwipeLeft={handleSwipe}
                        onSwipeRight={handleSwipe}
                      />
                    );
                  })}
                </View>
              )}

              {/* Action buttons */}
              {!loading && visibleSlice.length > 0 && (
                <View style={s.actionBtns}>
                  <TouchableOpacity style={[s.actionBtn, { borderColor: C.red+'50' }]} onPress={handleSwipe} activeOpacity={0.8}>
                    <Text style={{ fontSize: 22 }}>👋</Text>
                    <Text style={[s.actionLabel, { color: C.red }]}>PASS</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => router.push('/create-challenge' as any)} style={s.createBtn} activeOpacity={0.85}>
                    <LinearGradient colors={C.gPurple} style={s.createGrad}>
                      <Text style={s.createTxt}>+ DROP</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.actionBtn, { borderColor: C.green+'50' }]}
                    onPress={() => {
                      if (!topChallenge) return;
                      if (topChallenge.status === 'pending_vote') {
                        router.push(`/vote/${topChallenge.id}` as any);
                      } else if (topChallenge.status === 'open') {
                        router.push(`/join/${topChallenge.id}` as any);
                      } else {
                        router.push(`/challenge/${topChallenge.id}` as any);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 22 }}>{topChallenge?.status === 'pending_vote' ? '🗳️' : '⚔️'}</Text>
                    <Text style={[s.actionLabel, { color: C.green }]}>
                      {topChallenge?.status === 'pending_vote' ? 'VOTE' : 'FIGHT'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          }
          renderItem={null as any}
        />
      )}

      {/* ── JUDGE TAB ── */}
      {tab === 'judge' && (
        <FlatList
          data={judge}
          keyExtractor={i => i.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={onRefresh}
          refreshing={loading}
          ListEmptyComponent={
            <View style={s.centered}>
              <Text style={{ fontSize: 48 }}>🗳️</Text>
              <Text style={s.emptyTitle}>No battles to judge</Text>
              <Text style={s.emptySub}>Check back when challenges are completed</Text>
            </View>
          }
          renderItem={({ item: c }) => (
            <JudgeCard challenge={c} pubkey={pubkey} onPress={() => router.push(`/vote/${c.id}` as any)} />
          )}
        />
      )}

      {/* ── RESULTS TAB ── */}
      {tab === 'results' && (
        <FlatList
          data={results}
          keyExtractor={i => i.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={onRefresh}
          refreshing={loading}
          ListEmptyComponent={
            <View style={s.centered}>
              <Text style={{ fontSize: 48 }}>📭</Text>
              <Text style={s.emptyTitle}>No results yet</Text>
              <Text style={s.emptySub}>Completed challenges will show here</Text>
            </View>
          }
          renderItem={({ item: c }) => (
            <ResultCard challenge={c} pubkey={pubkey} onPress={() => router.push(`/challenge/${c.id}` as any)} />
          )}
        />
      )}

      {/* Category dropdown modal */}
      <Modal visible={catDropdown} transparent animationType="fade" onRequestClose={() => setCatDropdown(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setCatDropdown(false)}>
          <View style={s.dropdown}>
            <Text style={s.dropdownTitle}>FILTER BY CATEGORY</Text>
            {CATS.map(c => (
              <TouchableOpacity key={c} onPress={() => { setCat(c); setCatDropdown(false); }} style={[s.dropdownItem, cat === c && { backgroundColor: C.purpleDim }]}>
                <Text style={{ fontSize: 18 }}>{c === 'all' ? '🎯' : CAT_ICONS[c]}</Text>
                <Text style={[s.dropdownItemTxt, cat === c && { color: C.purple }]}>{c === 'all' ? 'ALL CATEGORIES' : c.toUpperCase()}</Text>
                {cat === c && <Ionicons name="checkmark" size={16} color={C.purple} />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── Judge Card ────────────────────────────────────────────────────
function JudgeCard({ challenge: c, pubkey, onPress }: { challenge: Challenge; pubkey: string | null; onPress: () => void }) {
  const catCol  = CAT_COLORS[c.category] || C.purple;
  const isMulti = c.type === 'open' && c.max_participants > 2;
  const joined  = c.participant_count ?? c.participants?.length ?? 0;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={jc.card}>
      <View style={[jc.accent, { backgroundColor: catCol }]} />
      <View style={jc.body}>
        <View style={jc.topRow}>
          <View style={[jc.catPill, { backgroundColor: catCol+'22', borderColor: catCol+'55' }]}>
            <Text style={{ fontSize: 11 }}>{CAT_ICONS[c.category] || '⚡'}</Text>
            <Text style={[jc.catTxt, { color: catCol }]}>{c.category.toUpperCase()}</Text>
          </View>
          <View style={[jc.statusPill, { backgroundColor: C.gold+'18', borderColor: C.gold+'44' }]}>
            <View style={[jc.dot, { backgroundColor: C.gold }]} />
            <Text style={[jc.statusTxt, { color: C.gold }]}>VOTE NOW</Text>
          </View>
        </View>

        <Text style={jc.title} numberOfLines={2}>{c.title}</Text>

        <View style={jc.vsRow}>
          {isMulti ? (
            <>
              <MiniAvatar profile={c.creator} />
              <View style={jc.vsBadgeWrap}>
                <LinearGradient colors={C.gFire} style={jc.vsBadge}>
                  <Text style={jc.vsTxt}>VS</Text>
                </LinearGradient>
              </View>
              <View style={jc.multiSlot}>
                <Text style={jc.multiCount}>{c.max_participants > 10 ? '10+' : `${c.max_participants}+`}</Text>
              </View>
            </>
          ) : (
            <>
              <MiniAvatar profile={c.creator} />
              <LinearGradient colors={C.gFire} style={jc.vsBadge}>
                <Text style={jc.vsTxt}>VS</Text>
              </LinearGradient>
              <MiniAvatar profile={c.opponent} />
            </>
          )}
        </View>

        {isMulti && <Text style={jc.joinedTxt}>{joined} submitted proof</Text>}

        <TouchableOpacity onPress={onPress} style={jc.voteBtn}>
          <LinearGradient colors={[C.gold, C.gold+'AA']} style={jc.voteBtnGrad}>
            <Ionicons name="thumbs-up" size={14} color="#fff" />
            <Text style={jc.voteBtnTxt}>VOTE NOW</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ── Result Card ───────────────────────────────────────────────────
function ResultCard({ challenge: c, pubkey, onPress }: { challenge: Challenge; pubkey: string | null; onPress: () => void }) {
  const catCol    = CAT_COLORS[c.category] || C.purple;
  const isMyWin   = pubkey && c.winner_id === pubkey;
  const isMulti   = c.type === 'open' && c.max_participants > 2;
  const joined    = c.participant_count ?? c.participants?.length ?? 0;
  const [tally,   setTally]   = useState<{creator_votes:number; opponent_votes:number} | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (c.status === 'resolved' || c.status === 'completed') {
      getVoteTally(c.id).then(setTally).catch(() => {});
    }
  }, [c.id]);

  const showMore = joined > 5;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={[rc.card, isMyWin && { borderColor: C.gold+'55' }]}>
      <View style={[rc.accent, { backgroundColor: catCol }]} />
      {isMyWin && (
        <LinearGradient colors={[C.gold+'22', C.gold+'06']} style={rc.winBanner}>
          <Text style={rc.winBannerTxt}>👑 YOU WON THIS</Text>
          {(c.stake_sol ?? 0) > 0 && <Text style={rc.winBannerSol}>+◎{((c.stake_sol ?? 0) * 2).toFixed(1)}</Text>}
        </LinearGradient>
      )}

      <View style={rc.body}>
        <View style={rc.topRow}>
          <View style={[rc.catPill, { backgroundColor: catCol+'22', borderColor: catCol+'55' }]}>
            <Text style={{ fontSize: 11 }}>{CAT_ICONS[c.category] || '⚡'}</Text>
            <Text style={[rc.catTxt, { color: catCol }]}>{c.category.toUpperCase()}</Text>
          </View>
          <View style={[rc.statusPill, { backgroundColor: C.green+'18', borderColor: C.green+'33' }]}>
            <Text style={[rc.statusTxt, { color: C.green }]}>ENDED</Text>
          </View>
        </View>

        <Text style={rc.title} numberOfLines={2}>{c.title}</Text>

        {/* VS display */}
        <View style={rc.vsRow}>
          {isMulti ? (
            <>
              <MiniAvatar profile={c.creator} isWinner={c.winner_id === c.creator_id} />
              <View style={rc.vsBadgeWrap}>
                <LinearGradient colors={C.gFire} style={rc.vsBadge}><Text style={rc.vsTxt}>VS</Text></LinearGradient>
              </View>
              <View style={rc.multiSlot}>
                <Text style={rc.multiCount}>{joined > 10 ? '10+' : `${joined}+`}</Text>
              </View>
            </>
          ) : (
            <>
              <MiniAvatar profile={c.creator} isWinner={c.winner_id === c.creator_id} />
              <LinearGradient colors={C.gFire} style={rc.vsBadge}><Text style={rc.vsTxt}>VS</Text></LinearGradient>
              <MiniAvatar profile={c.opponent} isWinner={c.winner_id === c.opponent_id} />
            </>
          )}
        </View>

        {isMulti && <Text style={rc.joinedTxt}>{joined} participated</Text>}

        {/* Vote counts */}
        {tally && !isMulti && (
          <View style={rc.tallyRow}>
            <View style={rc.tallyItem}>
              <Text style={rc.tallyName} numberOfLines={1}>{c.creator?.username ?? 'Creator'}</Text>
              <View style={rc.tallyBarWrap}>
                <View style={[rc.tallyBar, { flex: tally.creator_votes || 1, backgroundColor: catCol }]} />
                <View style={[rc.tallyBar, { flex: tally.opponent_votes || 1, backgroundColor: C.t4 }]} />
              </View>
              <Text style={rc.tallyVotes}>{tally.creator_votes} vs {tally.opponent_votes}</Text>
            </View>
          </View>
        )}

        {/* See more for multi */}
        {isMulti && showMore && (
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); setExpanded(v => !v); }} style={rc.seeMoreBtn}>
            <Text style={rc.seeMoreTxt}>{expanded ? 'Show less ▲' : `See all ${joined} participants ▼`}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function MiniAvatar({ profile, isWinner }: { profile?: any; isWinner?: boolean }) {
  if (!profile) return (
    <View style={ma.wrap}>
      <View style={[ma.avatar, { backgroundColor: C.bgElevated }]}><Text style={{ fontSize: 16 }}>👤</Text></View>
      <Text style={ma.name}>???</Text>
    </View>
  );
  return (
    <View style={ma.wrap}>
      <WalletAvatar pubkey={profile.wallet_address || profile.id} username={profile.username} size={36} />
      {isWinner && <View style={ma.crown}><Text style={{ fontSize: 10 }}>👑</Text></View>}
      <Text style={ma.name} numberOfLines={1}>{profile.username}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingBottom: Platform.OS === 'ios' ? 86 : 68 },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg, paddingVertical: S.sm },
  greeting:    { color: C.t3, fontSize: T.xs, fontWeight: '600' },
  balanceRow:  { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  balanceAmt:  { color: C.t1, fontSize: T['2xl'], fontWeight: '900', letterSpacing: 1 },
  demoPill:    { backgroundColor: C.orange + '22', borderRadius: R.full, borderWidth: 1, borderColor: C.orange + '55', paddingHorizontal: 7, paddingVertical: 2 },
  demoPillTxt: { color: C.orange, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  catDropBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: S.sm, paddingVertical: 6, borderRadius: R.full, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border },
  catDropIcon: { fontSize: 14 },
  catDropTxt:  { color: C.t2, fontSize: T.xs, fontWeight: '800', letterSpacing: 0.5 },
  avatarBtn:   { position: 'relative' },
  notifDot:    { position: 'absolute', top: 0, right: 0, width: 9, height: 9, borderRadius: 5, backgroundColor: C.pink, borderWidth: 2, borderColor: C.bg },
  notifBadge:  { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.pink, borderWidth: 2, borderColor: C.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  notifBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '900' },

  tabWrap:      { paddingHorizontal: S.lg, marginBottom: S.sm },
  tabTrack:     { flexDirection: 'row', backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, padding: 4, position: 'relative', height: 44 },
  tabIndicator: { position: 'absolute', top: 4, height: 36, backgroundColor: C.bgElevated, borderRadius: R.lg, borderWidth: 1, borderColor: C.borderLight },
  tabBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, zIndex: 1 },
  tabIcon:      { fontSize: 12 },
  tabTxt:       { color: C.t3, fontSize: T.xs, fontWeight: '800', letterSpacing: 0.5 },
  tabBadge:     { borderRadius: R.full, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  tabBadgeTxt:  { color: '#fff', fontSize: 8, fontWeight: '900' },

  stackContainer: { height: SH * 0.50, alignItems: 'center', justifyContent: 'center' },
  listContent:    { padding: S.lg, gap: S.md, paddingBottom: 20 },

  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md, padding: S.xl },
  emptyTitle: { color: C.t1, fontSize: T.xl, fontWeight: '900', textAlign: 'center' },
  emptySub:   { color: C.t2, fontSize: T.sm, textAlign: 'center' },
  refreshBtn: { borderRadius: R.xl, overflow: 'hidden', marginTop: S.sm },
  refreshGrad:{ paddingHorizontal: S.xl, paddingVertical: S.md },
  refreshTxt: { color: '#fff', fontSize: T.base, fontWeight: '900' },

  actionBtns:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: S.lg, paddingBottom: S.md, gap: S.lg },
  actionBtn:   { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: C.bgCard, borderWidth: 1.5 },
  actionLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  createBtn:   { borderRadius: R.xl, overflow: 'hidden' },
  createGrad:  { paddingHorizontal: S.lg, paddingVertical: S.md },
  createTxt:   { color: '#fff', fontSize: T.sm, fontWeight: '900', letterSpacing: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  dropdown:     { backgroundColor: C.bgCard, borderTopLeftRadius: R['2xl'], borderTopRightRadius: R['2xl'], borderWidth: 1, borderBottomWidth: 0, borderColor: C.border, padding: S.lg, gap: S.sm, paddingBottom: 40 },
  dropdownTitle:{ color: C.t3, fontSize: T.xs, fontWeight: '800', letterSpacing: 1.5, marginBottom: S.sm },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md, borderRadius: R.xl },
  dropdownItemTxt: { color: C.t1, fontSize: T.base, fontWeight: '700', flex: 1 },
});

const jc = StyleSheet.create({
  card:    { backgroundColor: C.bgCard, borderRadius: R['2xl'], borderWidth: 1, borderColor: C.border, overflow: 'hidden', flexDirection: 'row', marginBottom: S.md },
  accent:  { width: 4 },
  body:    { flex: 1, padding: S.md, gap: S.sm },
  topRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3 },
  catTxt:  { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3 },
  dot:        { width: 5, height: 5, borderRadius: 3 },
  statusTxt:  { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title:      { color: C.t1, fontSize: T.base, fontWeight: '900', lineHeight: 22 },
  vsRow:      { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  vsBadgeWrap:{ alignItems: 'center' },
  vsBadge:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  vsTxt:      { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  multiSlot:  { flex: 1, alignItems: 'center', justifyContent: 'center', height: 36, borderRadius: R.lg, backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border },
  multiCount: { color: C.t2, fontSize: T.base, fontWeight: '900' },
  joinedTxt:  { color: C.t3, fontSize: T.xs, fontWeight: '700' },
  voteBtn:    { borderRadius: R.lg, overflow: 'hidden' },
  voteBtnGrad:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, paddingVertical: S.sm },
  voteBtnTxt: { color: '#fff', fontSize: T.sm, fontWeight: '900', letterSpacing: 1 },
});

const rc = StyleSheet.create({
  card:       { backgroundColor: C.bgCard, borderRadius: R['2xl'], borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: S.md },
  accent:     { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  winBanner:  { paddingVertical: S.sm, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: S.lg },
  winBannerTxt:{ color: C.gold, fontSize: T.xs, fontWeight: '900', letterSpacing: 1 },
  winBannerSol:{ color: C.gold, fontSize: T.sm, fontWeight: '900' },
  body:       { padding: S.md, paddingLeft: S.lg + 4, gap: S.sm },
  topRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catPill:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3 },
  catTxt:     { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statusPill: { borderRadius: R.full, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statusTxt:  { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title:      { color: C.t1, fontSize: T.base, fontWeight: '900', lineHeight: 22 },
  vsRow:      { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  vsBadgeWrap:{ alignItems: 'center' },
  vsBadge:    { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  vsTxt:      { color: '#fff', fontSize: 7, fontWeight: '900' },
  multiSlot:  { flex: 1, alignItems: 'center', justifyContent: 'center', height: 36, borderRadius: R.lg, backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border },
  multiCount: { color: C.t2, fontSize: T.base, fontWeight: '900' },
  joinedTxt:  { color: C.t3, fontSize: T.xs, fontWeight: '700' },
  tallyRow:   { gap: 4 },
  tallyItem:  { gap: 3 },
  tallyName:  { color: C.t2, fontSize: T.xs, fontWeight: '700' },
  tallyBarWrap:{ flexDirection: 'row', height: 5, borderRadius: 3, overflow: 'hidden', gap: 1 },
  tallyBar:   { height: '100%', borderRadius: 3 },
  tallyVotes: { color: C.t3, fontSize: T.xs },
  seeMoreBtn: { alignItems: 'center', paddingVertical: S.sm, borderTopWidth: 1, borderTopColor: C.border, marginTop: S.sm },
  seeMoreTxt: { color: C.purple, fontSize: T.xs, fontWeight: '800' },
});

const ma = StyleSheet.create({
  wrap:   { flex: 1, alignItems: 'center', gap: 4, position: 'relative' },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  crown:  { position: 'absolute', top: -6, right: '15%' },
  name:   { color: C.t1, fontSize: 10, fontWeight: '700', textAlign: 'center' },
});