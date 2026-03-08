/**
 * app/(tabs)/explore.tsx — Day 3 rewrite
 * Search + Browse all challenges. Clean Firebase, searchbar, filters.
 */
import { ChallengeRow } from '@/components/ChallengeRow';
import { C, CAT_ICONS, R, S, T } from '@/constants/theme';
import { useWallet } from '@/context/WalletContext';
import { useDeviceId } from '@/hooks/useDeviceId';
import { getFeed, type Challenge } from '@/services/firebase-challenges';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, FlatList, Platform,
  StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CATS = ['all','fitness','gaming','cooking','art','music','dance','sport','other'];
const STATUS_FILTERS = [
  { key: 'all',          label: 'All',     icon: '🌍' },
  { key: 'open',         label: 'Open',    icon: '⚔️' },
  { key: 'pending_vote', label: 'Voting',  icon: '🗳️' },
  { key: 'resolved',     label: 'Ended',   icon: '🏆' },
];

export default function ExploreScreen() {
  const { pubkey }   = useWallet();
  const { deviceId } = useDeviceId();
  const router     = useRouter();

  const [all,       setAll]       = useState<Challenge[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [cat,       setCat]       = useState('all');
  const [status,    setStatus]    = useState('all');
  const [searching, setSearching] = useState(false);

  const headerO  = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.timing(headerO, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getFeed(150);
      setAll(data);
    } catch { setAll([]); }
    finally { setLoading(false); }
  };

  // Filter logic — also used for device-level sybil guard on challenge cards
  const filtered = all.filter(c => {
    const matchSearch = !search.trim() ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase()) ||
      c.creator?.username?.toLowerCase().includes(search.toLowerCase());
    const matchCat    = cat === 'all' || c.category === cat;
    const matchStatus = status === 'all' || c.status === status ||
      (status === 'resolved' && (c.status === 'resolved' || c.status === 'completed' || c.status === 'expired'));
    return matchSearch && matchCat && matchStatus;
  });

  const clearSearch = () => { setSearch(''); setSearching(false); inputRef.current?.blur(); };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <Animated.View style={[s.header, { opacity: headerO }]}>
        <View>
          <Text style={s.sup}>DISCOVER</Text>
          <Text style={s.title}>EXPLORE</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/create-challenge' as any)} style={s.createBtn} activeOpacity={0.85}>
          <LinearGradient colors={C.gPurple} style={s.createGrad}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={s.createTxt}>DROP</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Search bar */}
      <View style={s.searchRow}>
        <View style={[s.searchBox, searching && { borderColor: C.purple }]}>
          <Ionicons name="search" size={18} color={searching ? C.purple : C.t3} />
          <TextInput
            ref={inputRef}
            style={s.searchInput}
            placeholder="Search challenges, creators..."
            placeholderTextColor={C.t3}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearching(true)}
            onBlur={() => !search && setSearching(false)}
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <Ionicons name="close-circle" size={18} color={C.t3} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category filter - horizontal scroll */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATS}
        keyExtractor={i => i}
        contentContainerStyle={s.catBar}
        style={{ maxHeight: 46, flexGrow: 0 }}
        renderItem={({ item: c }) => (
          <TouchableOpacity
            onPress={() => setCat(c)}
            style={[s.catChip, cat === c && { borderColor: C.purple, backgroundColor: C.purpleDim }]}
          >
            {c !== 'all' && <Text style={{ fontSize: 12 }}>{CAT_ICONS[c]}</Text>}
            <Text style={[s.catTxt, cat === c && { color: C.purple }]}>
              {c === 'all' ? 'ALL' : c.toUpperCase()}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Status filter pills */}
      <View style={s.statusRow}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setStatus(f.key)}
            style={[s.statusPill, status === f.key && { borderColor: C.gold, backgroundColor: C.gold + '18' }]}
          >
            <Text style={{ fontSize: 11 }}>{f.icon}</Text>
            <Text style={[s.statusTxt, status === f.key && { color: C.gold }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
        <Text style={s.resultCount}>{filtered.length} found</Text>
      </View>

      {/* Results */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.purple} size="large" />
          <Text style={s.loadingTxt}>Loading challenges...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          onRefresh={load}
          refreshing={loading}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 48 }}>{search ? '🔍' : '📭'}</Text>
              <Text style={s.emptyTitle}>
                {search ? `No results for "${search}"` : 'Nothing here yet'}
              </Text>
              <Text style={s.emptySub}>
                {search ? 'Try different keywords or clear filters' : 'Drop the first challenge in this category'}
              </Text>
              {!search && (
                <TouchableOpacity onPress={() => router.push('/create-challenge' as any)} style={s.dropBtn}>
                  <LinearGradient colors={C.gPurple} style={s.dropGrad}>
                    <Text style={s.dropTxt}>+ DROP A CHALLENGE</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item: c, index }) => (
            <ChallengeRow challenge={c} index={index} pubkey={pubkey} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg, paddingBottom: Platform.OS === 'ios' ? 86 : 68 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg, paddingVertical: S.sm },
  sup:    { color: C.t3, fontSize: T.xs, fontWeight: '800', letterSpacing: 2 },
  title:  { color: C.t1, fontSize: T['3xl'], fontWeight: '900', letterSpacing: 2 },
  createBtn:  { borderRadius: R.xl, overflow: 'hidden' },
  createGrad: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: S.md, paddingVertical: S.sm },
  createTxt:  { color: '#fff', fontSize: T.sm, fontWeight: '900', letterSpacing: 1 },

  searchRow:  { paddingHorizontal: S.lg, marginBottom: S.sm },
  searchBox:  { flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: S.md, height: 48 },
  searchInput:{ flex: 1, color: C.t1, fontSize: T.base },

  catBar:    { paddingHorizontal: S.lg, paddingBottom: S.sm, gap: S.sm, alignItems: 'center' },
  catChip:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 7, borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgCard },
  catTxt:    { color: C.t2, fontSize: T.xs, fontWeight: '800' },

  statusRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.lg, marginBottom: S.sm, gap: S.sm, flexWrap: 'wrap' },
  statusPill:{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgCard },
  statusTxt: { color: C.t2, fontSize: T.xs, fontWeight: '700' },
  resultCount:{ color: C.t4, fontSize: T.xs, marginLeft: 'auto' },

  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md },
  loadingTxt: { color: C.t2, fontSize: T.sm },
  list:       { paddingHorizontal: S.lg, paddingBottom: 20, gap: S.sm },
  empty:      { alignItems: 'center', paddingVertical: 60, gap: S.md, paddingHorizontal: S.xl },
  emptyTitle: { color: C.t1, fontSize: T.xl, fontWeight: '900', textAlign: 'center' },
  emptySub:   { color: C.t2, fontSize: T.sm, textAlign: 'center', lineHeight: 20 },
  dropBtn:    { borderRadius: R.xl, overflow: 'hidden', marginTop: S.sm },
  dropGrad:   { paddingHorizontal: S.xl, paddingVertical: S.md },
  dropTxt:    { color: '#fff', fontSize: T.base, fontWeight: '900', letterSpacing: 1 },
});