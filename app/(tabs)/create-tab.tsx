/**
 * app/create-challenge.tsx — Day 2 full rewrite
 * 5-step flow: Type → Prize Model → Details → Record Proof → Launch
 */
import { ProofRecorder } from '@/components/ProofRecorder';
import { WalletAvatar } from '@/components/ui';
import { C, CAT_COLORS, CAT_ICONS, R, S, T } from '@/constants/theme';
import { useWallet } from '@/context/WalletContext';
import {
  createChallenge,
  getProfileByWallet,
  preGenerateChallengeId,
  type ChallengeType,
  type PrizeModel,
} from '@/services/firebase-challenges';
import { getEscrowAddress } from '@/services/solana';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Dimensions,
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const TOTAL_STEPS = 5;

const CATEGORIES = [
  { id: 'fitness', label: 'Fitness', icon: '💪' },
  { id: 'gaming',  label: 'Gaming',  icon: '🎮' },
  { id: 'cooking', label: 'Cooking', icon: '🍳' },
  { id: 'art',     label: 'Art',     icon: '🎨' },
  { id: 'music',   label: 'Music',   icon: '🎵' },
  { id: 'dance',   label: 'Dance',   icon: '💃' },
  { id: 'sport',   label: 'Sport',   icon: '⚽' },
  { id: 'other',   label: 'Other',   icon: '⚡' },
];

const DURATIONS       = [1, 6, 24, 48, 168];
const DURATION_LABELS: Record<number, string> = { 1: '1H', 6: '6H', 24: '24H', 48: '48H', 168: '7D' };
const VOTING_DURATIONS = [12, 24, 48, 72];
const STEP_TITLES = ['Who', 'Stakes', 'Details', 'Your Proof', 'Launch'];

