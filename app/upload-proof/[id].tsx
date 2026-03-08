/**
 * app/upload-proof/[id].tsx — Day 3 rewrite
 * Uses ProofRecorder inline camera + uploads via Cloudinary
 */
import { ProofRecorder } from '@/components/ProofRecorder';
import { C, R, S, T } from '@/constants/theme';
import { useWallet } from '@/context/WalletContext';
import {
  getChallengeById,
  uploadProof,
  type Challenge
} from '@/services/firebase-challenges';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Phase = 'loading' | 'camera' | 'preview' | 'uploading' | 'done';

export default function UploadProofScreen() {
  const { id }     = useLocalSearchParams();
  const router     = useRouter();
  const { pubkey } = useWallet();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [phase,     setPhase]     = useState<Phase>('loading');
  const [proofUri,  setProofUri]  = useState<string | null>(null);
  const [progress,  setProgress]  = useState(0);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const ch = await getChallengeById(id as string);
      setChallenge(ch);

      // Check if user already submitted
      const isCreator  = pubkey === ch?.creator_id;
      const isOpponent = pubkey === ch?.opponent_id;
      const alreadyDone = (isCreator && !!ch?.creator_proof_url) ||
                          (isOpponent && !!ch?.opponent_proof_url);

      if (alreadyDone) {
        Alert.alert('Already submitted', 'You already uploaded your proof for this challenge.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }

      setPhase('camera');
    } catch {
      Alert.alert('Error', 'Could not load challenge');
      router.back();
    }
  };

  const onVideoRecorded = (uri: string) => {
    setProofUri(uri);
    setPhase('preview');
  };

  const submit = async () => {
    if (!pubkey || !proofUri || !challenge) return;
    setPhase('uploading');

    // Fake progress animation
    const interval = setInterval(() => {
      setProgress(p => Math.min(p + 8, 88));
    }, 400);

    try {
      await uploadProof(challenge.id, pubkey, proofUri);
      clearInterval(interval);
      setProgress(100);
      setPhase('done');
      setTimeout(() => router.replace(`/challenge/${challenge.id}` as any), 1800);
    } catch (e: any) {
      clearInterval(interval);
      Alert.alert('Upload failed', e?.message ?? 'Please try again');
      setPhase('preview');
    }
  };

  // Loading
  if (phase === 'loading') {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.purple} size="large" />
        <Text style={s.loadingTxt}>Loading challenge...</Text>
      </View>
    );
  }

  // Camera
  if (phase === 'camera') {
    return (
      <ProofRecorder
        title="Record Your Proof"
        subtitle={challenge?.title ?? 'Show yourself completing the challenge. Max 60 seconds.'}
        maxDuration={60}
        onVideoRecorded={onVideoRecorded}
        onCancel={() => router.back()}
      />
    );
  }

  // Uploading
  if (phase === 'uploading') {
    return (
      <View style={s.center}>
        <View style={s.uploadBox}>
          <Text style={{ fontSize: 48 }}>📤</Text>
          <Text style={s.uploadTitle}>UPLOADING PROOF</Text>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progress}%` as any }]} />
          </View>
          <Text style={s.progressTxt}>{progress}%</Text>
          <Text style={s.uploadSub}>Don't close the app...</Text>
        </View>
      </View>
    );
  }

  // Done
  if (phase === 'done') {
    return (
      <View style={s.center}>
        <LinearGradient colors={[C.green + '28', C.green + '08']} style={s.doneBox}>
          <Text style={{ fontSize: 64 }}>✅</Text>
          <Text style={s.doneTitle}>PROOF SUBMITTED</Text>
          <Text style={s.doneSub}>Redirecting to challenge...</Text>
          <ActivityIndicator color={C.green} />
        </LinearGradient>
      </View>
    );
  }

  // Preview
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => setPhase('camera')} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.t2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>REVIEW PROOF</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Challenge title */}
      {challenge && (
        <View style={s.challengeBox}>
          <Text style={s.challengeLabel}>CHALLENGE</Text>
          <Text style={s.challengeTitle} numberOfLines={2}>{challenge.title}</Text>
        </View>
      )}

      {/* Video preview */}
      {proofUri && (
        <View style={s.videoWrap}>
          <Video
            source={{ uri: proofUri }}
            style={s.video}
            resizeMode={ResizeMode.COVER}
            useNativeControls
            isLooping={false}
          />
        </View>
      )}

      {/* Tips */}
      <View style={s.tipsBox}>
        <Text style={s.tipsTitle}>Before submitting:</Text>
        {[
          'Does the video clearly show you doing the challenge?',
          'Is your face visible?',
          'Good lighting?',
        ].map((t, i) => (
          <View key={i} style={s.tipRow}>
            <Ionicons name="checkmark-circle-outline" size={16} color={C.green} />
            <Text style={s.tipTxt}>{t}</Text>
          </View>
        ))}
      </View>

      {/* Buttons */}
      <View style={s.footer}>
        <TouchableOpacity onPress={() => { setProofUri(null); setPhase('camera'); }} style={s.retakeBtn}>
          <Ionicons name="refresh" size={18} color={C.t2} />
          <Text style={s.retakeTxt}>Retake</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={submit} style={s.submitBtn} activeOpacity={0.85}>
          <LinearGradient colors={C.gPurple} style={s.submitGrad}>
            <Ionicons name="cloud-upload" size={20} color="#fff" />
            <Text style={s.submitTxt}>SUBMIT PROOF</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: S.xl },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.lg, paddingVertical: S.md },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: C.t1, fontSize: T.base, fontWeight: '900', letterSpacing: 1 },

  challengeBox:   { marginHorizontal: S.lg, marginBottom: S.md, gap: 4 },
  challengeLabel: { color: C.t3, fontSize: T.xs, fontWeight: '800', letterSpacing: 1.5 },
  challengeTitle: { color: C.t1, fontSize: T.lg, fontWeight: '900', lineHeight: 26 },

  videoWrap: { flex: 1, marginHorizontal: S.lg, borderRadius: R.xl, overflow: 'hidden', backgroundColor: '#000', borderWidth: 1, borderColor: C.border },
  video:     { flex: 1 },

  tipsBox:  { marginHorizontal: S.lg, marginTop: S.md, backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, padding: S.md, gap: S.sm },
  tipsTitle:{ color: C.t2, fontSize: T.sm, fontWeight: '800' },
  tipRow:   { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  tipTxt:   { color: C.t2, fontSize: T.sm, flex: 1 },

  footer:    { flexDirection: 'row', gap: S.md, padding: S.lg, paddingBottom: 34 },
  retakeBtn: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.lg, paddingVertical: S.md, borderRadius: R.xl, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border },
  retakeTxt: { color: C.t2, fontSize: T.sm, fontWeight: '700' },
  submitBtn: { flex: 1, borderRadius: R.xl, overflow: 'hidden' },
  submitGrad:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, paddingVertical: S.md },
  submitTxt: { color: '#fff', fontSize: T.base, fontWeight: '900', letterSpacing: 1 },

  loadingTxt: { color: C.t2, fontSize: T.sm, marginTop: S.md },
  uploadBox:  { alignItems: 'center', gap: S.md, width: '100%' },
  uploadTitle:{ color: C.t1, fontSize: T.xl, fontWeight: '900', letterSpacing: 2 },
  progressTrack: { width: '100%', height: 8, backgroundColor: C.bgElevated, borderRadius: 4, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: C.purple, borderRadius: 4 },
  progressTxt:   { color: C.purple, fontSize: T.lg, fontWeight: '900' },
  uploadSub:     { color: C.t3, fontSize: T.sm },

  doneBox:   { alignItems: 'center', gap: S.md, padding: S.xl, borderRadius: R['2xl'], borderWidth: 1, borderColor: C.green + '44', width: '100%' },
  doneTitle: { color: C.green, fontSize: T.xl, fontWeight: '900', letterSpacing: 2 },
  doneSub:   { color: C.t2, fontSize: T.sm },
});