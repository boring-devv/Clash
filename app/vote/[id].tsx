/**
 * app/vote/[id].tsx
 * Shows all participant proof videos. User votes for one.
 * Auto-resolves when voting deadline passes.
 */
import { WalletAvatar } from '@/components/ui';
import { C, CAT_COLORS, R, S, T } from '@/constants/theme';
import { useWallet } from '@/context/WalletContext';
import {
  castVote,
  checkVotingClose,
  getChallengeById,
  getMyVote,
  getParticipants,
  getVoteTally,
  type Challenge,
} from '@/services/firebase-challenges';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated,
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Participant = {
  userId: string; proofUrl: string; joinedAt: string; profile?: any; votes?: number;
};

export default function VoteScreen() {
  const { id }     = useLocalSearchParams();
  const router     = useRouter();
  const { pubkey } = useWallet();

  const [challenge,     setChallenge]     = useState<Challenge | null>(null);
  const [participants,  setParticipants]  = useState<Participant[]>([]);
  const [myVote,        setMyVote]        = useState<string | null>(null);
  const [voting,        setVoting]        = useState<string | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [votingClosed,  setVotingClosed]  = useState(false);
  const [isParticipant, setIsParticipant] = useState(false);
  const headerO = useRef(new Animated.Value(0)).current;

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const [ch, parts] = await Promise.all([
        getChallengeById(id as string),
        getParticipants(id as string),
      ]);
      if (!ch) { router.back(); return; }
      setChallenge(ch);

      const now      = Date.now();
      const vd       = ch.voting_deadline ? new Date(ch.voting_deadline).getTime() : null;
      const resolved = ch.status === 'resolved' || ch.status === 'completed';
      const timeUp   = vd ? now > vd : false;
      const closed   = resolved || timeUp;
      setVotingClosed(closed);

      if (timeUp && !resolved) {
        await checkVotingClose(id as string);
        setVotingClosed(true);
      }

      const amIn = pubkey
        ? (ch.participants?.includes(pubkey) || ch.creator_id === pubkey || ch.opponent_id === pubkey)
        : false;
      setIsParticipant(amIn);

      // Get tallies
      const tallyData = await getVoteTally(id as string);
      const perUser: Record<string, number> = (tallyData as any).perUser ?? {};

      if (pubkey && !amIn) {
        const mv = await getMyVote(id as string, pubkey);
        setMyVote(mv);
      }

      setParticipants(parts.map(p => ({ ...p, votes: perUser[p.userId] ?? 0 })));
      Animated.timing(headerO, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (e) {
      console.error(e);
      Alert.alert('Error loading proofs');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const vote = async (userId: string) => {
    if (!pubkey || myVote || voting || votingClosed || isParticipant) return;
    setVoting(userId);
    try {
      await castVote(id as string, pubkey, userId as any);
      setMyVote(userId);
      await checkVotingClose(id as string);
      await load();
    } catch (e: any) {
      Alert.alert('Vote failed', e?.message ?? 'Please try again');
    } finally { setVoting(null); }
  };

  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={C.purple} size="large" />
        <Text style={s.loadingTxt}>Loading proofs...</Text>
      </View>
    );
  }
  if (!challenge) return null;

  const catCol    = CAT_COLORS[challenge.category] || C.purple;
  const totalVotes = participants.reduce((sum, p) => sum + (p.votes ?? 0), 0);
  const winnerId  = challenge.winner_id;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Animated.View style={[s.header, { opacity: headerO }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.t2} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerLabel}>PROOF GALLERY</Text>
          <Text style={s.headerTitle} numberOfLines={1}>{challenge.title}</Text>
        </View>
        <View style={{ width: 36 }} />
      </Animated.View>

      {/* Banners */}
      {isParticipant && !votingClosed && (
        <View style={[s.banner, { backgroundColor: C.purple+'18', borderColor: C.purple+'44' }]}>
          <Ionicons name="time-outline" size={16} color={C.purple} />
          <Text style={[s.bannerTxt, { color: C.purple }]}>You're in this — voting in progress 🗳️</Text>
        </View>
      )}
      {myVote && !votingClosed && (
        <View style={[s.banner, { backgroundColor: C.green+'18', borderColor: C.green+'44' }]}>
          <Ionicons name="checkmark-circle" size={16} color={C.green} />
          <Text style={[s.bannerTxt, { color: C.green }]}>Vote locked in ✅</Text>
        </View>
      )}
      {votingClosed && (
        <View style={[s.banner, { backgroundColor: C.gold+'18', borderColor: C.gold+'44' }]}>
          <Ionicons name="trophy" size={16} color={C.gold} />
          <Text style={[s.bannerTxt, { color: C.gold }]}>
            {winnerId
              ? `👑 Winner: ${participants.find(p => p.userId === winnerId)?.profile?.username ?? 'Unknown'}`
              : 'Voting closed — results in'}
          </Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {participants.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 48 }}>📭</Text>
            <Text style={s.emptyTxt}>No proofs submitted yet</Text>
          </View>
        ) : participants.map((p, i) => {
          const iVoted    = myVote === p.userId;
          const otherVote = !!(myVote && myVote !== p.userId);
          const isVoting  = voting === p.userId;
          const isWinner  = winnerId === p.userId;
          const pct       = totalVotes > 0 ? Math.round((p.votes ?? 0) / totalVotes * 100) : 0;

          return (
            <ProofCard
              key={p.userId}
              p={p} index={i}
              iVoted={iVoted} otherVote={otherVote} isVoting={isVoting}
              isWinner={isWinner} pct={pct} votes={p.votes ?? 0}
              isParticipant={isParticipant} votingClosed={votingClosed}
              catCol={catCol} onVote={() => vote(p.userId)}
            />
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProofCard({ p, index, iVoted, otherVote, isVoting, isWinner, pct, votes, isParticipant, votingClosed, catCol, onVote }: any) {
  const slideY  = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideY,  { toValue: 0, duration: 350, delay: index * 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[s.card, { opacity, transform: [{ translateY: slideY }] }, isWinner && { borderColor: C.gold+'66' }]}>
      {isWinner && (
        <LinearGradient colors={[C.gold+'28', C.gold+'08']} style={s.winBanner}>
          <Text style={s.winBannerTxt}>👑 WINNER</Text>
        </LinearGradient>
      )}

      <View style={s.playerRow}>
        <WalletAvatar pubkey={p.profile?.wallet_address || p.userId} username={p.profile?.username} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={s.playerName}>{p.profile?.username ?? p.userId.slice(0,8)}</Text>
          <Text style={s.playerMeta}>⚡ {p.profile?.fame_points ?? 0} · {p.profile?.wins ?? 0}W</Text>
        </View>
        {iVoted && (
          <View style={s.myVoteBadge}><Text style={s.myVoteBadgeTxt}>YOUR VOTE</Text></View>
        )}
      </View>

      {p.proofUrl ? (
        <View style={s.videoWrap}>
          <Video source={{ uri: p.proofUrl }} style={s.video} resizeMode={ResizeMode.COVER} useNativeControls isLooping={false} />
        </View>
      ) : (
        <View style={s.noVideo}><Text style={{ color: C.t3 }}>No proof submitted</Text></View>
      )}

      {(votingClosed || iVoted || otherVote) && (
        <View style={s.bar}>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${pct}%` as any, backgroundColor: isWinner ? C.gold : catCol }]} />
          </View>
          <Text style={[s.barPct, isWinner && { color: C.gold }]}>{pct}% · {votes} votes</Text>
        </View>
      )}

      {/* Vote button states */}
      {!isParticipant && !votingClosed && (
        isVoting ? (
          <View style={[s.voteBtn, { backgroundColor: C.bgElevated }]}>
            <ActivityIndicator size="small" color={C.purple} />
          </View>
        ) : iVoted ? (
          <View style={[s.voteBtn, { backgroundColor: C.green+'22', borderColor: C.green }]}>
            <Ionicons name="checkmark-circle" size={18} color={C.green} />
            <Text style={[s.voteTxt, { color: C.green }]}>VOTED</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={onVote}
            disabled={otherVote || isVoting}
            activeOpacity={0.8}
            style={[s.voteBtn, { backgroundColor: otherVote ? C.bgElevated : C.purple, borderColor: otherVote ? C.border : C.purple, opacity: otherVote ? 0.35 : 1 }]}
          >
            <Ionicons name="thumbs-up" size={18} color={otherVote ? C.t3 : '#fff'} />
            <Text style={[s.voteTxt, { color: otherVote ? C.t3 : '#fff' }]}>VOTE FOR THIS</Text>
          </TouchableOpacity>
        )
      )}
      {isParticipant && !votingClosed && (
        <View style={[s.voteBtn, { backgroundColor: C.purple+'18', borderColor: C.purple+'33' }]}>
          <Ionicons name="time-outline" size={16} color={C.purple} />
          <Text style={[s.voteTxt, { color: C.purple }]}>VOTING IN PROGRESS</Text>
        </View>
      )}
      {votingClosed && !iVoted && !isParticipant && (
        <View style={[s.voteBtn, { backgroundColor: C.bgElevated }]}>
          <Ionicons name="lock-closed" size={16} color={C.t3} />
          <Text style={[s.voteTxt, { color: C.t3 }]}>VOTING CLOSED</Text>
        </View>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: S.md },
  loadingTxt: { color: C.t2, fontSize: T.sm },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.lg, paddingVertical: S.md, gap: S.md },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  headerLabel:  { color: C.t3, fontSize: T.xs, fontWeight: '800', letterSpacing: 1.5 },
  headerTitle:  { color: C.t1, fontSize: T.base, fontWeight: '900' },
  banner:    { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginHorizontal: S.lg, marginBottom: S.sm, borderRadius: R.xl, borderWidth: 1, padding: S.md },
  bannerTxt: { fontSize: T.sm, fontWeight: '700', flex: 1 },
  scroll: { padding: S.lg, paddingBottom: 40, gap: S.lg },
  empty:   { alignItems: 'center', paddingVertical: 60, gap: S.md },
  emptyTxt:{ color: C.t2, fontSize: T.base, fontWeight: '700' },
  card:       { backgroundColor: C.bgCard, borderRadius: R['2xl'], borderWidth: 1, borderColor: C.border, overflow: 'hidden', gap: S.md, padding: S.md },
  winBanner:    { margin: -S.md, marginBottom: 0, padding: S.sm, alignItems: 'center' },
  winBannerTxt: { color: C.gold, fontSize: T.xs, fontWeight: '900', letterSpacing: 2 },
  playerRow:    { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  playerName:   { color: C.t1, fontSize: T.base, fontWeight: '800' },
  playerMeta:   { color: C.t3, fontSize: T.xs },
  myVoteBadge:  { backgroundColor: C.green+'22', borderRadius: R.full, borderWidth: 1, borderColor: C.green+'55', paddingHorizontal: 8, paddingVertical: 3 },
  myVoteBadgeTxt:{ color: C.green, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  videoWrap: { borderRadius: R.xl, overflow: 'hidden', height: 220, backgroundColor: C.bgElevated },
  video:     { flex: 1 },
  noVideo:   { height: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgElevated, borderRadius: R.xl },
  bar:       { gap: 5 },
  barTrack:  { height: 6, backgroundColor: C.bgElevated, borderRadius: 3, overflow: 'hidden' },
  barFill:   { height: '100%', borderRadius: 3 },
  barPct:    { color: C.t2, fontSize: T.sm, fontWeight: '800' },
  voteBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, borderRadius: R.xl, borderWidth: 1, borderColor: 'transparent', paddingVertical: 13 },
  voteTxt:   { fontSize: T.sm, fontWeight: '900', letterSpacing: 1 },
});