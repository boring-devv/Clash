/**
 * app/edit-profile.tsx — Firebase rewrite
 */
import { Btn, WalletAvatar } from '@/components/ui';
import { C, R, S, T } from '@/constants/theme';
import { useWallet } from '@/context/WalletContext';
import { db } from '@/lib/firebase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const P_COL = 'profiles';

export default function EditProfileScreen() {
  const router  = useRouter();
  const { profile, pubkey, refreshProfile } = useWallet();

  const [username, setUsername] = useState(profile?.username || '');
  const [saving,   setSaving]   = useState(false);

  const save = async () => {
    const clean = username.trim().toLowerCase().replace(/\s/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!clean || !pubkey) return;
    if (clean.length < 3) { Alert.alert('Too short', 'Username must be 3+ characters'); return; }
    setSaving(true);
    try {
      // Find profile doc by wallet address
      const q    = query(collection(db, P_COL), where('wallet_address', '==', pubkey));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, P_COL, snap.docs[0].id), { username: clean });
      }
      await refreshProfile();
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save');
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
            <Ionicons name="close" size={22} color={C.t2} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>EDIT PROFILE</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={s.body}>
          <View style={s.avatarSection}>
            <WalletAvatar pubkey={pubkey} username={profile?.username} size={84} />
            <Text style={s.walletAddr}>{pubkey?.slice(0, 8)}...{pubkey?.slice(-8)}</Text>
            <Text style={s.walletNote}>Your wallet address is your permanent identity</Text>
          </View>

          <View style={s.field}>
            <Text style={s.label}>DISPLAY NAME</Text>
            <TextInput
              style={s.input}
              value={username}
              onChangeText={t => setUsername(t.toLowerCase().replace(/\s/g, '_'))}
              placeholder="fighter_name"
              placeholderTextColor={C.t3}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            <Text style={s.hint}>Letters, numbers, underscores · {username.length}/20</Text>
          </View>

          <Btn label="SAVE CHANGES" onPress={save} loading={saving} fullWidth size="lg" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: S.lg, borderBottomWidth: 1, borderBottomColor: C.border },
  closeBtn:{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: C.t1, fontSize: T.base, fontWeight: '900', letterSpacing: 2 },
  body:    { padding: S.lg, gap: S.xl },
  avatarSection: { alignItems: 'center', gap: S.sm, paddingVertical: S.lg },
  walletAddr:    { color: C.t2, fontSize: T.sm, fontFamily: 'monospace' },
  walletNote:    { color: C.t3, fontSize: T.xs, textAlign: 'center' },
  field:   { gap: 8 },
  label:   { color: C.t2, fontSize: T.xs, fontWeight: '700', letterSpacing: 1.5, marginLeft: 4 },
  input:   { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, padding: S.md, color: C.t1, fontSize: T.base, height: 52 },
  hint:    { color: C.t3, fontSize: T.xs, marginLeft: 4 },
});