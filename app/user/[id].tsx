import { Btn, CatPill, StatusPill, WalletAvatar } from '@/components/ui';
import { C, CAT_COLORS, R, S, T } from '@/constants/theme';
import { useWallet } from '@/context/WalletContext';
import {
  type Challenge,
  getChallengeById as getChallenge,
  getParticipants,
  getVoteTally
} from '@/services/firebase-challenges';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Image, ScrollView, StyleSheet, Text,
  TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function timeLeft(deadline: string | null | undefined) {
  if (!deadline) return '';
  const d = new Date(deadline).getTime() - Date.now();
  if (d <= 0) return 'Deadline passed';
  const h = Math.floor(d / 3600000);
  const m = Math.floor((d % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export default function ChallengeDetailScreen() {
  const { id }     = useLocalSearchParams();
  const router     = useRouter();
  const { pubkey } = useWallet();

  const [challenge,    setChallenge]    = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [tally,        setTally]        = useState({ cVotes: 0, oVotes: 0, total: 0 });
  const [showAllParts, setShowAllParts] = useState(false);

  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroY       = useRef(new Animated.Value(20)).current;
  const vsScale     = useRef(new Animated.Value(0.92)).current;
  const actionsY    = useRef(new Animated.Value(30)).current;

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const ch = await getChallenge(id as string);
      setChallenge(ch);

      if (ch) {
        // Load participants for multi challenges
        if (ch.type === 'open' && ch.max_participants > 2) {
          const parts = await getParticipants(id as string);
          setParticipants(parts);
        }
        // Load vote tally if in voting or resolved
        if (ch.status === 'pending_vote' || ch.status === 'resolved' || ch.status === 'completed') {
          const t = await getVoteTally(id as string);
          setTally({ cVotes: t.creator_votes, oVotes: t.opponent_votes, total: t.creator_votes + t.opponent_votes });
        }
      }

      Animated.stagger(80, [
        Animated.parallel([
          Animated.timing(heroOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(heroY,       { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        ]),
        Animated.spring(vsScale,   { toValue: 1, useNativeDriver: true, tension: 70, friction: 10 }),
        Animated.spring(actionsY,  { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
      ]).start();
    } catch {
      Alert.alert('Error loading challenge');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator color={C.purple} size="large" />
        <Text style={s.loadingText}>Loading challenge...</Text>
      </View>
    );
  }

  if (!challenge) return null;

  const now         = Date.now();
  const deadlinePassed = challenge.deadline ? new Date(challenge.deadline).getTime() < now : false;
  const stakeAmt    = (challenge as any).stake_amount ?? challenge.stake_sol ?? 0;
  const isCreator   = pubkey === challenge.creator_id;
  const isMulti     = challenge.type === 'open' && challenge.max_participants > 2;
  const joined      = challenge.participant_count ?? challenge.participants?.length ?? 0;

  // Is user already a participant (for multi)
  const isParticipant = pubkey
    ? (challenge.participants?.includes(pubkey) || pubkey === challenge.creator_id || pubkey === challenge.opponent_id)
    : false;

  const isOpponent  = pubkey === challenge.opponent_id;
  const isPlayer    = isCreator || isOpponent || (isMulti && isParticipant);

  // Has this user already submitted proof?
  const myProofSubmitted = isCreator
    ? !!challenge.creator_proof_url
    : isOpponent
    ? !!challenge.opponent_proof_url
    : isMulti
    ? participants.some(p => p.userId === pubkey && !!p.proofUrl)
    : false;

  const needsProof  = challenge.status === 'active' && isPlayer && !myProofSubmitted && !deadlinePassed;
  const canVote     = (challenge.status === 'pending_vote') && !isPlayer;
  const isVotingPlayer = challenge.status === 'pending_vote' && isPlayer;
  const isResolved  = challenge.status === 'resolved' || challenge.status === 'completed';
  const isExpired   = challenge.status === 'expired' || (deadlinePassed && challenge.status === 'open');
  const canJoin     = challenge.status === 'open' && !isCreator && !deadlinePassed &&
                      (isMulti ? joined < challenge.max_participants : !challenge.opponent_id);

  const catCol = CAT_COLORS[challenge.category] || C.purple;
  const cPct   = tally.total > 0 ? Math.round(tally.cVotes / tally.total * 100) : 50;

  // For multi: show up to 5 participants, then "see more"
  const displayedParts = showAllParts ? participants : participants.slice(0, 5);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Top bar */}
      <View style={s.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={20} color={C.t1} />
        </TouchableOpacity>
        <StatusPill status={challenge.status} />
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Hero */}
        <Animated.View style={{ opacity: heroOpacity, transform: [{ translateY: heroY }] }}>
          <LinearGradient colors={[catCol + '30', C.bg]} style={s.hero}>
            <View style={[s.glowBlob, { backgroundColor: catCol }]} />
            <View style={s.heroPills}>
              <CatPill category={challenge.category} />
              {stakeAmt > 0 && (
                <View style={[s.stakePill, { borderColor: C.gold + '55', backgroundColor: C.gold + '15' }]}>
                  <Text style={s.stakeEmoji}>💰</Text>
                  <Text style={[s.stakeAmt, { color: C.gold }]}>◎{stakeAmt} STAKE</Text>
                </View>
              )}
              {isMulti && (
                <View style={[s.stakePill, { borderColor: C.cyan + '55', backgroundColor: C.cyan + '15' }]}>
                  <Text style={[s.stakeAmt, { color: C.cyan }]}>👥 {joined}/{challenge.max_participants} JOINED</Text>
                </View>
              )}
            </View>
            <Text style={s.title}>{challenge.title}</Text>
            {!!challenge.description && <Text style={s.desc}>{challenge.description}</Text>}
            {!!challenge.deadline && (
              <View style={s.deadlineRow}>
                <Ionicons name="time-outline" size={13} color={C.t3} />
                <Text style={s.deadlineTxt}>{timeLeft(challenge.deadline)}</Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* VS Section */}
        <Animated.View style={[s.vsSection, { transform: [{ scale: vsScale }] }]}>
          {isMulti ? (
            // Multi-participant display
            <View style={s.multiVsWrap}>
              <View style={s.multiCreatorSide}>
                <WalletAvatar pubkey={challenge.creator?.wallet_address || challenge.creator_id} username={challenge.creator?.username} size={44} />
                <Text style={s.multiCreatorName} numberOfLines={1}>{challenge.creator?.username ?? 'Creator'}</Text>
                <View style={[s.creatorTag, { backgroundColor: catCol + '25', borderColor: catCol + '55' }]}>
                  <Text style={[s.creatorTagTxt, { color: catCol }]}>HOST</Text>
                </View>
              </View>

              <LinearGradient colors={C.gFire} style={s.vsBadge}>
                <Text style={s.vsTxt}>VS</Text>
              </LinearGradient>

              {/* Participant count bubble — tappable */}
              <TouchableOpacity onPress={() => setShowAllParts(v => !v)} style={s.multiCountBubble} activeOpacity={0.85}>
                <Text style={s.multiCountNum}>{joined > 10 ? '10+' : joined > 0 ? `${joined}` : '0'}</Text>
                <Text style={s.multiCountLabel}>JOINED</Text>
                <Ionicons name={showAllParts ? 'chevron-up' : 'chevron-down'} size={12} color={C.t3} style={{ marginTop: 2 }} />
              </TouchableOpacity>
            </View>
          ) : (
            // 1v1 display
            <>
              <PlayerCard
                profile={challenge.creator}
                role="CHALLENGER"
                proofDone={!!challenge.creator_proof_url}
                isWinner={challenge.winner_id === challenge.creator_id}
                votes={tally.cVotes}
                pct={cPct}
                catCol={catCol}
                showVotes={challenge.status === 'pending_vote' || isResolved}
              />
              <View style={s.vsCol}>
                <LinearGradient colors={C.gFire} style={s.vsBadge}>
                  <Text style={s.vsTxt}>VS</Text>
                </LinearGradient>
                {stakeAmt > 0 && (
                  <View style={s.potBadge}>
                    <Text style={s.potTxt}>◎{(stakeAmt * 2).toFixed(1)}</Text>
                    <Text style={s.potLabel}>POT</Text>
                  </View>
                )}
              </View>
              {challenge.opponent ? (
                <PlayerCard
                  profile={challenge.opponent}
                  role="OPPONENT"
                  proofDone={!!challenge.opponent_proof_url}
                  isWinner={challenge.winner_id === challenge.opponent_id}
                  votes={tally.oVotes}
                  pct={100 - cPct}
                  catCol={catCol}
                  showVotes={challenge.status === 'pending_vote' || isResolved}
                />
              ) : (
                <OpenSlot
                  onPress={canJoin ? () => router.push(`/join/${challenge.id}` as any) : undefined}
                  isCreator={isCreator}
                  stakeAmt={stakeAmt}
                  duration={challenge.duration_hours}
                />
              )}
            </>
          )}
        </Animated.View>

        {/* Participants dropdown (multi only) */}
        {isMulti && showAllParts && (
          <View style={s.partsDropdown}>
            <Text style={s.partsTitle}>ALL PARTICIPANTS</Text>
            {displayedParts.map((p, i) => (
              <View key={p.userId} style={s.partRow}>
                <WalletAvatar pubkey={p.profile?.wallet_address || p.userId} username={p.profile?.username} size={32} />
                <Text style={s.partName} numberOfLines={1}>{p.profile?.username ?? p.userId.slice(0, 10)}</Text>
                {p.proofUrl ? (
                  <View style={s.proofBadge}>
                    <Ionicons name="videocam" size={12} color={C.green} />
                    <Text style={s.proofBadgeTxt}>Proof submitted</Text>
                  </View>
                ) : (
                  <View style={[s.proofBadge, { backgroundColor: C.bgElevated, borderColor: C.border }]}>
                    <Ionicons name="time-outline" size={12} color={C.t3} />
                    <Text style={[s.proofBadgeTxt, { color: C.t3 }]}>Pending</Text>
                  </View>
                )}
              </View>
            ))}
            {participants.length > 5 && !showAllParts && (
              <TouchableOpacity onPress={() => setShowAllParts(true)} style={s.seeMoreBtn}>
                <Text style={s.seeMoreTxt}>See {participants.length - 5} more ▼</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Actions */}
        <Animated.View style={[s.actions, { transform: [{ translateY: actionsY }] }]}>

          {/* Winner banner */}
          {isResolved && challenge.winner_id && (
            <WinnerBanner
              winnerName={
                challenge.winner_id === challenge.creator_id
                  ? challenge.creator?.username
                  : challenge.opponent?.username
              }
              stakeAmt={stakeAmt}
              isYou={challenge.winner_id === pubkey}
            />
          )}

          {/* Proof already submitted */}
          {myProofSubmitted && !isResolved && (
            <View style={[s.infoBox, { borderColor: C.green + '44', backgroundColor: C.green + '0C' }]}>
              <Ionicons name="checkmark-circle" size={18} color={C.green} />
              <Text style={[s.infoTxt, { color: C.green }]}>
                Your proof is submitted ✅ — waiting for voting to open.
              </Text>
            </View>
          )}

          {/* Upload proof */}
          {needsProof && (
            <View style={s.proofBox}>
              <View style={s.proofBoxHeader}>
                <Ionicons name="videocam" size={18} color={C.purple} />
                <Text style={s.proofBoxTitle}>Your proof is needed</Text>
              </View>
              <Text style={s.proofBoxSub}>Record your video showing you completed the challenge.</Text>
              <Btn
                onPress={() => router.push(`/upload-proof/${challenge.id}` as any)}
                label="📹  UPLOAD YOUR PROOF"
                fullWidth size="lg"
              />
            </View>
          )}

          {/* Vote button — non-participants only */}
          {canVote && (
            <View style={s.voteBox}>
              <View style={s.voteBoxHeader}>
                <Ionicons name="people" size={18} color={C.gold} />
                <Text style={s.voteBoxTitle}>Community vote is open</Text>
              </View>
              <Text style={s.voteBoxSub}>Watch all proof videos and vote for who did it best.</Text>
              <TouchableOpacity
                onPress={() => router.push(`/vote/${challenge.id}` as any)}
                style={s.voteBigBtn}
                activeOpacity={0.85}
              >
                <LinearGradient colors={[C.gold, '#D97706']} style={s.voteBigBtnGrad}>
                  <Ionicons name="thumbs-up" size={20} color="#fff" />
                  <Text style={s.voteBigBtnTxt}>VIEW PROOFS & VOTE</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Voting in progress for player */}
          {isVotingPlayer && (
            <View style={[s.infoBox, { borderColor: C.purple + '44', backgroundColor: C.purple + '0C' }]}>
              <Ionicons name="time-outline" size={18} color={C.purple} />
              <Text style={[s.infoTxt, { color: C.purple }]}>
                Voting in progress 🗳️ — Results will be revealed when voting closes.
              </Text>
            </View>
          )}

          {/* See results button when resolved */}
          {isResolved && (
            <TouchableOpacity
              onPress={() => router.push(`/vote/${challenge.id}` as any)}
              style={s.voteBigBtn}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[C.purple, C.purpleDark]} style={s.voteBigBtnGrad}>
                <Ionicons name="trophy" size={20} color="#fff" />
                <Text style={s.voteBigBtnTxt}>SEE ALL PROOFS & RESULTS</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Join button */}
          {canJoin && !isPlayer && (
            <Btn
              onPress={() => router.push(`/join/${challenge.id}` as any)}
              label={`⚔️  JOIN THIS CHALLENGE${stakeAmt > 0 ? ` · ◎${stakeAmt}` : ''}`}
              fullWidth size="lg"
            />
          )}

          {/* Waiting info */}
          {challenge.status === 'active' && isPlayer && !needsProof && !myProofSubmitted && (
            <View style={s.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color={C.cyan} />
              <Text style={s.infoTxt}>Submit your video proof before the deadline.</Text>
            </View>
          )}

          {/* Expired */}
          {isExpired && !isResolved && (
            <View style={[s.infoBox, { borderColor: C.t3 + '33', backgroundColor: C.t3 + '10' }]}>
              <Ionicons name="ban-outline" size={18} color={C.t3} />
              <Text style={[s.infoTxt, { color: C.t3 }]}>This challenge has ended.</Text>
            </View>
          )}

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Player Card ───────────────────────────────────────────────────
function PlayerCard({ profile, role, proofDone, isWinner, votes, pct, catCol, showVotes }: {
  profile: any; role: string; proofDone: boolean;
  isWinner: boolean; votes: number; pct: number;
  catCol: string; showVotes: boolean;
}) {
  if (!profile) return null;
  const winnerAnim = useRef(new Animated.Value(isWinner ? 0 : 1)).current;
  useEffect(() => {
    if (isWinner) {
      Animated.loop(Animated.sequence([
        Animated.timing(winnerAnim, { toValue: 1,   duration: 1200, useNativeDriver: true }),
        Animated.timing(winnerAnim, { toValue: 0.7, duration: 1200, useNativeDriver: true }),
      ])).start();
    }
  }, [isWinner]);

  return (
    <Animated.View style={[pc.card, isWinner && { borderColor: C.gold, borderWidth: 2 }, isWinner && { opacity: winnerAnim }]}>
      {isWinner && (
        <LinearGradient colors={[C.gold, '#D97706']} style={pc.winTag}>
          <Text style={pc.winTagTxt}>👑 WINNER</Text>
        </LinearGradient>
      )}
      <Text style={pc.role}>{role}</Text>
      <View style={[pc.avatarRing, { borderColor: isWinner ? C.gold : catCol + '60' }]}>
        {profile.profile_image ? (
          <Image source={{ uri: profile.profile_image }} style={pc.avatarImg} />
        ) : (
          <WalletAvatar pubkey={profile.wallet_address || profile.id} username={profile.username} size={44} />
        )}
      </View>
      <Text style={pc.name} numberOfLines={1}>{profile.username}</Text>
      <View style={pc.fameRow}>
        <Text style={pc.fameIcon}>⚡</Text>
        <Text style={pc.fameTxt}>{profile.fame ?? profile.fame_points ?? 0}</Text>
      </View>
      {showVotes && (
        <View style={pc.voteWrap}>
          <View style={pc.voteTrack}>
            <Animated.View style={[pc.voteFill, { width: `${pct}%` as any, backgroundColor: isWinner ? C.gold : C.purple }]} />
          </View>
          <Text style={[pc.votePct, isWinner && { color: C.gold }]}>{pct}%</Text>
        </View>
      )}
      <View style={[pc.proofBadge, proofDone && { backgroundColor: C.green + '18', borderColor: C.green + '40' }]}>
        <Ionicons name={proofDone ? 'checkmark-circle' : 'time-outline'} size={12} color={proofDone ? C.green : C.t3} />
        <Text style={[pc.proofTxt, proofDone && { color: C.green }]}>{proofDone ? 'Proof in' : 'Pending'}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Open Slot ────────────────────────────────────────────────────
function OpenSlot({ onPress, isCreator, stakeAmt, duration }: {
  onPress?: () => void; isCreator: boolean; stakeAmt: number; duration: number;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isCreator) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])).start();
    }
  }, []);
  return (
    <Animated.View style={[os.card, !isCreator && { transform: [{ scale: pulseAnim }] }]}>
      <View style={os.iconWrap}><Text style={os.icon}>{isCreator ? '⏳' : '👤'}</Text></View>
      <Text style={os.title}>{isCreator ? 'WAITING' : 'OPEN SLOT'}</Text>
      <Text style={os.sub}>
        {isCreator ? 'Waiting for\nan opponent' : `${stakeAmt > 0 ? `◎${stakeAmt} to enter` : 'Free to join'}\n${duration}h to prove`}
      </Text>
      {onPress && !isCreator && (
        <TouchableOpacity onPress={onPress} style={os.btn} activeOpacity={0.8}>
          <LinearGradient colors={[C.green, '#059669']} style={os.btnGrad}>
            <Text style={os.btnTxt}>JOIN</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ─── Winner Banner ────────────────────────────────────────────────
function WinnerBanner({ winnerName, stakeAmt, isYou }: { winnerName: string; stakeAmt: number; isYou: boolean }) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <LinearGradient colors={['#F59E0B', '#D97706', '#92400E']} style={wb.banner}>
        <Text style={wb.crown}>👑</Text>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={wb.name}>{winnerName?.toUpperCase()} WINS</Text>
          {isYou && <Text style={wb.you}>That's you! 🎉</Text>}
          {stakeAmt > 0 && <Text style={wb.prize}>◎{(stakeAmt * 2).toFixed(1)} SOL collected</Text>}
        </View>
        <Text style={wb.crown}>👑</Text>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  loadingScreen: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: S.md },
  loadingText: { color: C.t2, fontSize: T.sm },
  topbar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg, paddingVertical: S.md },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  hero:        { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.xl, gap: S.md, overflow: 'hidden' },
  glowBlob:    { position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: 90, opacity: 0.12 },
  heroPills:   { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  stakePill:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: R.full, borderWidth: 1 },
  stakeEmoji:  { fontSize: 11 },
  stakeAmt:    { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title:       { color: C.t1, fontSize: T['2xl'], fontWeight: '900', lineHeight: 32 },
  desc:        { color: C.t2, fontSize: T.base, lineHeight: 22 },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  deadlineTxt: { color: C.t3, fontSize: T.xs, fontWeight: '600' },

  vsSection:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.lg, paddingVertical: S.lg, gap: S.sm },
  vsCol:      { alignItems: 'center', gap: S.sm },
  vsBadge:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: C.orange, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6 },
  vsTxt:      { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  potBadge:   { backgroundColor: C.gold + '20', borderRadius: R.md, borderWidth: 1, borderColor: C.gold + '40', paddingHorizontal: 6, paddingVertical: 3, alignItems: 'center' },
  potTxt:     { color: C.gold, fontSize: 10, fontWeight: '900' },
  potLabel:   { color: C.gold + 'AA', fontSize: 7, fontWeight: '800', letterSpacing: 1 },

  // Multi VS
  multiVsWrap:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.md },
  multiCreatorSide: { flex: 1, alignItems: 'center', gap: 5 },
  multiCreatorName: { color: C.t1, fontSize: T.sm, fontWeight: '800', textAlign: 'center' },
  creatorTag:       { borderRadius: R.full, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  creatorTagTxt:    { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  multiCountBubble: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, paddingVertical: S.md, gap: 2 },
  multiCountNum:    { color: C.t1, fontSize: T['2xl'], fontWeight: '900' },
  multiCountLabel:  { color: C.t3, fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  // Participants dropdown
  partsDropdown: { marginHorizontal: S.lg, marginBottom: S.md, backgroundColor: C.bgCard, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, padding: S.md, gap: S.sm },
  partsTitle:    { color: C.t3, fontSize: T.xs, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  partRow:       { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.xs },
  partName:      { color: C.t1, fontSize: T.sm, fontWeight: '700', flex: 1 },
  proofBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.green + '15', borderRadius: R.full, borderWidth: 1, borderColor: C.green + '40', paddingHorizontal: 8, paddingVertical: 3 },
  proofBadgeTxt: { color: C.green, fontSize: 9, fontWeight: '800' },
  seeMoreBtn:    { alignItems: 'center', paddingTop: S.sm, borderTopWidth: 1, borderTopColor: C.border },
  seeMoreTxt:    { color: C.purple, fontSize: T.xs, fontWeight: '800' },

  actions:        { paddingHorizontal: S.lg, gap: S.md },
  proofBox:       { backgroundColor: C.bgCard, borderRadius: R['2xl'], borderWidth: 1, borderColor: C.purple + '44', padding: S.lg, gap: S.md },
  proofBoxHeader: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  proofBoxTitle:  { color: C.t1, fontSize: T.base, fontWeight: '900' },
  proofBoxSub:    { color: C.t2, fontSize: T.sm, lineHeight: 20 },
  voteBox:        { backgroundColor: C.bgCard, borderRadius: R['2xl'], borderWidth: 1, borderColor: C.gold + '44', padding: S.lg, gap: S.md },
  voteBoxHeader:  { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  voteBoxTitle:   { color: C.t1, fontSize: T.base, fontWeight: '900' },
  voteBoxSub:     { color: C.t2, fontSize: T.sm, lineHeight: 20 },
  voteBigBtn:     { borderRadius: R.xl, overflow: 'hidden' },
  voteBigBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, paddingVertical: S.lg },
  voteBigBtnTxt:  { color: '#fff', fontSize: T.base, fontWeight: '900', letterSpacing: 1 },
  infoBox:        { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm, backgroundColor: C.cyan + '12', borderRadius: R.xl, borderWidth: 1, borderColor: C.cyan + '44', padding: S.md },
  infoTxt:        { color: C.cyan, fontSize: T.sm, flex: 1, lineHeight: 20 },
});

const pc = StyleSheet.create({
  card:       { flex: 1, backgroundColor: C.bgCard, borderRadius: R['2xl'], borderWidth: 1, borderColor: C.border, padding: S.md, alignItems: 'center', gap: 6, minHeight: 160 },
  winTag:     { borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 2 },
  winTagTxt:  { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  role:       { color: C.t3, fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  avatarRing: { borderRadius: 26, borderWidth: 2, padding: 2 },
  avatarImg:  { width: 44, height: 44, borderRadius: 22 },
  name:       { color: C.t1, fontSize: T.sm, fontWeight: '800', textAlign: 'center' },
  fameRow:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  fameIcon:   { fontSize: 11 },
  fameTxt:    { color: C.purple, fontSize: T.xs, fontWeight: '700' },
  voteWrap:   { width: '100%', gap: 3, marginTop: 2 },
  voteTrack:  { height: 5, backgroundColor: C.bg, borderRadius: 3, overflow: 'hidden' },
  voteFill:   { height: '100%', borderRadius: 3 },
  votePct:    { color: C.t3, fontSize: 9, textAlign: 'center', fontWeight: '700' },
  proofBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: R.full, borderWidth: 1, borderColor: C.border, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: C.bgElevated, marginTop: 2 },
  proofTxt:   { color: C.t3, fontSize: 9, fontWeight: '700' },
});

const os = StyleSheet.create({
  card:    { flex: 1, backgroundColor: C.bgCard, borderRadius: R['2xl'], borderWidth: 1.5, borderColor: C.green + '50', borderStyle: 'dashed', padding: S.md, alignItems: 'center', justifyContent: 'center', gap: S.sm, minHeight: 160 },
  iconWrap:{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.green + '18', alignItems: 'center', justifyContent: 'center' },
  icon:    { fontSize: 22 },
  title:   { color: C.green, fontSize: T.xs, fontWeight: '900', letterSpacing: 1.5 },
  sub:     { color: C.t3, fontSize: 10, textAlign: 'center', lineHeight: 16 },
  btn:     { borderRadius: R.lg, overflow: 'hidden', width: '100%', marginTop: 2 },
  btnGrad: { paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  btnTxt:  { color: '#fff', fontSize: T.sm, fontWeight: '900', letterSpacing: 1.5 },
});

const wb = StyleSheet.create({
  banner: { borderRadius: R['2xl'], padding: S.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: C.gold, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  crown:  { fontSize: 32 },
  name:   { color: '#fff', fontSize: T.xl, fontWeight: '900', letterSpacing: 1 },
  you:    { color: 'rgba(255,255,255,0.85)', fontSize: T.sm, fontWeight: '700' },
  prize:  { color: 'rgba(255,255,255,0.75)', fontSize: T.xs },
});