/**
 * app/settings.tsx — Firebase / context rewrite
 */
import { C, R, S, T } from '@/constants/theme';
import { useWallet } from '@/context/WalletContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert, ScrollView, StyleSheet,
  Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const router = useRouter();
  const { pubkey, profile, disconnect } = useWallet();

  const rows = [
    {
      section: 'WALLET',
      items: [
        { label: 'Public Address', sub: pubkey ? `${pubkey.slice(0,10)}...${pubkey.slice(-10)}` : '—', icon: 'wallet-outline' as const },
        { label: 'Network', sub: 'Solana Testnet 🟡', icon: 'radio-outline' as const },
        { label: 'Fame Points', sub: `⚡ ${profile?.fame ?? 0}`, icon: 'star-outline' as const },
      ],
    },
    {
      section: 'APP',
      items: [
        { label: 'Notifications', sub: 'Challenge updates', icon: 'notifications-outline' as const, toggle: true },
        { label: 'Sound Effects',  sub: 'Vote & win sounds', icon: 'volume-high-outline' as const,  toggle: true },
      ],
    },
    {
      section: 'ABOUT',
      items: [
        { label: 'Version',      sub: '1.0.0 — MONOLITH Hackathon Build', icon: 'information-circle-outline' as const },
        { label: 'Terms & Rules',sub: '', icon: 'document-text-outline' as const },
      ],
    },
  ];

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.t2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>SETTINGS</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {rows.map(sec => (
          <View key={sec.section} style={s.section}>
            <Text style={s.sectionLabel}>{sec.section}</Text>
            <View style={s.sectionCard}>
              {sec.items.map((item, i) => (
                <View key={item.label} style={[s.row, i > 0 && s.rowBorder]}>
                  <View style={s.rowIcon}>
                    <Ionicons name={item.icon} size={18} color={C.purple} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>{item.label}</Text>
                    {!!item.sub && <Text style={s.rowSub}>{item.sub}</Text>}
                  </View>
                  {(item as any).toggle
                    ? <Switch value={true} onValueChange={() => {}} trackColor={{ true: C.purple }} thumbColor="#fff" />
                    : <Ionicons name="chevron-forward" size={14} color={C.t3} />
                  }
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={[s.section, { marginTop: S.xl }]}>
          <TouchableOpacity style={s.disconnectBtn} onPress={() => {
            Alert.alert('Disconnect Wallet', 'You will be taken back to the connect screen.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Disconnect', style: 'destructive', onPress: () => { disconnect(); router.replace('/connect'); } },
            ]);
          }}>
            <Ionicons name="log-out-outline" size={18} color={C.red} />
            <Text style={s.disconnectText}>Disconnect Wallet</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: S.lg, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ color: C.t1, fontSize: T.base, fontWeight: '900', letterSpacing: 2 },
  section:    { paddingHorizontal: S.lg, marginTop: S.lg, gap: S.sm },
  sectionLabel:{ color: C.t3, fontSize: T.xs, fontWeight: '800', letterSpacing: 1.5, marginLeft: 4 },
  sectionCard:{ backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  row:        { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md, paddingVertical: 14 },
  rowBorder:  { borderTopWidth: 1, borderTopColor: C.border },
  rowIcon:    { width: 34, height: 34, borderRadius: 17, backgroundColor: C.purpleDim, alignItems: 'center', justifyContent: 'center' },
  rowLabel:   { color: C.t1, fontSize: T.base, fontWeight: '600' },
  rowSub:     { color: C.t3, fontSize: T.xs, marginTop: 2 },
  disconnectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, backgroundColor: C.red + '15', borderRadius: R.xl, borderWidth: 1, borderColor: C.red + '40', padding: S.md },
  disconnectText:{ color: C.red, fontSize: T.base, fontWeight: '700' },
});