/**
 * app/(tabs)/profile.tsx — Day 3 (original plan)
 * Integrates ClashDNACard + ReceiptCard into profile screen.
 * Tabs: ACTIVE | DNA | RECEIPTS | HISTORY
 */
import { ChallengeRow } from '@/components/ChallengeRow';
import { ClashDNACard } from '@/components/ClashDNACard';
import { ReceiptCard } from '@/components/ReceiptCard';
import { Btn, WalletAvatar } from '@/components/ui';
import { C, R, S, T } from '@/constants/theme';
import { useWallet } from '@/context/WalletContext';
import {
  type Challenge,
  type Profile,
  getProfileByWallet,
  getUserChallenges,
} from '@/services/firebase-challenges';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, FlatList, Image, Platform,
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Tab = 'active' | 'dna' | 'receipts' | 'history';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'active',   label: 'ACTIVE',    icon: '⚔️'  },
  { key: 'dna',      label: 'DNA',       icon: '🧬'  },
  { key: 'receipts', label: 'RECEIPTS',  icon: '🏆'  },
  { key: 'history',  label: 'HISTORY',   icon: '📜'  },
];

export default function ProfileScreen() {
  const { profile, pubkey, disconnect, refreshProfile, solBalance, isDemoMode } = useWallet();
  const router = useRouter();

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [fullProfile, setFullProfile] = useState<Profile | null>(null);
  const [tab,     setTab]     = useState<Tab>('active');
  const [loading, setLoading] = useState(true);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const statsAnim  = useRef(new Animated.Value(0)).current;
  const tabAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (pubkey) {
      refreshProfile();
      loadData();
    }
    Animated.stagger(100, [
      Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(statsAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [pubkey]);

  const loadData = async () => {
    if (!pubkey) return;
    try {
      const [chs, fp] = await Promise.all([
        getUserChallenges(pubkey),
        getProfileByWallet(pubkey),
      ]);
      setChallenges(chs as Challenge[]);
      setFullProfile(fp);
    } catch { setChallenges([]); }
    finally { setLoading(false); }
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    const idx = TABS.findIndex(x => x.key === t);
    Animated.spring(tabAnim, { toValue: idx, useNativeDriver: false, tension: 80, friction: 12 }).start();
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect Wallet', 'You will need to reconnect to use CLASH.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: () => { disconnect(); router.replace('/connect'); } },
    ]);
  };

  if (!profile || !pubkey) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <View style={s.noWallet}>
          <Text style={s.noWalletTxt}>No wallet connected</Text>
          <Btn label="Connect Wallet" onPress={() => router.replace('/connect')} fullWidth size="md" />
        </View>
      </SafeAreaView>
    );
  }

  const addrShort = `${pubkey.slice(0, 6)}...${pubkey.slice(-6)}`;
  const total     = (profile.wins ?? 0) + (profile.losses ?? 0);
  const wr        = total > 0 ? Math.round((profile.wins / total) * 100) : 0;
  const fame      = profile.fame ?? profile.fame_points ?? 0;

  const active   = challenges.filter(c => (['open','active','pending_vote'] as string[]).includes(c.status));
  const history  = challenges.filter(c => (['resolved','completed','expired'] as string[]).includes(c.status));
  // Receipts = challenges I won
  const receipts = history.filter(c => c.winner_id === pubkey);

  const profileForDNA: Profile = fullProfile ?? {
    ...(profile as any),
    wins:  profile.wins  ?? 0,
    losses:profile.losses ?? 0,
    streak:profile.streak ?? 0,
    fame:  fame,
    total_earned: profile.total_earned ?? 0,
    wallet_address: pubkey,
    id: pubkey,
  };

  const STATS = [
    { label: 'WINS',    value: profile.wins ?? 0,   color: C.green  },
    { label: 'LOSSES',  value: profile.losses ?? 0,  color: C.red    },
    { label: 'W/R',     value: `${wr}%`,             color: C.cyan   },
    { label: 'FAME ⚡', value: fame,                 color: C.purple },
  ];

  const badges = [
    (profile.wins ?? 0) >= 1             && { icon: '⚡', label: 'FIRST BLOOD' },
    (profile.wins ?? 0) >= 5             && { icon: '🗡️', label: 'FIGHTER' },
    (profile.wins ?? 0) >= 10            && { icon: '💀', label: 'VETERAN' },
    wr >= 70                             && { icon: '👑', label: 'DOMINANT' },
    (profile.total_earned ?? 0) >= 1     && { icon: '💰', label: 'EARNER' },
    fame >= 100                          && { icon: '🔥', label: 'LEGENDARY' },
    (profile.streak ?? 0) >= 7          && { icon: '🔥', label: '7-DAY STREAK' },
  ].filter(Boolean) as { icon: string; label: string }[];

  const TAB_W = (360 - S.lg * 2) / TABS.length; // approx
  const indicatorLeft = tabAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [0, TAB_W, TAB_W * 2, TAB_W * 3],
  });

  const ProfileHeader = (
    <>
      {/* Top bar */}
      <Animated.View style={[s.topBar, { opacity: headerAnim }]}>
        <Text style={s.screenLabel}>PROFILE</Text>
        <View style={s.topBtns}>
          <TouchableOpacity onPress={() => router.push('/edit-profile' as any)} style={s.iconBtn}>
            <Ionicons name="pencil" size={16} color={C.t2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/settings' as any)} style={s.iconBtn}>
            <Ionicons name="settings-outline" size={16} color={C.t2} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Identity card */}
      <Animated.View style={[s.identityCard, { opacity: headerAnim }]}>
        <LinearGradient colors={['#1C0A3A', C.bgCard]} style={s.identityGrad}>
          <View style={s.orb} />
          <View style={s.identityRow}>
            <View style={s.avatarWrap}>
              <LinearGradient colors={C.gPurple} style={s.avatarRing}>
                {profile.profile_image ? (
                  <Image source={{ uri: profile.profile_image }} style={s.avatarImg} />
                ) : (
                  <WalletAvatar pubkey={pubkey} username={profile.username} size={72} />
                )}
              </LinearGradient>
              <View style={s.onlineDot} />
            </View>
            <View style={s.identityInfo}>
              <Text style={s.username}>{profile.username}</Text>
              <View style={s.addrRow}>
                <Ionicons name="wallet-outline" size={11} color={C.t3} />
                <Text style={s.addrTxt}>{addrShort}</Text>
              </View>
              {wr > 0 && (
                <View style={s.wrPill}>
                  <Text style={s.wrTxt}>{wr}% WIN RATE</Text>
                </View>
              )}
            </View>
          </View>
          <View style={s.earnedStrip}>
            <View style={s.earnedCell}>
              <Text style={s.earnedLbl}>WALLET</Text>
              <View style={s.earnedBalRow}>
                <Text style={s.earnedVal}>◎ {solBalance.toFixed(3)}</Text>
                {isDemoMode && <View style={s.demoPill}><Text style={s.demoPillTxt}>DEMO</Text></View>}
              </View>
            </View>
            <View style={s.earnedDivider} />
            <View style={s.earnedCell}>
              <Text style={s.earnedLbl}>EARNED</Text>
              <Text style={s.earnedVal}>◎ {(profile.total_earned ?? 0).toFixed(3)}</Text>
            </View>
            <View style={s.earnedDivider} />
            <View style={s.earnedCell}>
              <Text style={s.earnedLbl}>BATTLES</Text>
              <Text style={s.earnedVal}>{challenges.length}</Text>
            </View>
            <View style={s.earnedDivider} />
            <View style={s.earnedCell}>
              <Text style={s.earnedLbl}>STREAK</Text>
              <Text style={s.earnedVal}>{profile.streak ?? 0} 🔥</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Stats grid */}
      <Animated.View style={[s.statsGrid, { opacity: statsAnim }]}>
        {STATS.map(({ label, value, color }) => (
          <View key={label} style={s.statCell}>
            <Text style={[s.statVal, { color }]}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </Text>
            <Text style={s.statLabel}>{label}</Text>
          </View>
        ))}
      </Animated.View>

      {/* Badges */}
      {badges.length > 0 && (
        <View style={s.badgesWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.sm, paddingHorizontal: S.lg }}>
            {badges.map(b => (
              <View key={b.label} style={s.badge}>
                <Text style={s.badgeIcon}>{b.icon}</Text>
                <Text style={s.badgeLabel}>{b.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Tab bar */}
      <View style={s.tabsWrap}>
        <View style={s.tabTrack}>
          <Animated.View style={[s.tabIndicator, { left: indicatorLeft }]} />
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={s.tabBtn}
              onPress={() => switchTab(t.key)}
              activeOpacity={0.8}
            >
              <Text style={s.tabIcon}>{t.icon}</Text>
              <Text style={[s.tabBtnTxt, tab === t.key && s.tabBtnTxtOn]}>{t.label}</Text>
              {t.key === 'active'   && active.length > 0   && <View style={[s.tabCount, tab === t.key && { backgroundColor: C.purple }]}><Text style={s.tabCountTxt}>{active.length}</Text></View>}
              {t.key === 'receipts' && receipts.length > 0 && <View style={[s.tabCount, { backgroundColor: C.gold }]}><Text style={s.tabCountTxt}>{receipts.length}</Text></View>}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </>
  );

  // DNA tab content
  if (tab === 'dna') {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <FlatList
          data={[]}
          keyExtractor={() => 'empty'}
          renderItem={() => null}
          ListHeaderComponent={
            <>
              {ProfileHeader}
              <ClashDNACard profile={profileForDNA} challenges={challenges} pubkey={pubkey} />
              <View style={{ height: 20 }} />
            </>
          }
          ListFooterComponent={
            <View style={s.footer}>
              <TouchableOpacity onPress={handleDisconnect} style={s.disconnectBtn}>
                <Ionicons name="log-out-outline" size={16} color={C.red} />
                <Text style={s.disconnectTxt}>Disconnect Wallet</Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 96 : 80 }}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    );
  }

  // Receipts tab content
  if (tab === 'receipts') {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <FlatList
          data={receipts}
          keyExtractor={i => i.id}
          ListHeaderComponent={ProfileHeader}
          contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 96 : 80 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Text style={s.emptyEmoji}>🏆</Text>
              <Text style={s.emptyTitle}>No wins yet</Text>
              <Text style={s.emptySub}>Win a challenge to get your first receipt</Text>
            </View>
          }
          renderItem={({ item: c }) => {
            const winnerProfile: Profile = {
              ...(profileForDNA),
              wallet_address: pubkey,
            };
            return (
              <ReceiptCard
                challenge={c}
                winner={winnerProfile}
                pubkey={pubkey}
              />
            );
          }}
        />
      </SafeAreaView>
    );
  }

  // Active + History tabs (shared FlatList)
  const shown = tab === 'history' ? history : active;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <FlatList
        data={shown}
        keyExtractor={i => i.id}
        ListHeaderComponent={ProfileHeader}
        renderItem={({ item, index }) => (
          <ChallengeRow challenge={item} index={index} pubkey={pubkey} />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyEmoji}>{tab === 'active' ? '🎯' : '📜'}</Text>
              <Text style={s.emptyTitle}>
                {tab === 'active' ? 'No active challenges' : 'No completed challenges'}
              </Text>
              <Text style={s.emptySub}>
                {tab === 'active' ? 'Drop a challenge from the arena' : 'Finish a battle to see history'}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={s.footer}>
            <TouchableOpacity onPress={handleDisconnect} style={s.disconnectBtn}>
              <Ionicons name="log-out-outline" size={16} color={C.red} />
              <Text style={s.disconnectTxt}>Disconnect Wallet</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 96 : 80 }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  noWallet:{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.lg, gap: S.lg },
  noWalletTxt: { color: C.t2, fontSize: T.lg, textAlign: 'center' },

  topBar:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg, paddingTop: S.sm, paddingBottom: S.md },
  screenLabel: { color: C.t3, fontSize: T.xs, fontWeight: '900', letterSpacing: 3 },
  topBtns: { flexDirection: 'row', gap: S.sm },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

  identityCard: { marginHorizontal: S.lg, borderRadius: R['2xl'], overflow: 'hidden', marginBottom: S.md, borderWidth: 1, borderColor: C.border },
  identityGrad: { padding: S.lg, gap: S.lg },
  orb:          { position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: C.purple, opacity: 0.08 },
  identityRow:  { flexDirection: 'row', alignItems: 'center', gap: S.lg },
  avatarWrap:   { position: 'relative' },
  avatarRing:   { width: 86, height: 86, borderRadius: 43, padding: 3, alignItems: 'center', justifyContent: 'center' },
  avatarImg:    { width: 78, height: 78, borderRadius: 39 },
  onlineDot:    { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: C.green, borderWidth: 2, borderColor: C.bgCard },
  identityInfo: { flex: 1, gap: 5 },
  username:     { color: C.t1, fontSize: T['2xl'], fontWeight: '900', letterSpacing: -0.5 },
  addrRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addrTxt:      { color: C.t3, fontSize: T.xs, fontFamily: 'monospace' },
  wrPill:       { alignSelf: 'flex-start', backgroundColor: C.green + '18', borderRadius: R.full, borderWidth: 1, borderColor: C.green + '45', paddingHorizontal: 9, paddingVertical: 3 },
  wrTxt:        { color: C.green, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },

  earnedStrip:   { flexDirection: 'row', backgroundColor: C.bg + 'AA', borderRadius: R.xl, borderWidth: 1, borderColor: C.gold + '30', overflow: 'hidden' },
  earnedCell:    { flex: 1, alignItems: 'center', paddingVertical: S.md },
  earnedDivider: { width: 1, backgroundColor: C.gold + '30' },
  earnedLbl:     { color: C.t3, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 2 },
  earnedVal:     { color: C.gold, fontSize: T.base, fontWeight: '900' },
  earnedBalRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  demoPill:      { backgroundColor: C.orange + '22', borderRadius: R.full, borderWidth: 1, borderColor: C.orange + '55', paddingHorizontal: 5, paddingVertical: 1 },
  demoPillTxt:   { color: C.orange, fontSize: 7, fontWeight: '900', letterSpacing: 1 },

  statsGrid: { flexDirection: 'row', marginHorizontal: S.lg, marginBottom: S.md, backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  statCell:  { flex: 1, alignItems: 'center', paddingVertical: S.md, borderRightWidth: 1, borderRightColor: C.border },
  statVal:   { fontSize: T.xl, fontWeight: '900' },
  statLabel: { color: C.t3, fontSize: 8, fontWeight: '800', letterSpacing: 1, marginTop: 2 },

  badgesWrap: { marginBottom: S.md },
  badge:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bgElevated, borderRadius: R.full, borderWidth: 1, borderColor: C.borderLight, paddingHorizontal: 10, paddingVertical: 6 },
  badgeIcon:  { fontSize: 13 },
  badgeLabel: { color: C.t1, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },

  tabsWrap:     { paddingHorizontal: S.lg, marginBottom: S.sm },
  tabTrack:     { flexDirection: 'row', backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, padding: 4, position: 'relative', height: 44 },
  tabIndicator: { position: 'absolute', top: 4, width: '25%', height: 36, backgroundColor: C.bgElevated, borderRadius: R.lg, borderWidth: 1, borderColor: C.borderLight },
  tabBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, zIndex: 1 },
  tabIcon:      { fontSize: 11 },
  tabBtnTxt:    { color: C.t3, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  tabBtnTxtOn:  { color: C.t1 },
  tabCount:     { backgroundColor: C.t4, borderRadius: R.full, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  tabCountTxt:  { color: '#fff', fontSize: 8, fontWeight: '900' },

  emptyBox:  { alignItems: 'center', paddingVertical: 48, paddingHorizontal: S.xl, gap: S.md },
  emptyEmoji:{ fontSize: 44 },
  emptyTitle:{ color: C.t1, fontSize: T.lg, fontWeight: '900', textAlign: 'center' },
  emptySub:  { color: C.t2, fontSize: T.sm, textAlign: 'center', lineHeight: 20 },

  footer:        { paddingHorizontal: S.lg, marginTop: S.xl, marginBottom: S.lg },
  disconnectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, paddingVertical: S.md, borderRadius: R.xl, borderWidth: 1, borderColor: C.red + '40', backgroundColor: C.red + '0C' },
  disconnectTxt: { color: C.red, fontSize: T.sm, fontWeight: '800' },
});