export default function CreateChallengeScreen() {
  const { pubkey, profile, solBalance, signAndDeposit, airdropDevnet, isDemoMode } = useWallet();

  // ── Form state ─────────────────────────────────────────────────
  const [step,            setStep]            = useState(0);
  const [type,            setType]            = useState<ChallengeType>('open');
  const [targetSearch,    setTargetSearch]    = useState('');
  const [targetUser,      setTargetUser]      = useState<any>(null);
  const [searchLoading,   setSearchLoading]   = useState(false);
  const [prizeModel,      setPrizeModel]      = useState<PrizeModel>('D');
  const [isHostOnly,      setIsHostOnly]      = useState(false);
  const [prizeAmount,     setPrizeAmount]     = useState('');
  const [title,           setTitle]           = useState('');
  const [desc,            setDesc]            = useState('');
  const [category,        setCategory]        = useState('fitness');
  const [duration,        setDuration]        = useState(24);
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [votingDuration,  setVotingDuration]  = useState(24);
  const [proofUri,        setProofUri]        = useState<string | null>(null);
  const [showCamera,      setShowCamera]      = useState(false);
  const [launching,       setLaunching]       = useState(false);

  // ── Animations ─────────────────────────────────────────────────
  const slideAnim   = useRef(new Animated.Value(0)).current;
  const fadeAnim    = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: ((step + 1) / TOTAL_STEPS) * 100,
      useNativeDriver: false, tension: 60, friction: 10,
    }).start();
  }, [step]);

  const animateStep = (dir: 'forward' | 'back', cb: () => void) => {
    const out = dir === 'forward' ? -width * 0.3 : width * 0.3;
    const inn = dir === 'forward' ?  width * 0.3 : -width * 0.3;
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0,   duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: out,  duration: 150, useNativeDriver: true }),
    ]).start(() => {
      slideAnim.setValue(inn);
      cb();
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
      ]).start();
    });
  };

  const shake = () => Animated.sequence([
    Animated.timing(shakeAnim, { toValue: 10,  duration: 55, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: 6,   duration: 55, useNativeDriver: true }),
    Animated.timing(shakeAnim, { toValue: 0,   duration: 55, useNativeDriver: true }),
  ]).start();

  // ── Validation ─────────────────────────────────────────────────
  const canGoNext = (): boolean => {
    if (step === 0 && type === '1v1' && !targetUser) return false;
    if (step === 1) {
      if (['A','B','C'].includes(prizeModel)) {
        const a = parseFloat(prizeAmount);
        if (isNaN(a) || a <= 0) return false;
      }
    }
    if (step === 2 && !title.trim()) return false;
    if (step === 3 && !proofUri && !isHostOnly) return false;
    return true;
  };

  const goNext = () => {
    if (!canGoNext()) { shake(); return; }
    if (step === 2 && isHostOnly) { setStep(4); return; }
    if (step < TOTAL_STEPS - 1) setStep(s => s + 1);
  };

  const goBack = () => {
    if (step === 0) { router.back(); return; }
    if (step === 4 && isHostOnly) { animateStep('back', () => setStep(2)); return; }
    animateStep('back', () => setStep(s => s - 1));
  };

  // ── User search ────────────────────────────────────────────────
  const searchUser = useCallback(async (q: string) => {
    setTargetSearch(q);
    if (q.length < 6) { setTargetUser(null); return; }
    setSearchLoading(true);
    try {
      const p = await getProfileByWallet(q);
      setTargetUser(p || null);
    } catch { setTargetUser(null); }
    finally { setSearchLoading(false); }
  }, []);

  // ── Launch ─────────────────────────────────────────────────────
  const [launchStatus, setLaunchStatus] = useState<'idle'|'creating'|'depositing'|'done'>('idle');

  const launch = async () => {
    if (!pubkey) { Alert.alert('Connect wallet first'); return; }
    const prize        = parseFloat(prizeAmount) || 0;
    const needsDeposit = ['A', 'B', 'C'].includes(prizeModel) && prize > 0;

    // Block if not enough balance BEFORE opening the wallet
    if (needsDeposit && solBalance < prize && !isDemoMode) {
      Alert.alert(
        'Insufficient Balance',
        `Need ◎${prize} SOL to fund escrow.\nYou have ◎${solBalance.toFixed(3)}.`,
        [
          { text: 'Get Testnet SOL', onPress: airdropDevnet },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    setLaunching(true);
    console.log('[launch] Start', { prizeModel, prizeAmount, needsDeposit });
    try {
      // ── Step 1: Pre-generate the Firestore doc ID ─────────────
      setLaunchStatus('creating');
      const challengeId    = preGenerateChallengeId();
      console.log('[launch] Generated ID:', challengeId);
      const escrowAddr     = getEscrowAddress(challengeId);

      // ── Step 2: Upload proof video (before opening wallet) ────
      let uploadedProofUri = proofUri;

      // ── Step 3: If staked, sign the deposit tx in ONE session ─
      let depositTxSig: string | undefined;
      if (needsDeposit) {
        console.log('[launch] Depositing SOL...');
        setLaunchStatus('depositing');
        try {
          depositTxSig = await signAndDeposit(challengeId, prize);
          console.log('[launch] Deposit success:', depositTxSig);
        } catch (depositErr: any) {
          console.error('[launch] Deposit error:', depositErr);
          const msg      = depositErr?.message ?? 'Transaction cancelled';
          const isCancel = msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('declined');
          Alert.alert(
            isCancel ? 'Transaction Cancelled' : 'Deposit Failed',
            isCancel
              ? 'You cancelled the transaction. Nothing was created.'
              : `Could not lock SOL in escrow: ${msg}`,
          );
          return;
        }
      }

      if (needsDeposit && !depositTxSig) {
        Alert.alert('Deposit Required', 'Payment must be approved before creating this challenge.');
        return;
      }

      // ── Step 4: Write challenge to Firestore (tx already confirmed) ──
      console.log('[launch] Creating challenge in Firestore...');
      setLaunchStatus('creating');
      await createChallenge(
        {
          creator_id:            pubkey,
          title:                 title.trim(),
          description:           desc.trim(),
          category,
          type,
          prize_model:           prizeModel,
          is_host_only:          isHostOnly,
          target_user_id:        targetUser?.wallet_address || null,
          max_participants:      type === '1v1' ? 2 : maxParticipants,
          prize_pool:            prize,
          stake_sol:             ['B', 'C'].includes(prizeModel) ? prize : 0,
          duration_hours:        duration,
          voting_duration_hours: votingDuration,
        },
        uploadedProofUri || undefined,
        depositTxSig,
        challengeId,
      );

      setLaunchStatus('done');
      Alert.alert(
        '🔥 LIVE!',
        needsDeposit
          ? `Challenge is live! ◎${prize} SOL locked in escrow on Solana.`
          : 'Challenge is live!',
        [{ text: 'View Feed', onPress: () => router.replace('/(tabs)/feed' as any) }],
      );
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Unknown error');
    } finally {
      setLaunching(false);
      setLaunchStatus('idle');
    }
  };

  // ── Camera mode ────────────────────────────────────────────────
  if (showCamera) {
    return (
      <ProofRecorder
        title="Record Your Proof"
        subtitle="This becomes your submission. Max 60 seconds."
        onVideoRecorded={(uri) => { setProofUri(uri); setShowCamera(false); }}
        onCancel={() => setShowCamera(false)}
        maxDuration={60}
      />
    );
  }

  const catColor = CAT_COLORS[category] || C.purple;
  const prizeAmt = parseFloat(prizeAmount) || 0;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={goBack} style={s.backBtn} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
          <Ionicons name={step === 0 ? 'close' : 'arrow-back'} size={22} color={C.t2} />
        </TouchableOpacity>
        <View style={s.stepInfo}>
          <Text style={s.stepLabel}>STEP {step + 1} / {TOTAL_STEPS}</Text>
          <Text style={s.stepTitle}>{STEP_TITLES[step]}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress */}
      <View style={s.progressTrack}>
        <Animated.View style={[s.progressFill, {
          width: progressAnim.interpolate({ inputRange: [0,100], outputRange: ['0%','100%'] }),
          backgroundColor: catColor,
        }]} />
      </View>

      {/* Steps */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[s.stepWrap, {
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }, { translateX: shakeAnim }],
        }]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>

            {/* ── Step 0: Who ── */}
            {step === 0 && (
              <View style={b.wrap}>
                <Text style={b.heading}>Who are you challenging?</Text>
                <Text style={b.sub}>Go public or call someone out directly.</Text>
                {([
                  { key: 'open' as ChallengeType, icon: '🌍', title: 'OPEN CHALLENGE', desc: 'Anyone can join and compete. Set a max count.', color: C.purple },
                  { key: '1v1'  as ChallengeType, icon: '⚔️', title: 'DIRECT 1v1',    desc: 'Challenge one specific person head-to-head.',  color: C.pink },
                ]).map(opt => {
                  const active = type === opt.key;
                  return (
                    <Pressable key={opt.key} onPress={() => setType(opt.key)} style={[b.card, { borderColor: active ? opt.color : C.border, backgroundColor: active ? opt.color+'33' : C.bgCard }]}>
                      <View style={[b.cardIcon, { backgroundColor: opt.color+'30' }]}><Text style={{ fontSize: 26 }}>{opt.icon}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={[b.cardTitle, active && { color: C.t1 }]}>{opt.title}</Text>
                        <Text style={[b.cardSub, active && { color: C.t2 }]}>{opt.desc}</Text>
                      </View>
                      <View style={[b.radio, active && { borderColor: opt.color, backgroundColor: opt.color }]}>
                        {active && <View style={[b.radioDot, { backgroundColor: '#fff' }]} />}
                      </View>
                    </Pressable>
                  );
                })}
                {type === '1v1' && (
                  <View style={b.searchSection}>
                    <Text style={b.label}>OPPONENT WALLET ADDRESS</Text>
                    <View style={b.searchBox}>
                      <Ionicons name="search" size={16} color={C.t3} />
                      <TextInput style={b.searchInput} placeholder="Paste wallet address..." placeholderTextColor={C.t3} value={targetSearch} onChangeText={searchUser} autoCapitalize="none" autoCorrect={false} />
                      {searchLoading && <ActivityIndicator size="small" color={C.purple} />}
                    </View>
                    {targetUser && (
                      <View style={b.targetCard}>
                        <WalletAvatar pubkey={targetUser.wallet_address} username={targetUser.username} size={40} />
                        <View style={{ flex: 1 }}>
                          <Text style={b.targetName}>{targetUser.username}</Text>
                          <Text style={b.targetAddr}>{targetUser.wallet_address?.slice(0,20)}...</Text>
                        </View>
                        <TouchableOpacity onPress={() => setTargetUser(null)} style={b.removeBtn}>
                          <Ionicons name="close" size={16} color={C.t3} />
                        </TouchableOpacity>
                      </View>
                    )}
                    {targetSearch.length >= 6 && !targetUser && !searchLoading && (
                      <View style={b.notFound}><Text style={b.notFoundTxt}>No user found with that wallet</Text></View>
                    )}
                  </View>
                )}
                <Pressable onPress={() => setStep(1)} style={b.nextBtn}>
                  <Text style={b.nextBtnTxt}>NEXT →</Text>
                </Pressable>
              </View>
            )}

            {/* ── Step 1: Stakes ── */}
            {step === 1 && (
              <View style={b.wrap}>
                <Text style={b.heading}>Set the stakes</Text>
                <Text style={b.sub}>How will the winner be rewarded?</Text>
                {([
                  { key: 'D' as PrizeModel, icon: '⚡', title: 'FREE — Fame Only',  desc: 'No SOL. Winner earns fame points and bragging rights.', color: C.purple, stake: false, host: false, hide1v1: false, only1v1: false },
                  { key: 'A' as PrizeModel, icon: '🏆', title: 'HOST PRIZE',        desc: 'You fund the full pot. Everyone else enters free.',     color: C.gold,   stake: true,  host: true,  hide1v1: false, only1v1: false },
                  { key: 'B' as PrizeModel, icon: '🎰', title: 'POOL ENTRY',        desc: 'Everyone pays equal entry. Pot grows as people join.',  color: C.green,  stake: true,  host: false, hide1v1: true,  only1v1: false },
                  { key: 'C' as PrizeModel, icon: '⚔️', title: '1v1 MATCH STAKE',  desc: 'Both stake equal SOL. Winner takes all.',               color: C.pink,   stake: true,  host: false, hide1v1: false, only1v1: true  },
                ]).filter(m => !(m.hide1v1 && type === '1v1') && !(m.only1v1 && type !== '1v1')).map(m => {
                  const active = prizeModel === m.key;
                  return (
                    <Pressable key={m.key} onPress={() => { setPrizeModel(m.key); if (!m.host) setIsHostOnly(false); }} style={[b.card, { borderColor: active ? m.color : C.border, backgroundColor: active ? m.color+'22' : C.bgCard }]}>
                      <View style={[b.cardIcon, { backgroundColor: m.color+'30' }]}><Text style={{ fontSize: 24 }}>{m.icon}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={[b.cardTitle, active && { color: m.color }]}>{m.title}</Text>
                        <Text style={b.cardSub}>{m.desc}</Text>
                      </View>
                      <View style={[b.radio, active && { borderColor: m.color, backgroundColor: m.color }]}>
                        {active && <View style={[b.radioDot, { backgroundColor: '#fff' }]} />}
                      </View>
                    </Pressable>
                  );
                })}
                {(['A','B','C'] as PrizeModel[]).includes(prizeModel) && (
                  <View style={b.amountWrap}>
                    <Text style={b.label}>{prizeModel === 'A' ? 'PRIZE POOL' : prizeModel === 'B' ? 'ENTRY FEE / PERSON' : 'YOUR STAKE'} (SOL)</Text>
                    <View style={b.amountBox}>
                      <Text style={b.amountSymbol}>◎</Text>
                      <TextInput style={b.amountInput} placeholder="0.5" placeholderTextColor={C.t3} value={prizeAmount} onChangeText={setPrizeAmount} keyboardType="decimal-pad" />
                      <Text style={b.balanceTxt}>Bal: ◎{solBalance.toFixed(2)}</Text>
                    </View>
                    {parseFloat(prizeAmount) > solBalance && <Text style={b.warnTxt}>⚠️ Insufficient balance</Text>}
                  </View>
                )}
                {prizeModel === 'A' && (
                  <Pressable onPress={() => setIsHostOnly(v => !v)} style={b.hostToggle}>
                    <View style={[b.checkbox, isHostOnly && { backgroundColor: C.gold, borderColor: C.gold }]}>
                      {isHostOnly && <Ionicons name="checkmark" size={13} color="#fff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={b.hostTitle}>I'm hosting only (not competing)</Text>
                      <Text style={b.hostSub}>Fund the prize and spectate — no proof video needed.</Text>
                    </View>
                  </Pressable>
                )}
                <Pressable onPress={() => setStep(2)} style={b.nextBtn}>
                  <Text style={b.nextBtnTxt}>NEXT →</Text>
                </Pressable>
              </View>
            )}

            {/* ── Step 2: Details ── */}
            {step === 2 && (
              <View style={b.wrap}>
                <S2 title={title} setTitle={setTitle} desc={desc} setDesc={setDesc} category={category} setCategory={setCategory} duration={duration} setDuration={setDuration} maxParticipants={maxParticipants} setMaxParticipants={setMaxParticipants} votingDuration={votingDuration} setVotingDuration={setVotingDuration} type={type} />
                <Pressable onPress={() => { if (!title.trim()) { shake(); return; } setStep(isHostOnly ? 4 : 3); }} style={[b.nextBtn, !title.trim() && { backgroundColor: C.bgElevated }]}>
                  <Text style={[b.nextBtnTxt, !title.trim() && { color: C.t3 }]}>{title.trim() ? 'NEXT →' : 'Enter a title first'}</Text>
                </Pressable>
              </View>
            )}

            {/* ── Step 3: Proof ── */}
            {step === 3 && (
              <View style={b.wrap}>
                <S3 proofUri={proofUri} onRecord={() => setShowCamera(true)} onRetake={() => { setProofUri(null); setShowCamera(true); }} />
                <Pressable onPress={() => { if (!proofUri) { shake(); return; } setStep(4); }} style={[b.nextBtn, !proofUri && { backgroundColor: C.bgElevated }]}>
                  <Text style={[b.nextBtnTxt, !proofUri && { color: C.t3 }]}>{proofUri ? 'NEXT →' : 'Record proof first ↑'}</Text>
                </Pressable>
              </View>
            )}

            {/* ── Step 4: Launch ── */}
            {step === 4 && (
              <View style={b.wrap}>
                <S4 title={title} category={category} type={type} prizeModel={prizeModel} prizeAmt={prizeAmt} isHostOnly={isHostOnly} maxParticipants={maxParticipants} duration={duration} votingDuration={votingDuration} targetUser={targetUser} proofUri={proofUri} solBalance={solBalance} isDemoMode={isDemoMode} catColor={catColor} airdropDevnet={airdropDevnet} />
                <Pressable onPress={launch} style={[b.nextBtn, { backgroundColor: C.pink }]} disabled={launching}>
                  <Text style={b.nextBtnTxt}>
                    {launchStatus === 'creating'   ? '⏳ CREATING...'
                   : launchStatus === 'depositing' ? '🔐 APPROVE IN WALLET...'
                   : launchStatus === 'done'        ? '✅ DONE!'
                   : '🔥 DROP THE CHALLENGE'}
                  </Text>
                </Pressable>
                {prizeAmt > 0 && <Text style={b.disclaimer}>◎{prizeAmt} SOL will be locked in escrow on Solana</Text>}
              </View>
            )}

          </ScrollView>
        </Animated.View>

        {/* Empty footer spacer so bottom content isn't hidden */}
        <View style={s.footer} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Step 0: Type ──────────────────────────────────────────────────
function S0({ type, setType, targetSearch, searchUser, targetUser, setTargetUser, searchLoading }: any) {
  return (
    <View style={b.wrap}>
      <Text style={b.heading}>Who are you challenging?</Text>
      <Text style={b.sub}>Go public or call someone out directly.</Text>

      {[
        { key: 'open', icon: '🌍', title: 'OPEN CHALLENGE', desc: 'Anyone can join and compete. Set a max count.', color: C.purple },
        { key: '1v1',  icon: '⚔️', title: 'DIRECT 1v1',    desc: 'Challenge one specific person head-to-head.',  color: C.pink },
      ].map(opt => {
        const active = type === opt.key;
        return (
          <Pressable key={opt.key} onPress={() => setType(opt.key as ChallengeType)} style={[b.card, { borderColor: active ? opt.color : C.border, backgroundColor: active ? opt.color+'33' : C.bgCard }]}>
            <View style={[b.cardIcon, { backgroundColor: opt.color+'30' }]}><Text style={{ fontSize: 26 }}>{opt.icon}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[b.cardTitle, active && { color: C.t1 }]}>{opt.title}</Text>
              <Text style={[b.cardSub,   active && { color: C.t2 }]}>{opt.desc}</Text>
            </View>
            <View style={[b.radio, active && { borderColor: opt.color, backgroundColor: opt.color }]}>
              {active && <View style={[b.radioDot, { backgroundColor: '#fff' }]} />}
            </View>
          </Pressable>
        );
      })}

      {type === '1v1' && (
        <View style={b.searchSection}>
          <Text style={b.label}>OPPONENT WALLET ADDRESS</Text>
          <View style={b.searchBox}>
            <Ionicons name="search" size={16} color={C.t3} />
            <TextInput style={b.searchInput} placeholder="Paste wallet address..." placeholderTextColor={C.t3} value={targetSearch} onChangeText={searchUser} autoCapitalize="none" autoCorrect={false} />
            {searchLoading && <ActivityIndicator size="small" color={C.purple} />}
          </View>
          {targetUser && (
            <View style={b.targetCard}>
              <WalletAvatar pubkey={targetUser.wallet_address} username={targetUser.username} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={b.targetName}>{targetUser.username}</Text>
                <Text style={b.targetAddr}>{targetUser.wallet_address?.slice(0,20)}...</Text>
              </View>
              <TouchableOpacity onPress={() => setTargetUser(null)} style={b.removeBtn}>
                <Ionicons name="close" size={16} color={C.t3} />
              </TouchableOpacity>
            </View>
          )}
          {targetSearch.length >= 6 && !targetUser && !searchLoading && (
            <View style={b.notFound}><Text style={b.notFoundTxt}>No user found with that wallet</Text></View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Step 1: Prize Model ───────────────────────────────────────────
function S1({ prizeModel, setPrizeModel, isHostOnly, setIsHostOnly, prizeAmount, setPrizeAmount, solBalance, type }: any) {
  const models = [
    { key: 'D', icon: '⚡', title: 'FREE — Fame Only',    desc: 'No SOL. Winner earns fame points and bragging rights.', color: C.purple, stake: false, host: false },
    { key: 'A', icon: '🏆', title: 'HOST PRIZE',         desc: 'You fund the full pot. Everyone else enters free.',     color: C.gold,   stake: true,  host: true  },
    { key: 'B', icon: '🎰', title: 'POOL ENTRY',         desc: 'Everyone pays equal entry. Pot grows as people join.',  color: C.green,  stake: true,  host: false, hide1v1: true },
    { key: 'C', icon: '⚔️', title: '1v1 MATCH STAKE',   desc: 'Both stake equal SOL. Winner takes all.',               color: C.pink,   stake: true,  host: false, only1v1: true },
  ].filter(m => !(m.hide1v1 && type === '1v1') && !(m.only1v1 && type !== '1v1'));

  const sel = models.find(m => m.key === prizeModel);

  return (
    <View style={b.wrap}>
      <Text style={b.heading}>Set the stakes</Text>
      <Text style={b.sub}>How will the winner be rewarded?</Text>

      {models.map(m => {
        const active = prizeModel === m.key;
        return (
          <Pressable key={m.key} onPress={() => { setPrizeModel(m.key as PrizeModel); if (!m.host) setIsHostOnly(false); }} style={[b.card, { borderColor: active ? m.color : C.border, backgroundColor: active ? m.color+'22' : C.bgCard }]}>
              <View style={[b.cardIcon, { backgroundColor: m.color+'30' }]}><Text style={{ fontSize: 24 }}>{m.icon}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[b.cardTitle, active && { color: m.color }]}>{m.title}</Text>
                <Text style={b.cardSub}>{m.desc}</Text>
              </View>
              <View style={[b.radio, active && { borderColor: m.color, backgroundColor: m.color }]}>
                {active && <View style={[b.radioDot, { backgroundColor: '#fff' }]} />}
              </View>
            </Pressable>
        );
      })}

      {sel?.stake && (
        <View style={b.amountWrap}>
          <Text style={b.label}>{prizeModel === 'A' ? 'PRIZE POOL' : prizeModel === 'B' ? 'ENTRY FEE / PERSON' : 'YOUR STAKE'} (SOL)</Text>
          <View style={b.amountBox}>
            <Text style={b.amountSymbol}>◎</Text>
            <TextInput style={b.amountInput} placeholder="0.5" placeholderTextColor={C.t3} value={prizeAmount} onChangeText={setPrizeAmount} keyboardType="decimal-pad" />
            <Text style={b.balanceTxt}>Bal: ◎{solBalance.toFixed(2)}</Text>
          </View>
          {parseFloat(prizeAmount) > solBalance && <Text style={b.warnTxt}>⚠️ Insufficient balance</Text>}
        </View>
      )}

      {prizeModel === 'A' && (
        <TouchableOpacity onPress={() => setIsHostOnly((v: boolean) => !v)} style={b.hostToggle} activeOpacity={0.85}>
          <View style={[b.checkbox, isHostOnly && { backgroundColor: C.gold, borderColor: C.gold }]}>
            {isHostOnly && <Ionicons name="checkmark" size={13} color="#fff" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={b.hostTitle}>I'm hosting only (not competing)</Text>
            <Text style={b.hostSub}>Fund the prize and spectate — no proof video needed.</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Step 2: Details ──────────────────────────────────────────────
function S2({ title, setTitle, desc, setDesc, category, setCategory, duration, setDuration, maxParticipants, setMaxParticipants, votingDuration, setVotingDuration, type }: any) {
  const inputRef = useRef<TextInput>(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 350); }, []);
  return (
    <View style={b.wrap}>
      <Text style={b.heading}>The details</Text>
      <Text style={b.sub}>Clear challenges attract more opponents.</Text>

      <View style={b.fieldWrap}>
        <Text style={b.label}>CHALLENGE TITLE *</Text>
        <TextInput ref={inputRef} style={b.titleInput} placeholder="e.g. 100 pushups non-stop" placeholderTextColor={C.t3} value={title} onChangeText={setTitle} maxLength={80} multiline />
        <Text style={b.count}>{title.length}/80</Text>
      </View>

      <View style={b.fieldWrap}>
        <Text style={b.label}>PROOF RULES <Text style={{ color: C.t4 }}>(optional)</Text></Text>
        <TextInput style={b.descInput} placeholder="What counts as valid proof? Any rules?" placeholderTextColor={C.t3} value={desc} onChangeText={setDesc} maxLength={280} multiline textAlignVertical="top" />
        <Text style={b.count}>{desc.length}/280</Text>
      </View>

      <Text style={b.label}>CATEGORY</Text>
      <View style={b.catGrid}>
        {CATEGORIES.map(cat => {
          const active = category === cat.id;
          const col = CAT_COLORS[cat.id];
          return (
            <TouchableOpacity key={cat.id} onPress={() => setCategory(cat.id)} activeOpacity={0.75}>
              <LinearGradient colors={active ? [col+'CC', col+'66'] : [C.bgCard, C.bgElevated]} style={[b.catCard, active && { borderColor: col }]}>
                <Text style={{ fontSize: 22 }}>{cat.icon}</Text>
                <Text style={[b.catLabel, active && { color: '#fff', fontWeight: '900' }]}>{cat.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={b.label}>TIME TO SUBMIT PROOF</Text>
      <View style={b.chipRow}>
        {DURATIONS.map(d => (
          <TouchableOpacity key={d} onPress={() => setDuration(d)} style={[b.chip, duration === d && { borderColor: C.purple, backgroundColor: C.purpleDim }]}>
            <Text style={[b.chipTxt, duration === d && { color: C.purple }]}>{DURATION_LABELS[d]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {type === 'open' && (
        <>
          <Text style={b.label}>MAX PARTICIPANTS</Text>
          <View style={b.chipRow}>
            {[5,10,20,50,100].map(n => (
              <TouchableOpacity key={n} onPress={() => setMaxParticipants(n)} style={[b.chip, maxParticipants === n && { borderColor: C.cyan, backgroundColor: C.cyan+'15' }]}>
                <Text style={[b.chipTxt, maxParticipants === n && { color: C.cyan }]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Text style={b.label}>VOTING WINDOW</Text>
      <View style={b.chipRow}>
        {VOTING_DURATIONS.map(d => (
          <TouchableOpacity key={d} onPress={() => setVotingDuration(d)} style={[b.chip, votingDuration === d && { borderColor: C.gold, backgroundColor: C.gold+'15' }]}>
            <Text style={[b.chipTxt, votingDuration === d && { color: C.gold }]}>{d}H</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Step 3: Record Proof ─────────────────────────────────────────
function S3({ proofUri, onRecord, onRetake }: { proofUri: string|null; onRecord: () => void; onRetake: () => void }) {
  return (
    <View style={b.wrap}>
      <Text style={b.heading}>Record your proof</Text>
      <Text style={b.sub}>This becomes your submission. Make it count.</Text>

      {!proofUri ? (
        <TouchableOpacity onPress={onRecord} activeOpacity={0.85} style={b.recordPrompt}>
          <LinearGradient colors={C.gPurple} style={b.recordGrad}>
            <View style={b.recordIconWrap}>
              <Ionicons name="videocam" size={42} color="#fff" />
            </View>
            <Text style={b.recordTitle}>TAP TO RECORD</Text>
            <Text style={b.recordSub}>Camera opens · 60 second max · Show your face and the task</Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <View style={b.proofDone}>
          <LinearGradient colors={[C.green+'28', C.green+'08']} style={b.proofDoneInner}>
            <Ionicons name="checkmark-circle" size={52} color={C.green} />
            <Text style={b.proofDoneTitle}>PROOF RECORDED ✅</Text>
            <Text style={b.proofDoneSub}>Your video is ready. Tap retake for a better take.</Text>
            <TouchableOpacity onPress={onRetake} style={b.retakeBtn}>
              <Ionicons name="refresh" size={15} color={C.t2} />
              <Text style={b.retakeTxt}>Retake video</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}

      <View style={b.tipsBox}>
        <Text style={b.tipsTitle}>💡 Tips to win more votes</Text>
        {['Say the challenge name at the start', 'Show face + task clearly in one shot', 'Good lighting = more credibility', 'Keep it under 60 seconds'].map((t,i) => (
          <Text key={i} style={b.tipItem}>• {t}</Text>
        ))}
      </View>
    </View>
  );
}

// ─── Step 4: Launch ───────────────────────────────────────────────
function S4({ title, category, type, prizeModel, prizeAmt, isHostOnly, maxParticipants, duration, votingDuration, targetUser, proofUri, solBalance, isDemoMode, catColor, airdropDevnet }: any) {
  const modelLabel: Record<string,string> = { A:'Host Prize', B:'Pool Entry', C:'1v1 Stake', D:'Free' };
  const needsDeposit = ['A','C'].includes(prizeModel) && prizeAmt > 0;
  const lowBalance   = needsDeposit && solBalance < prizeAmt && !isDemoMode;

  return (
    <View style={b.wrap}>
      <Text style={b.heading}>Ready to launch?</Text>
      <Text style={b.sub}>Review before it goes live on Solana.</Text>

      {/* Summary */}
      <LinearGradient colors={[catColor+'22', C.bgCard]} style={[b.summaryCard, { borderColor: catColor+'44' }]}>
        <View style={[b.summaryStripe, { backgroundColor: catColor }]} />
        <View style={b.summaryBody}>
          <View style={[b.summaryBadge, { backgroundColor: catColor+'25', borderColor: catColor+'55' }]}>
            <Text style={{ fontSize: 11 }}>{CAT_ICONS[category]}</Text>
            <Text style={[b.summaryBadgeTxt, { color: catColor }]}>{category.toUpperCase()}</Text>
          </View>
          <Text style={b.summaryTitle} numberOfLines={2}>{title}</Text>
          <View style={b.summaryMeta}>
            {[
              type === '1v1' ? `⚔️ 1v1 vs ${targetUser?.username || '???'}` : `🌍 Open · ${maxParticipants} max`,
              `⏱ ${duration}h to prove`,
              `🗳️ ${votingDuration}h voting`,
              prizeAmt > 0 ? `💰 ◎${prizeAmt}` : '⚡ Fame only',
            ].map((m,i) => <View key={i} style={b.metaPill}><Text style={b.metaTxt}>{m}</Text></View>)}
          </View>
        </View>
      </LinearGradient>

      {/* Checklist */}
      <View style={b.checkList}>
        {[
          { ok: !!title,                              label: 'Challenge title' },
          { ok: true,                                 label: `Prize: ${modelLabel[prizeModel]}` },
          { ok: isHostOnly ? true : !!proofUri,       label: isHostOnly ? 'Host only — no proof needed' : proofUri ? 'Proof video recorded' : '⚠️ Proof video missing' },
          ...(needsDeposit ? [{ ok: !lowBalance,      label: lowBalance ? `Need ◎${prizeAmt} — only have ◎${solBalance.toFixed(3)}` : `◎${prizeAmt} SOL ready` }] : []),
        ].map((row,i) => (
          <View key={i} style={b.checkRow}>
            <Ionicons name={row.ok ? 'checkmark-circle' : 'close-circle'} size={18} color={row.ok ? C.green : C.red} />
            <Text style={[b.checkTxt, { color: row.ok ? C.t1 : C.red }]}>{row.label}</Text>
          </View>
        ))}
      </View>

      {lowBalance && (
        <TouchableOpacity onPress={airdropDevnet} style={b.airdropBtn}>
          <LinearGradient colors={C.gCyan} style={b.airdropGrad}>
            <Ionicons name="water" size={16} color="#fff" />
            <Text style={b.airdropTxt}>GET DEVNET SOL (FREE AIRDROP)</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      <View style={b.onChainBox}>
        <Ionicons name="shield-checkmark" size={16} color={C.green} />
        <Text style={b.onChainTxt}>
          Recorded on Solana testnet.{needsDeposit ? ` ◎${prizeAmt} SOL locked in escrow.` : ' No SOL required.'}
        </Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.bg },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.lg, paddingVertical: S.md },
  backBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  stepInfo:      { alignItems: 'center', gap: 2 },
  stepLabel:     { color: C.t3, fontSize: T.xs, fontWeight: '800', letterSpacing: 1.5 },
  stepTitle:     { color: C.t1, fontSize: T.base, fontWeight: '900' },
  progressTrack: { height: 3, backgroundColor: C.bgCard, marginHorizontal: S.lg, borderRadius: 2, marginBottom: 2 },
  progressFill:  { height: '100%', borderRadius: 2 },
  stepWrap:      { flex: 1 },
  footer:        { height: Platform.OS === 'ios' ? 20 : 8 },
});

const b = StyleSheet.create({
  wrap:    { padding: S.lg, gap: S.lg },
  heading: { color: C.t1, fontSize: T['3xl'], fontWeight: '900', lineHeight: 36 },
  sub:     { color: C.t2, fontSize: T.base, lineHeight: 22, marginTop: -S.sm },
  label:   { color: C.t3, fontSize: T.xs, fontWeight: '800', letterSpacing: 1.5 },
  count:   { color: C.t3, fontSize: T.xs, textAlign: 'right' },

  // Cards (type + model)
  card:     { borderRadius: R['2xl'], borderWidth: 1, borderColor: C.border, padding: S.md, flexDirection: 'row', alignItems: 'center', gap: S.md },
  cardIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  cardTitle:{ color: C.t1, fontSize: T.base, fontWeight: '900', marginBottom: 3 },
  cardSub:  { color: C.t2, fontSize: T.sm, lineHeight: 18 },
  radio:    { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },

  // Search
  searchSection: { gap: S.sm },
  searchBox:     { flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, paddingHorizontal: S.md, height: 48 },
  searchInput:   { flex: 1, color: C.t1, fontSize: T.base },
  targetCard:    { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: C.green+'12', borderRadius: R.xl, borderWidth: 1, borderColor: C.green+'33', padding: S.md },
  targetName:    { color: C.t1, fontSize: T.base, fontWeight: '800' },
  targetAddr:    { color: C.t3, fontSize: T.xs, fontFamily: 'monospace' },
  removeBtn:     { width: 28, height: 28, borderRadius: 14, backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center' },
  notFound:      { backgroundColor: C.red+'12', borderRadius: R.xl, borderWidth: 1, borderColor: C.red+'33', padding: S.md },
  notFoundTxt:   { color: C.red, fontSize: T.sm },

  // Amount
  amountWrap:   { gap: S.sm },
  amountBox:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, paddingHorizontal: S.md, height: 56 },
  amountSymbol: { color: C.gold, fontSize: T['2xl'], fontWeight: '900', marginRight: S.sm },
  amountInput:  { flex: 1, color: C.t1, fontSize: T['2xl'], fontWeight: '900' },
  balanceTxt:   { color: C.t3, fontSize: T.xs },
  warnTxt:      { color: C.red, fontSize: T.sm, fontWeight: '700' },

  // Host toggle
  hostToggle: { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, padding: S.md },
  checkbox:   { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  hostTitle:  { color: C.t1, fontSize: T.sm, fontWeight: '800' },
  hostSub:    { color: C.t3, fontSize: T.xs, marginTop: 2 },

  // Detail fields
  fieldWrap:  { gap: 6 },
  titleInput: { backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, color: C.t1, fontSize: T.xl, fontWeight: '800', padding: S.md, minHeight: 72, textAlignVertical: 'top' },
  descInput:  { backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, color: C.t1, fontSize: T.base, padding: S.md, minHeight: 90 },

  // Category grid
  catGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  catCard:  { width: (width - S.lg*2 - S.sm*3)/4, borderRadius: R.lg, padding: S.sm, alignItems: 'center', gap: 5, borderWidth: 1, borderColor: C.border },
  catLabel: { color: C.t2, fontSize: 9, fontWeight: '700' },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  chip:    { paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgCard },
  chipTxt: { color: C.t2, fontSize: T.sm, fontWeight: '800' },

  // Proof recorder step
  recordPrompt:  { borderRadius: R['2xl'], overflow: 'hidden' },
  recordGrad:    { padding: S.xl, alignItems: 'center', gap: S.md },
  recordIconWrap:{ width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  recordTitle:   { color: '#fff', fontSize: T['2xl'], fontWeight: '900', letterSpacing: 2 },
  recordSub:     { color: 'rgba(255,255,255,0.72)', fontSize: T.sm, textAlign: 'center', lineHeight: 20 },
  proofDone:     {},
  proofDoneInner:{ borderRadius: R['2xl'], borderWidth: 1, borderColor: C.green+'40', padding: S.xl, alignItems: 'center', gap: S.md },
  proofDoneTitle:{ color: C.green, fontSize: T.xl, fontWeight: '900', letterSpacing: 1 },
  proofDoneSub:  { color: C.t2, fontSize: T.sm, textAlign: 'center', lineHeight: 20 },
  retakeBtn:     { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgElevated },
  retakeTxt:     { color: C.t2, fontSize: T.sm, fontWeight: '700' },
  tipsBox:       { backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, padding: S.md, gap: 6 },
  tipsTitle:     { color: C.t2, fontSize: T.sm, fontWeight: '800', marginBottom: 2 },
  tipItem:       { color: C.t3, fontSize: T.sm, lineHeight: 20 },

  // Summary
  summaryCard:    { borderRadius: R['2xl'], borderWidth: 1, overflow: 'hidden', flexDirection: 'row' },
  summaryStripe:  { width: 4 },
  summaryBody:    { flex: 1, padding: S.md, gap: S.sm },
  summaryBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: R.full, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3 },
  summaryBadgeTxt:{ fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  summaryTitle:   { color: C.t1, fontSize: T.lg, fontWeight: '900', lineHeight: 24 },
  summaryMeta:    { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  metaPill:       { backgroundColor: C.bgElevated, borderRadius: R.full, paddingHorizontal: 9, paddingVertical: 3 },
  metaTxt:        { color: C.t2, fontSize: T.xs },

  // Checklist
  checkList: { gap: S.sm },
  checkRow:  { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  checkTxt:  { fontSize: T.sm, fontWeight: '600' },

  // Airdrop
  airdropBtn:  { borderRadius: R.xl, overflow: 'hidden' },
  airdropGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, paddingVertical: S.md },
  airdropTxt:  { color: '#fff', fontSize: T.sm, fontWeight: '900', letterSpacing: 1 },

  // On-chain
  onChainBox: { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm, backgroundColor: C.green+'0C', borderRadius: R.xl, borderWidth: 1, borderColor: C.green+'30', padding: S.md },
  onChainTxt: { color: C.green, fontSize: T.sm, flex: 1, lineHeight: 20 },
  nextBtn:     { backgroundColor: C.purple, borderRadius: R.xl, paddingVertical: S.lg, alignItems: 'center', marginTop: S.sm },
  nextBtnTxt:  { color: '#fff', fontSize: T.base, fontWeight: '900', letterSpacing: 2 },
  disclaimer:  { color: C.t3, fontSize: T.xs, textAlign: 'center', marginTop: S.sm },
});