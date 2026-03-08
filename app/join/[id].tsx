/**
 * app/join/[id].tsx — Day 2 full rewrite
 * Flow: See challenge details + creator proof → ACCEPT → Camera → Record proof → Submit + Escrow
 */
import { ProofRecorder } from '@/components/ProofRecorder';
import { Btn, CatPill, WalletAvatar } from '@/components/ui';
import { C, CAT_COLORS, R, S, T } from '@/constants/theme';
import { useWallet } from '@/context/WalletContext';
import { getChallengeById, joinChallenge } from '@/services/firebase-challenges';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, Animated,
    Dimensions, ScrollView, StyleSheet,
    Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

type JoinPhase = 'details' | 'camera' | 'submitting' | 'success';

export default function JoinScreen() {
  const { id }    = useLocalSearchParams();
  const router    = useRouter();
  const { pubkey, profile, signAndDeposit, isDemoMode } = useWallet();

  const [challenge, setChallenge] = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [phase,     setPhase]     = useState<JoinPhase>('details');
  const [proofUri,  setProofUri]  = useState<string | null>(null);

  // Animations
  const sheetY      = useRef(new Animated.Value(height)).current;
  const bgOpacity   = useRef(new Animated.Value(0)).current;
  const vsAnim      = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const ch = await getChallengeById(id as string);
      setChallenge(ch);
      // Slide in
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(sheetY,    { toValue: 0, useNativeDriver: true, tension: 65, friction: 12 }),
      ]).start(() => {
        Animated.spring(vsAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
        Animated.loop(Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
        ])).start();
      });
    } catch {
      Alert.alert('Error', 'Could not load challenge'); router.back();
    } finally { setLoading(false); }
  };

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(bgOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(sheetY,    { toValue: height, duration: 280, useNativeDriver: true }),
    ]).start(() => router.back());
  };

  // ── Camera phase ───────────────────────────────────────────────
  if (phase === 'camera') {
    return (
      <ProofRecorder
        title="Record Your Proof"
        subtitle="This is your submission. Show yourself doing the challenge."
        maxDuration={60}
        onVideoRecorded={(uri) => {
          setProofUri(uri);
          setPhase('details');
        }}
        onCancel={() => setPhase('details')}
      />
    );
  }

  // ── Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loadingRoot}>
        <ActivityIndicator color={C.purple} size="large" />
      </View>
    );
  }

  if (!challenge) return null;

  const catCol      = CAT_COLORS[challenge.category] || C.purple;
  const stakeAmt    = challenge.stake_sol ?? 0;
  const isCreator   = pubkey === challenge.creator_id;
  const isFull      = challenge.participant_count >= challenge.max_participants;
  const alreadyIn   = challenge.participants?.includes(pubkey);
  const isOpen      = challenge.status === 'open';
  const canJoin     = !isCreator && !alreadyIn && isOpen && !isFull;

  // ── Submit proof + join ────────────────────────────────────────
  const submitAndJoin = async () => {
    if (!pubkey || !proofUri) return;
    setPhase('submitting');
    try {
      // Deposit escrow if staked
      let txSig: string | undefined;
      if (stakeAmt > 0) {
        try {
          txSig = await signAndDeposit(challenge.id, stakeAmt);
        } catch (e: any) {
          const msg = e?.message ?? 'Transaction cancelled';
          const isCancel = msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('declined');
          Alert.alert(
            isCancel ? 'Transaction Cancelled' : 'Deposit Failed',
            isCancel
              ? 'You cancelled the transaction. You have not joined the challenge.'
              : `Could not lock SOL in escrow: ${msg}`,
          );
          setPhase('details');
          return;
        }

        if (!txSig) {
          Alert.alert('Deposit Required', 'Payment must be approved before joining this challenge.');
          setPhase('details');
          return;
        }
      }

      await joinChallenge(challenge.id, pubkey, proofUri, txSig);

      // Success animation
      pulseAnim.stopAnimation();
      Animated.spring(successAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }).start();
      setPhase('success');

      setTimeout(() => router.replace(`/challenge/${challenge.id}` as any), 2400);
    } catch (e: any) {
      Alert.alert('Failed to join', e?.message ?? 'Please try again');
      setPhase('details');
    }
  };

  return (
    <View style={s.root}>
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: bgOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={dismiss} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[s.sheet, { transform: [{ translateY: sheetY }] }]}>
        <SafeAreaView edges={['bottom']}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={s.sheetContent}>

            {/* Handle */}
            <View style={s.handleWrap}><View style={s.handle} /></View>

            {/* Header */}
            <View style={s.sheetHeader}>
              <CatPill category={challenge.category} />
              <TouchableOpacity onPress={dismiss} style={s.closeBtn}>
                <Ionicons name="close" size={18} color={C.t2} />
              </TouchableOpacity>
            </View>

            {/* Title */}
            <View style={[s.titleBlock, { borderLeftColor: catCol }]}>
              <Text style={s.challengeTitle}>{challenge.title}</Text>
              {!!challenge.description && <Text style={s.challengeDesc}>{challenge.description}</Text>}
            </View>

            {/* VS row */}
            <View style={s.vsRow}>
              {/* Creator */}
              <View style={s.playerSide}>
                <LinearGradient colors={[catCol+'40', catCol+'10']} style={s.playerCard}>
                  <WalletAvatar pubkey={challenge.creator?.wallet_address || challenge.creator_id} username={challenge.creator?.username} size={50} />
                  <Text style={s.playerName} numberOfLines={1}>{challenge.creator?.username ?? 'Challenger'}</Text>
                  <View style={s.statRow}>
                    <Text style={s.statTxt}>⚡ {challenge.creator?.fame ?? 0}</Text>
                    <Text style={[s.statBold, { color: catCol }]}>{challenge.creator?.wins ?? 0}W</Text>
                  </View>
                  <View style={[s.tag, { backgroundColor: catCol+'25', borderColor: catCol+'55' }]}>
                    <Text style={[s.tagTxt, { color: catCol }]}>CHALLENGER</Text>
                  </View>
                </LinearGradient>
              </View>

              {/* VS badge */}
              <Animated.View style={[s.vsCenter, { transform: [{ scale: vsAnim }] }]}>
                <LinearGradient colors={C.gFire} style={s.vsBadge}>
                  <Text style={s.vsTxt}>VS</Text>
                </LinearGradient>
                {stakeAmt > 0 && (
                  <View style={s.potWrap}>
                    <Text style={s.potAmt}>◎{(stakeAmt * 2).toFixed(1)}</Text>
                    <Text style={s.potLabel}>TOTAL POT</Text>
                  </View>
                )}
              </Animated.View>

              {/* You */}
              <View style={s.playerSide}>
                <LinearGradient colors={[C.green+'28', C.green+'08']} style={[s.playerCard, { borderColor: C.green+'44', borderStyle: 'dashed' }]}>
                  {profile ? (
                    <>
                      <WalletAvatar pubkey={pubkey!} username={profile.username} size={50} />
                      <Text style={s.playerName} numberOfLines={1}>{profile.username}</Text>
                      <View style={s.statRow}>
                        <Text style={s.statTxt}>⚡ {profile.fame ?? 0}</Text>
                        <Text style={[s.statBold, { color: C.green }]}>{profile.wins ?? 0}W</Text>
                      </View>
                    </>
                  ) : (
                    <View style={s.youPlaceholder}><Text style={{ fontSize: 22 }}>👤</Text></View>
                  )}
                  <View style={[s.tag, { backgroundColor: C.green+'18', borderColor: C.green+'44' }]}>
                    <Text style={[s.tagTxt, { color: C.green }]}>OPPONENT</Text>
                  </View>
                </LinearGradient>
              </View>
            </View>

            {/* Creator proof video preview */}
            {challenge.creator_proof_url && (
              <View style={s.creatorProofWrap}>
                <Text style={s.sectionLabel}>CREATOR'S PROOF</Text>
                <View style={s.videoWrap}>
                  <Video
                    source={{ uri: challenge.creator_proof_url }}
                    style={s.video}
                    resizeMode={ResizeMode.COVER}
                    useNativeControls
                    isLooping={false}
                  />
                  <View style={s.videoBadge}><Text style={s.videoBadgeTxt}>👀 STUDY THIS</Text></View>
                </View>
              </View>
            )}

            {/* Stats grid */}
            <View style={s.statsGrid}>
              <StatBox icon="⏱" label="DEADLINE"   value={`${challenge.duration_hours}h to prove`}                    color={C.cyan}   />
              <StatBox icon="💰" label="YOUR STAKE" value={stakeAmt > 0 ? `◎${stakeAmt} SOL` : 'FREE'}               color={stakeAmt > 0 ? C.gold : C.t2} />
              <StatBox icon="🏆" label="YOU WIN"    value={stakeAmt > 0 ? `◎${(stakeAmt*2).toFixed(1)}` : 'Glory'}   color={stakeAmt > 0 ? C.green : C.purple} />
              <StatBox icon="🗳️" label="JUDGED BY"  value="Community"                                                  color={C.purple} />
            </View>

            {/* How it works */}
            <View style={s.rulesBox}>
              <Text style={s.rulesTitle}>HOW IT WORKS</Text>
              {[
                { col: C.purple, txt: 'Record your proof video — show yourself doing the challenge' },
                { col: C.cyan,   txt: 'Community watches both videos and votes for the winner' },
                { col: C.green,  txt: stakeAmt > 0 ? `Winner receives ◎${(stakeAmt*2).toFixed(1)} SOL from escrow` : 'Winner earns fame points and a win on their record' },
              ].map((r, i) => (
                <View key={i} style={s.ruleRow}>
                  <View style={[s.ruleDot, { backgroundColor: r.col }]} />
                  <Text style={s.ruleTxt}>{r.txt}</Text>
                </View>
              ))}
            </View>

            {/* Proof video status */}
            {canJoin && (
              <View style={s.proofSection}>
                {!proofUri ? (
                  <TouchableOpacity onPress={() => setPhase('camera')} activeOpacity={0.85} style={s.recordBtn}>
                    <LinearGradient colors={[C.purple, C.purpleDark]} style={s.recordBtnGrad}>
                      <Ionicons name="videocam" size={20} color="#fff" />
                      <Text style={s.recordBtnTxt}>RECORD YOUR PROOF FIRST</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <View style={s.proofReady}>
                    <LinearGradient colors={[C.green+'22', C.green+'08']} style={s.proofReadyInner}>
                      <Ionicons name="checkmark-circle" size={22} color={C.green} />
                      <Text style={s.proofReadyTxt}>Proof recorded ✅</Text>
                      <TouchableOpacity onPress={() => { setProofUri(null); setPhase('camera'); }} style={s.retakeBtn}>
                        <Text style={s.retakeTxt}>Retake</Text>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
                )}
              </View>
            )}

            {/* Warnings */}
            {isCreator && (
              <View style={s.warningBox}>
                <Ionicons name="shield-checkmark" size={18} color={C.orange} />
                <Text style={s.warningTxt}>You created this — wait for an opponent to accept.</Text>
              </View>
            )}
            {alreadyIn && (
              <View style={[s.warningBox, { borderColor: C.purple+'44', backgroundColor: C.purple+'0C' }]}>
                <Ionicons name="checkmark-circle" size={18} color={C.purple} />
                <Text style={[s.warningTxt, { color: C.purple }]}>You're already in this challenge!</Text>
              </View>
            )}
            {!isCreator && isFull && !alreadyIn && (
              <View style={[s.warningBox, { borderColor: C.t3+'33', backgroundColor: C.t3+'0C' }]}>
                <Ionicons name="ban-outline" size={18} color={C.t3} />
                <Text style={[s.warningTxt, { color: C.t3 }]}>This challenge is full. Check the feed for open challenges.</Text>
              </View>
            )}

            {/* CTA */}
            <View style={s.ctaSection}>
              {phase === 'success' ? (
                <Animated.View style={[s.successBox, { transform: [{ scale: successAnim }] }]}>
                  <LinearGradient colors={[C.green+'30', C.green+'10']} style={s.successInner}>
                    <Text style={{ fontSize: 48 }}>⚔️</Text>
                    <Text style={s.successTitle}>FIGHT ACCEPTED</Text>
                    <Text style={s.successSub}>Upload your proof before the deadline.{'\n'}Good luck.</Text>
                    <ActivityIndicator color={C.green} size="small" style={{ marginTop: S.sm }} />
                  </LinearGradient>
                </Animated.View>
              ) : phase === 'submitting' ? (
                <View style={s.submittingBox}>
                  <ActivityIndicator color={C.purple} size="large" />
                  <Text style={s.submittingTxt}>Locking you in on-chain...</Text>
                </View>
              ) : canJoin ? (
                <>
                  {proofUri && (
                    <Animated.View style={{ transform: [{ scale: pulseAnim }], width: '100%' }}>
                      <Btn
                        label={`⚔️  ACCEPT THE FIGHT${stakeAmt > 0 ? ` · ◎${stakeAmt} SOL` : ''}`}
                        onPress={submitAndJoin}
                        fullWidth size="lg"
                      />
                    </Animated.View>
                  )}
                  {stakeAmt > 0 && (
                    <Text style={s.disclaimer}>◎{stakeAmt} SOL locked in escrow when you accept.</Text>
                  )}
                </>
              ) : (
                <Btn label="← Back" onPress={dismiss} variant="ghost" fullWidth size="lg" />
              )}
            </View>

          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

