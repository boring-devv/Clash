/**
 * app/notifications.tsx — Day 3 rewrite
 * Firebase-backed notifications with read state
 */
import { useNotifBadge } from '@/app/_layout';
import { C, R, S, T } from '@/constants/theme';
import { useWallet } from '@/context/WalletContext';
import {
  getNotifications,
  markAllRead,
  markRead as markNotifRead,
  type Notification as NotifType
} from '@/services/notifications';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Notif type from service
type Notif = NotifType;

const NOTIF_ICONS: Record<string, string> = {
  challenge_accepted: '⚔️',
  challenge_joined:   '👥',
  voting_open:        '🗳️',
  winner:             '🏆',
  proof_submitted:    '📹',
  challenge_expired:  '💀',
  default:            '🔔',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'just now';
  if (h < 1) return `${m}m ago`;
  if (d < 1) return `${h}h ago`;
  return `${d}d ago`;
}

export default function NotificationsScreen() {
  const { pubkey } = useWallet();
  const router     = useRouter();

  const [notifs,  setNotifs]  = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (pubkey) load(); }, [pubkey]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getNotifications(pubkey!);
      setNotifs(data as Notif[]);
    } catch { setNotifs([]); }
    finally { setLoading(false); }
  };

  const { setUnreadCount } = useNotifBadge();

  const markRead = async (id: string) => {
    setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x));
    await markNotifRead(id);
  };

  const handlePress = (item: Notif) => {
    markRead(item.id);
    const cid = item.data?.challenge_id;
    if (!cid) return;
    if (item.type === 'voting_open') router.push(`/vote/${cid}` as any);
    else router.push(`/challenge/${cid}` as any);
  };

  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.t2} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.title}>NOTIFICATIONS</Text>
          {unreadCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeTxt}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={async () => {
            setNotifs(n => n.map(x => ({ ...x, read: true })));
            if (pubkey) { await markAllRead(pubkey); setUnreadCount(0); }
          }} style={s.markAllBtn}>
            <Text style={s.markAllTxt}>Mark all</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.purple} size="large" />
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={i => i.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          onRefresh={load}
          refreshing={loading}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 48 }}>🔔</Text>
              <Text style={s.emptyTxt}>No notifications yet</Text>
              <Text style={s.emptySub}>Challenge activity will appear here</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handlePress(item)}
              activeOpacity={0.85}
              style={[n.card, !item.read && n.unread]}
            >
              <View style={[n.iconWrap, !item.read && { backgroundColor: C.purple + '25', borderColor: C.purple + '55' }]}>
                <Text style={n.icon}>{NOTIF_ICONS[item.type] ?? NOTIF_ICONS.default}</Text>
              </View>
              <View style={n.body}>
                <Text style={[n.title, !item.read && { color: C.t1 }]} numberOfLines={1}>{item.title}</Text>
                <Text style={n.sub} numberOfLines={2}>{item.body}</Text>
                <Text style={n.time}>{timeAgo(item.created_at)}</Text>
              </View>
              {!item.read && <View style={n.dot} />}
              <Ionicons name="chevron-forward" size={16} color={C.t4} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.lg, paddingVertical: S.md },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  headerCenter:{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingLeft: S.sm },
  title:       { color: C.t1, fontSize: T.xl, fontWeight: '900', letterSpacing: 1 },
  badge:       { backgroundColor: C.pink, borderRadius: R.full, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeTxt:    { color: '#fff', fontSize: 10, fontWeight: '900' },
  markAllBtn:  { paddingHorizontal: S.sm, paddingVertical: 4 },
  markAllTxt:  { color: C.purple, fontSize: T.xs, fontWeight: '700' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:        { padding: S.lg, gap: S.sm, paddingBottom: 40 },
  empty:       { alignItems: 'center', paddingVertical: 60, gap: S.md },
  emptyTxt:    { color: C.t1, fontSize: T.lg, fontWeight: '900' },
  emptySub:    { color: C.t2, fontSize: T.sm, textAlign: 'center' },
});

const n = StyleSheet.create({
  card:     { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, padding: S.md },
  unread:   { borderColor: C.purple + '44', backgroundColor: C.purple + '0A' },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  icon:     { fontSize: 20 },
  body:     { flex: 1, gap: 2 },
  title:    { color: C.t2, fontSize: T.sm, fontWeight: '800' },
  sub:      { color: C.t3, fontSize: T.xs, lineHeight: 18 },
  time:     { color: C.t4, fontSize: T.xs, marginTop: 2 },
  dot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: C.purple },
});