function StatBox({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={[sb.box, { borderColor: color+'30', backgroundColor: color+'0C' }]}>
      <Text style={sb.icon}>{icon}</Text>
      <Text style={[sb.value, { color }]}>{value}</Text>
      <Text style={sb.label}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, justifyContent: 'flex-end' },
  loadingRoot: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.78)' },

  sheet: {
    backgroundColor: C.bgCard, borderTopLeftRadius: R['2xl'], borderTopRightRadius: R['2xl'],
    borderWidth: 1, borderBottomWidth: 0, borderColor: C.border,
    maxHeight: height * 0.94, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24, elevation: 20,
  },
  sheetContent: { paddingBottom: 12 },
  handleWrap:   { alignItems: 'center', paddingTop: S.md, paddingBottom: S.xs },
  handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderLight },

  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg, marginBottom: S.md },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

  titleBlock:      { marginHorizontal: S.lg, marginBottom: S.lg, borderLeftWidth: 3, paddingLeft: S.md, gap: 5 },
  challengeTitle:  { color: C.t1, fontSize: T.xl, fontWeight: '900', lineHeight: 28 },
  challengeDesc:   { color: C.t2, fontSize: T.sm, lineHeight: 20 },

  // VS row
  vsRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.lg, gap: S.sm, marginBottom: S.lg },
  playerSide: { flex: 1 },
  playerCard: { borderRadius: R.xl, borderWidth: 1, borderColor: C.border, padding: S.sm, alignItems: 'center', gap: 4 },
  playerName: { color: C.t1, fontSize: T.xs, fontWeight: '800', textAlign: 'center' },
  statRow:    { flexDirection: 'row', gap: S.sm, alignItems: 'center' },
  statTxt:    { color: C.t3, fontSize: 9, fontWeight: '600' },
  statBold:   { fontSize: 9, fontWeight: '900' },
  tag:        { borderRadius: R.full, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  tagTxt:     { fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  youPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: C.green+'18', alignItems: 'center', justifyContent: 'center' },

  vsCenter: { alignItems: 'center', gap: S.sm },
  vsBadge:  { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: C.orange, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },
  vsTxt:    { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  potWrap:  { alignItems: 'center', gap: 1 },
  potAmt:   { color: C.gold, fontSize: T.sm, fontWeight: '900' },
  potLabel: { color: C.gold+'90', fontSize: 7, fontWeight: '800', letterSpacing: 1 },

  // Creator proof video
  creatorProofWrap: { marginHorizontal: S.lg, marginBottom: S.lg, gap: S.sm },
  sectionLabel:     { color: C.t3, fontSize: T.xs, fontWeight: '800', letterSpacing: 1.5 },
  videoWrap:        { borderRadius: R.xl, overflow: 'hidden', height: 180, position: 'relative', borderWidth: 1, borderColor: C.purple+'55' },
  video:            { flex: 1 },
  videoBadge:       { position: 'absolute', top: S.sm, left: S.sm, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 4 },
  videoBadgeTxt:    { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: S.lg, gap: S.sm, marginBottom: S.lg },

  rulesBox:  { marginHorizontal: S.lg, marginBottom: S.md, backgroundColor: C.bgElevated, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, padding: S.md, gap: S.sm },
  rulesTitle:{ color: C.t3, fontSize: T.xs, fontWeight: '800', letterSpacing: 1.5, marginBottom: 2 },
  ruleRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm },
  ruleDot:   { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  ruleTxt:   { color: C.t2, fontSize: T.sm, flex: 1, lineHeight: 20 },

  // Proof section
  proofSection:   { marginHorizontal: S.lg, marginBottom: S.md },
  recordBtn:      { borderRadius: R.xl, overflow: 'hidden' },
  recordBtnGrad:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, paddingVertical: S.md },
  recordBtnTxt:   { color: '#fff', fontSize: T.base, fontWeight: '900', letterSpacing: 1 },
  proofReady:     {},
  proofReadyInner:{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderRadius: R.xl, borderWidth: 1, borderColor: C.green+'33', padding: S.md },
  proofReadyTxt:  { color: C.green, fontSize: T.sm, fontWeight: '800', flex: 1 },
  retakeBtn:      { paddingHorizontal: S.sm, paddingVertical: 4, borderRadius: R.full, borderWidth: 1, borderColor: C.border },
  retakeTxt:      { color: C.t3, fontSize: T.xs, fontWeight: '700' },

  warningBox: { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm, marginHorizontal: S.lg, marginBottom: S.md, backgroundColor: C.orange+'0C', borderRadius: R.xl, borderWidth: 1, borderColor: C.orange+'33', padding: S.md },
  warningTxt: { color: C.orange, fontSize: T.sm, flex: 1, lineHeight: 20 },

  ctaSection:    { paddingHorizontal: S.lg, gap: S.sm, paddingTop: S.sm },
  disclaimer:    { color: C.t3, fontSize: T.xs, textAlign: 'center', lineHeight: 18 },
  submittingBox: { alignItems: 'center', gap: S.md, paddingVertical: S.xl },
  submittingTxt: { color: C.t2, fontSize: T.base, fontWeight: '700' },

  successBox:   { borderRadius: R['2xl'], overflow: 'hidden' },
  successInner: { padding: S.xl, alignItems: 'center', gap: S.sm, borderRadius: R['2xl'], borderWidth: 1, borderColor: C.green+'40' },
  successTitle: { color: C.green, fontSize: T['2xl'], fontWeight: '900', letterSpacing: 2 },
  successSub:   { color: C.t2, fontSize: T.sm, textAlign: 'center', lineHeight: 20 },
});

const sb = StyleSheet.create({
  box:   { width: (width - S.lg*2 - S.sm)/2, borderRadius: R.xl, borderWidth: 1, padding: S.md, alignItems: 'center', gap: 3 },
  icon:  { fontSize: 20 },
  value: { fontSize: T.base, fontWeight: '900' },
  label: { color: C.t3, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
});