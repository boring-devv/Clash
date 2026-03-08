/**
 * services/firebase-challenges.ts
 * Full Firebase service — challenges, profiles, votes, escrow.
 */
import { getDeviceId } from '@/hooks/useDeviceId';
import {
  addDoc,
  collection,
  db,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from '@/lib/firebase';
import { claimEscrow, getEscrowAddress, refundDepositors } from '@/services/solana';

// ── Collections ───────────────────────────────────────────────────
const C_COL = 'challenges';

// Lazy import to avoid circular deps — notifications wired at runtime
let _notifModule: typeof import('@/services/notifications') | null = null;
async function getNotifModule() {
  if (!_notifModule) {
    _notifModule = await import('@/services/notifications');
  }
  return _notifModule;
}
const P_COL = 'profiles';
const V_COL = 'votes';

// ── Types ─────────────────────────────────────────────────────────
export type ChallengeType       = '1v1' | 'open';
export type PrizeModel          = 'A' | 'B' | 'C' | 'D';
// A = host funds prize, free entry
// B = everyone pays equal entry fee, pool grows
// C = 1v1 both stake equal, winner takes both
// D = free, fame only

export interface Challenge {
  id:                    string;
  creator_id:            string;
  opponent_id:           string | null;
  title:                 string;
  description:           string;
  category:              string;
  type:                  ChallengeType;
  prize_model:           PrizeModel;
  is_host_only:          boolean;
  target_user_id:        string | null;
  max_participants:      number;
  participants:          string[];
  participant_count:     number;
  prize_pool:            number;
  stake_sol:             number;
  duration_hours:        number;
  voting_duration_hours: number;
  voting_deadline:       string | null | undefined;
  creator_image:         string | null;
  creator_username:      string;
  status:                'open' | 'active' | 'pending_vote' | 'completed' | 'resolved' | 'expired';
  creator_proof_url:     string | null;
  opponent_proof_url:    string | null;
  winner_id:             string | null;
  deadline:              string | null | undefined;
  created_at:            string;
  // escrow
  escrow_address:          string | null;
  escrow_funded:           boolean;
  creator_deposit_tx:      string | null;
  opponent_deposit_tx:     string | null;
  opponent_deposit_funded: boolean;
  claim_tx:                string | null;
  // deposit tracking (optional for backwards compatibility)
  creator_deposit_amount?:  number;
  opponent_deposit_amount?: number;
  total_deposited_sol?:     number;
  deposits?: Record<string, { amount: number; tx: string; at: string }>;
  // populated
  creator?:  any;
  opponent?: any;
  votes?:    any[];
}

export interface Profile {
  id:            string;
  wallet_address:string;
  user_id:       string;
  username:      string;
  profile_image: string | null;
  wins:          number;
  losses:        number;
  win_rate:      number;
  fame:          number;
  total_earned:  number;
  streak:        number;
  last_active:   string;
  city:          string;
  created_at:    string;
  updated_at:    string;
}

// ── Helpers ───────────────────────────────────────────────────────
async function fetchProfile(walletAddress: string): Promise<Profile | undefined> {
  const q    = query(collection(db, P_COL), where('wallet_address', '==', walletAddress));
  const snap = await getDocs(q);
  if (snap.empty) return undefined;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Profile;
}

async function fetchVotes(challengeId: string): Promise<any[]> {
  const q    = query(collection(db, V_COL), where('challenge_id', '==', challengeId));
  const snap = await getDocs(q);
  return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
}

async function hydrate(challenge: any): Promise<Challenge> {
  const [creator, votes] = await Promise.all([
    fetchProfile(challenge.creator_id),
    fetchVotes(challenge.id),
  ]);

  let opponent: Profile | undefined;
  if (challenge.opponent_id) {
    opponent = await fetchProfile(challenge.opponent_id);
  }

  return { ...challenge, creator, opponent, votes };
}

// ── Feed ──────────────────────────────────────────────────────────
export async function getFeed(limitCount = 50): Promise<Challenge[]> {
  try {
    const q    = query(collection(db, C_COL), orderBy('created_at', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    const raw  = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    return await Promise.all(raw.map(hydrate));
  } catch (e) {
    console.error('getFeed error:', e);
    return [];
  }
}

// ── Single challenge ──────────────────────────────────────────────
export async function getChallengeById(id: string): Promise<Challenge | null> {
  try {
    const snap = await getDoc(doc(db, C_COL, id));
    if (!snap.exists()) return null;
    return hydrate({ id: snap.id, ...snap.data() });
  } catch (e) {
    console.error('getChallengeById error:', e);
    return null;
  }
}

// ── User challenges ───────────────────────────────────────────────
export async function getUserChallenges(userId: string): Promise<Challenge[]> {
  try {
    // Created by user OR participant
    const [created, participated] = await Promise.all([
      getDocs(query(collection(db, C_COL), where('creator_id', '==', userId), orderBy('created_at', 'desc'))),
      getDocs(query(collection(db, C_COL), where('participants', 'array-contains', userId), orderBy('created_at', 'desc'))),
    ]);

    const seen = new Set<string>();
    const all: any[] = [];
    [...created.docs, ...participated.docs].forEach(d => {
      if (!seen.has(d.id)) { seen.add(d.id); all.push({ id: d.id, ...d.data() }); }
    });

    return await Promise.all(all.map(hydrate));
  } catch (e) {
    console.error('getUserChallenges error:', e);
    return [];
  }
}

// ── Create challenge ──────────────────────────────────────────────
// ── Pre-generate a challenge ID ───────────────────────────────────
// Use this to get an ID BEFORE writing to Firestore.
// Lets us build + sign the escrow tx in one MWA session,
// then write the challenge record after the tx is confirmed.
export function preGenerateChallengeId(): string {
  return doc(collection(db, C_COL)).id;
}

// ── Create challenge with a pre-known ID ──────────────────────────
// Used when we need the ID upfront for escrow tx signing.
export async function createChallengeWithId(
  id: string,
  data: Partial<Challenge>,
  proofVideoUri?: string,
  depositTxSig?: string,
): Promise<Challenge> {
  return createChallenge(data, proofVideoUri, depositTxSig, id);
}

export async function createChallenge(
  data: Partial<Challenge>,
  proofVideoUri?: string,
  depositTxSig?: string,   // pre-confirmed escrow tx signature
  presetId?: string,        // pre-generated Firestore doc ID
): Promise<Challenge> {
  try {
    const profile = await fetchProfile(data.creator_id!);

    // Upload creator proof video if provided (they're competing, not just hosting)
    let creator_proof_url: string | null = null;
    if (proofVideoUri && !data.is_host_only) {
      creator_proof_url = await uploadVideoToStorage(
        proofVideoUri,
        `proofs/${Date.now()}_creator_${data.creator_id}`
      );
    }

    const now        = new Date().toISOString();
    const deadline   = new Date(Date.now() + (data.duration_hours || 24) * 3600000).toISOString();
    const creatorId  = data.creator_id as string;
    const depositAmt = depositTxSig ? (data.prize_pool || data.stake_sol || 0) : 0;

    const payload: Omit<Challenge, 'id' | 'creator' | 'opponent' | 'votes'> = {
      creator_id:              creatorId,
      opponent_id:             null,
      title:                   (data.title as string),
      description:             data.description || '',
      category:                (data.category as string),
      type:                    (data.type || '1v1') as ChallengeType,
      prize_model:             (data.prize_model || 'D') as PrizeModel,
      is_host_only:            data.is_host_only || false,
      target_user_id:          data.target_user_id || null,
      max_participants:        data.max_participants || 2,
      participants:            data.is_host_only ? [] : [creatorId],
      participant_count:       data.is_host_only ? 0 : 1,
      prize_pool:              data.prize_pool || 0,
      stake_sol:               data.stake_sol || 0,
      duration_hours:          data.duration_hours || 24,
      voting_duration_hours:   data.voting_duration_hours || 24,
      voting_deadline:         null,
      creator_image:           profile?.profile_image || null,
      creator_username:        profile?.username || 'Anonymous',
      status:                  'open',
      creator_proof_url:       creator_proof_url,
      opponent_proof_url:      null,
      winner_id:               null,
      deadline,
      escrow_address:          null,
      escrow_funded:           !!depositTxSig,
      creator_deposit_tx:      depositTxSig || null,
      opponent_deposit_tx:     null,
      opponent_deposit_funded: false,
      claim_tx:                null,
      creator_deposit_amount:  depositTxSig ? depositAmt : 0,
      opponent_deposit_amount: 0,
      total_deposited_sol:     depositTxSig ? depositAmt : 0,
      deposits:                depositTxSig ? { [creatorId]: { amount: depositAmt, tx: depositTxSig, at: now } } : {},
      created_at:              now,
    };

    // If a preset ID was given (pre-generated before tx signing), use setDoc.
    // Otherwise fall back to addDoc (auto-ID).
    let docRef: { id: string };
    if (presetId) {
      const docSnap = doc(db, C_COL, presetId);
      await setDoc(docSnap, { ...payload, created_at: serverTimestamp() });
      docRef = { id: presetId };
    } else {
      docRef = await addDoc(collection(db, C_COL), {
        ...payload,
        created_at: serverTimestamp(),
      });
    }

    // Save escrow address + deposit tx derived from real challenge ID
    const realEscrowAddr = getEscrowAddress(docRef.id);
    await updateDoc(doc(db, C_COL, docRef.id), {
      escrow_address:     realEscrowAddr,
      ...(depositTxSig ? {
        creator_deposit_tx:     depositTxSig,
        escrow_funded:          true,
        creator_deposit_amount: depositAmt,
        total_deposited_sol:    depositAmt,
        [`deposits.${creatorId}`]: { amount: depositAmt, tx: depositTxSig, at: now },
      } : {}),
    });

    // Update streak
    await updateStreak(data.creator_id!);

    const result: Challenge = {
      id:                      docRef.id,
      creator_id:              payload.creator_id,
      opponent_id:             null,
      title:                   payload.title,
      description:             payload.description,
      category:                payload.category,
      type:                    payload.type,
      prize_model:             payload.prize_model,
      is_host_only:            payload.is_host_only,
      target_user_id:          payload.target_user_id,
      max_participants:        payload.max_participants,
      participants:            payload.participants,
      participant_count:       payload.participant_count,
      prize_pool:              payload.prize_pool,
      stake_sol:               payload.stake_sol,
      duration_hours:          payload.duration_hours,
      voting_duration_hours:   payload.voting_duration_hours,
      voting_deadline:         payload.voting_deadline,
      creator_image:           payload.creator_image,
      creator_username:        payload.creator_username,
      status:                  'open' as const,
      creator_proof_url:       creator_proof_url,
      opponent_proof_url:      null,
      winner_id:               null,
      deadline:                payload.deadline,
      created_at:              payload.created_at,
      escrow_address:          realEscrowAddr,
      escrow_funded:           payload.escrow_funded,
      creator_deposit_tx:      payload.creator_deposit_tx,
      opponent_deposit_tx:     null,
      opponent_deposit_funded: false,
      claim_tx:                null,
      creator_deposit_amount:  payload.creator_deposit_amount,
      opponent_deposit_amount: payload.opponent_deposit_amount,
      total_deposited_sol:     payload.total_deposited_sol,
      deposits:                payload.deposits,
      creator:                 profile,
      opponent:                undefined,
      votes:                   [],
    };
    return result;
  } catch (e) {
    console.error('createChallenge error:', e);
    throw e;
  }
}

// ── Join challenge ────────────────────────────────────────────────
export async function joinChallenge(
  challengeId: string,
  userId: string,
  proofVideoUri: string,
  depositTxSig?: string,
): Promise<Challenge> {
  try {
    const challengeRef = doc(db, C_COL, challengeId);
    const snap         = await getDoc(challengeRef);
    if (!snap.exists()) throw new Error('Challenge not found');

    const ch = snap.data() as Challenge;
    const now = new Date().toISOString();

    // Guards
    if (ch.creator_id === userId) throw new Error('Cannot join your own challenge');
    if (ch.participants?.includes(userId)) throw new Error('Already joined');
    if (ch.participant_count >= ch.max_participants) throw new Error('Challenge is full');
    if (ch.status !== 'open') throw new Error('Challenge is not open');

    // Upload proof video
    const proofUrl = await uploadVideoToStorage(
      proofVideoUri,
      `proofs/${challengeId}_${userId}`
    );

    const newParticipants = [...(ch.participants || []), userId];
    const newCount        = newParticipants.length;
    const isFull          = newCount >= ch.max_participants;

    const updates: any = {
      participants:      newParticipants,
      participant_count: newCount,
      status:            isFull ? 'active' : 'open',
    };

    // For 1v1: set opponent_id
    if (ch.type === '1v1') {
      updates.opponent_id       = userId;
      updates.opponent_proof_url = proofUrl;
      updates.status            = 'active';
    }

    // Save deposit tx if provided
    if (depositTxSig) {
      const depositAmt = ch.prize_model === 'B'
        ? (ch.prize_pool || ch.stake_sol || 0)
        : (ch.stake_sol || 0);

      const prevTotal = ch.total_deposited_sol ?? 0;
      updates.total_deposited_sol = prevTotal + depositAmt;
      updates[`deposits.${userId}`] = { amount: depositAmt, tx: depositTxSig, at: now };

      // For 1v1 stake: store opponent deposit
      if (ch.type === '1v1' || ch.prize_model === 'C') {
        updates.opponent_deposit_tx     = depositTxSig;
        updates.opponent_deposit_funded = true;
        updates.opponent_deposit_amount = depositAmt;
      }
    }

    await updateDoc(challengeRef, updates);

    // Save participant proof in sub-collection
    await addDoc(collection(db, C_COL, challengeId, 'participant_proofs'), {
      user_id:   userId,
      proof_url: proofUrl,
      joined_at: now,
    });

    // Update streak
    await updateStreak(userId);

    return getChallengeById(challengeId) as Promise<Challenge>;
  } catch (e) {
    console.error('joinChallenge error:', e);
    throw e;
  }
}

// ── Get participants with proofs ───────────────────────────────────
export async function getParticipants(challengeId: string): Promise<{
  userId: string;
  proofUrl: string;
  joinedAt: string;
  profile?: Profile;
}[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, C_COL, challengeId, 'participant_proofs'),
        orderBy('joined_at', 'asc')
      )
    );

    return await Promise.all(
      snap.docs.map(async (d: any) => {
        const data    = d.data();
        const profile = await fetchProfile(data.user_id);
        return {
          userId:    data.user_id,
          proofUrl:  data.proof_url,
          joinedAt:  data.joined_at,
          profile,
        };
      })
    );
  } catch (e) {
    console.error('getParticipants error:', e);
    return [];
  }
}

// ── Cast vote (with device check) ────────────────────────────────
export async function castVote(
  challengeId: string,
  voterId: string,
  voteFor: string,       // userId of who they're voting for
): Promise<void> {
  try {
    const deviceId = await getDeviceId();

    // Check: has this voter already voted?
    const existingVoterVote = await getDocs(
      query(collection(db, V_COL),
        where('challenge_id', '==', challengeId),
        where('voter_id', '==', voterId)
      )
    );
    if (!existingVoterVote.empty) throw new Error('You already voted on this challenge');

    // Check: has this device already voted?
    const existingDeviceVote = await getDocs(
      query(collection(db, V_COL),
        where('challenge_id', '==', challengeId),
        where('device_id', '==', deviceId)
      )
    );
    if (!existingDeviceVote.empty) throw new Error('Already voted from this device');

    // Check: is voter a participant? (participants cannot vote)
    const challengeSnap = await getDoc(doc(db, C_COL, challengeId));
    const ch            = challengeSnap.data() as Challenge;
    if (ch.participants?.includes(voterId)) throw new Error('Participants cannot vote');
    if (ch.creator_id === voterId) throw new Error('Creator cannot vote on their own challenge');

    // Check wallet age (24h minimum)
    const voterProfile = await fetchProfile(voterId);
    if (voterProfile?.created_at) {
      const ageMs = Date.now() - new Date(voterProfile.created_at).getTime();
      if (ageMs < 24 * 3600 * 1000) throw new Error('Account must be 24 hours old to vote');
    }

    // Fame-based vote weight
    const fame   = voterProfile?.fame || 0;
    const weight = fame >= 500 ? 1.5 : fame >= 100 ? 1.2 : 1.0;

    // Cast vote
    await addDoc(collection(db, V_COL), {
      challenge_id: challengeId,
      voter_id:     voterId,
      vote_for:     voteFor,
      device_id:    deviceId,
      weight,
      created_at:   new Date().toISOString(),
    });

    // Award fame to voter (+5) and voted-for participant (+5)
    await Promise.all([
      addFame(voterId, 5),
      addFame(voteFor, 5),
    ]);

    // Update streak for voter
    await updateStreak(voterId);

    // Check if voting should close
    await checkVotingClose(challengeId);

  } catch (e) {
    console.error('castVote error:', e);
    throw e;
  }
}

// ── Get vote tally ────────────────────────────────────────────────
export async function getVoteTally(challengeId: string): Promise<{
  creator_votes: number;
  opponent_votes: number;
  tally: Record<string, number>; // userId → weighted vote count
}> {
  try {
    const snap  = await getDocs(query(collection(db, V_COL), where('challenge_id', '==', challengeId)));
    const votes = snap.docs.map((d: any) => d.data());

    const tally: Record<string, number> = {};
    let creator_votes = 0, opponent_votes = 0;

    const ch = (await getDoc(doc(db, C_COL, challengeId))).data() as Challenge;

    for (const v of votes) {
      tally[v.vote_for] = (tally[v.vote_for] || 0) + (v.weight || 1);
      if (v.vote_for === ch?.creator_id)   creator_votes += v.weight || 1;
      if (v.vote_for === ch?.opponent_id)  opponent_votes += v.weight || 1;
    }

    return { creator_votes, opponent_votes, tally };
  } catch (e) {
    console.error('getVoteTally error:', e);
    return { creator_votes: 0, opponent_votes: 0, tally: {} };
  }
}

// ── Get my vote ───────────────────────────────────────────────────
export async function getMyVote(challengeId: string, voterId: string): Promise<string | null> {
  try {
    const snap = await getDocs(
      query(collection(db, V_COL),
        where('challenge_id', '==', challengeId),
        where('voter_id', '==', voterId)
      )
    );
    if (snap.empty) return null;
    return snap.docs[0].data().vote_for;
  } catch {
    return null;
  }
}

// ── Check if voting should close ──────────────────────────────────
export async function checkVotingClose(challengeId: string): Promise<void> {
  try {
    const snap = await getDoc(doc(db, C_COL, challengeId));
    if (!snap.exists()) return;
    const ch = snap.data() as Challenge;

    if (ch.status !== 'pending_vote') return;
    if (!ch.voting_deadline) return;

    const deadlinePassed = new Date(ch.voting_deadline).getTime() < Date.now();
    if (!deadlinePassed) return;

    await resolveChallenge(challengeId);
  } catch (e) {
    console.error('checkVotingClose error:', e);
  }
}

// ── Open voting ───────────────────────────────────────────────────
export async function openVoting(challengeId: string): Promise<void> {
  try {
    const snap = await getDoc(doc(db, C_COL, challengeId));
    const ch   = snap.data() as Challenge;

    const votingDeadline = new Date(
      Date.now() + (ch.voting_duration_hours || 24) * 3600000
    ).toISOString();

    await updateDoc(doc(db, C_COL, challengeId), {
      status:          'pending_vote',
      voting_deadline: votingDeadline,
    });

    // Notify all participants that voting is open
    try {
      const nm = await getNotifModule();
      const allIds = [ch.creator_id, ch.opponent_id, ...(ch.participants || [])].filter(Boolean) as string[];
      await nm.notifyVotingOpen(allIds, challengeId, ch.title);
    } catch {}

  } catch (e) {
    console.error('openVoting error:', e);
  }
}

// ── Resolve challenge (pick winner) ──────────────────────────────
export async function resolveChallenge(challengeId: string): Promise<void> {
  try {
    const snap = await getDoc(doc(db, C_COL, challengeId));
    if (!snap.exists()) return;
    const ch = snap.data() as Challenge;

    const { tally } = await getVoteTally(challengeId);
    if (Object.keys(tally).length === 0) {
      // No votes — refund
      await refundChallenge(challengeId);
      return;
    }

    // Find winner — most weighted votes
    // Tiebreaker: whoever joined earlier (creator wins ties vs opponent)
    let winnerId = '';
    let maxVotes = -1;
    for (const [userId, votes] of Object.entries(tally)) {
      if (votes > maxVotes) {
        maxVotes = votes;
        winnerId = userId;
      }
    }

    // On-chain claim
    let claimTx = '';
    try {
      if (ch.prize_pool > 0 && ch.escrow_address) {
        const result = await claimEscrow(challengeId, winnerId);
        claimTx      = result.signature;
      }
    } catch (e) {
      console.warn('Escrow claim failed (may be empty on testnet):', e);
    }

    // Update challenge
    await updateDoc(doc(db, C_COL, challengeId), {
      status:    'resolved',
      winner_id: winnerId,
      claim_tx:  claimTx,
    });

    // Update winner stats
    const winnerProfile = await fetchProfile(winnerId);
    if (winnerProfile) {
      await updateDoc(doc(db, P_COL, winnerProfile.id), {
        wins:         (winnerProfile.wins || 0) + 1,
        total_earned: (winnerProfile.total_earned || 0) + ch.prize_pool,
        fame:         (winnerProfile.fame || 0) + (ch.prize_pool > 0 ? 100 : 50),
      });
    }

    // Fame for all participants (submitted proof)
    for (const participantId of ch.participants || []) {
      if (participantId !== winnerId) {
        await addFame(participantId, 10);
      }
    }

    // Fame for host if not competing
    if (ch.is_host_only) {
      await addFame(ch.creator_id, 20);
    }

    // Notify winner
    try {
      const nm = await getNotifModule();
      await nm.notifyWinner(winnerId, challengeId, ch.title, ch.prize_pool ?? 0);
    } catch {}

  } catch (e) {
    console.error('resolveChallenge error:', e);
  }
}

// ── Refund challenge ──────────────────────────────────────────────
export async function refundChallenge(challengeId: string): Promise<void> {
  try {
    const snap = await getDoc(doc(db, C_COL, challengeId));
    if (!snap.exists()) return;
    const ch = snap.data() as Challenge;

    // Attempt on-chain refund if there's SOL in escrow
    if (ch.prize_pool > 0 && ch.escrow_address) {
      try {
        // Refund creator (Model A/C) or all depositors (Model B)
        if (ch.prize_model === 'B') {
          // Each participant gets their entry back
          const depositors = ch.participants.map(p => ({ wallet: p, amount: ch.stake_sol }));
          await refundDepositors(challengeId, depositors);
        } else {
          // Creator gets full prize pool back
          await claimEscrow(challengeId, ch.creator_id);
        }
      } catch (e) {
        console.warn('Refund tx failed:', e);
      }
    }

    await updateDoc(doc(db, C_COL, challengeId), {
      status: 'expired',
    });
  } catch (e) {
    console.error('refundChallenge error:', e);
  }
}

// ── Upload proof video ────────────────────────────────────────────
export async function uploadProof(
  challengeId: string,
  userId: string,
  fileUri: string,
): Promise<string> {
  try {
    const proofUrl = await uploadVideoToStorage(
      fileUri,
      `proofs/${challengeId}_${userId}`
    );

    const challengeRef = doc(db, C_COL, challengeId);
    const snap         = await getDoc(challengeRef);
    if (!snap.exists()) throw new Error('Challenge not found');

    const ch    = snap.data() as Challenge;
    const field = ch.creator_id === userId ? 'creator_proof_url' : 'opponent_proof_url';
    const other = field === 'creator_proof_url' ? 'opponent_proof_url' : 'creator_proof_url';

    const updates: any = { [field]: proofUrl };

    // If both proofs exist → open voting
    if (ch[other as keyof Challenge]) {
      updates.status = 'pending_vote';
      updates.voting_deadline = new Date(
        Date.now() + (ch.voting_duration_hours || 24) * 3600000
      ).toISOString();
    }

    await updateDoc(challengeRef, updates);
    return proofUrl;
  } catch (e) {
    console.error('uploadProof error:', e);
    throw e;
  }
}

// ── Upload video to Firebase Storage ─────────────────────────────
// ── Cloudinary upload (free, no credit card needed) ──────────────
// Set these in your .env or constants file
const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'YOUR_CLOUD_NAME';
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'YOUR_UPLOAD_PRESET';

export async function uploadVideoToStorage(
  fileUri: string,
  path: string,
): Promise<string> {
  const ext      = fileUri.split('.').pop() || 'mp4';
  const formData = new FormData();

  formData.append('file', {
    uri:  fileUri,
    type: `video/${ext}`,
    name: `${path.replace(/\//g, '_')}.${ext}`,
  } as any);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', 'clash_proofs');
  formData.append('resource_type', 'video');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cloudinary upload failed: ${err}`);
  }

  const data = await response.json();
  return data.secure_url as string;
}

// ── Escrow helpers ────────────────────────────────────────────────
export async function saveCreatorDeposit(
  challengeId: string,
  txSig: string,
  escrowAddress: string,
): Promise<void> {
  await updateDoc(doc(db, C_COL, challengeId), {
    creator_deposit_tx: txSig,
    escrow_address:     escrowAddress,
    escrow_funded:      true,
  });
}

export async function saveOpponentDeposit(
  challengeId: string,
  txSig: string,
): Promise<void> {
  await updateDoc(doc(db, C_COL, challengeId), {
    opponent_deposit_tx:     txSig,
    opponent_deposit_funded: true,
  });
}

export async function saveClaimTx(
  challengeId: string,
  winnerId: string,
  claimTx: string,
): Promise<void> {
  await updateDoc(doc(db, C_COL, challengeId), {
    claim_tx:  claimTx,
    winner_id: winnerId,
    status:    'resolved',
  });
}

export async function getChallengeEscrow(challengeId: string) {
  const snap = await getDoc(doc(db, C_COL, challengeId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    escrow_address:          d.escrow_address          ?? null,
    escrow_funded:           d.escrow_funded            ?? false,
    creator_deposit_tx:      d.creator_deposit_tx       ?? null,
    opponent_deposit_tx:     d.opponent_deposit_tx      ?? null,
    opponent_deposit_funded: d.opponent_deposit_funded  ?? false,
    claim_tx:                d.claim_tx                 ?? null,
    stake_sol:               d.stake_sol                ?? 0,
    prize_pool:              d.prize_pool               ?? 0,
  };
}

// ── Profile helpers ───────────────────────────────────────────────
export async function getProfileByWallet(wallet: string): Promise<Profile | null> {
  const p = await fetchProfile(wallet);
  return p || null;
}

export async function updateUserStats(profileId: string, updates: Partial<Profile>): Promise<void> {
  await updateDoc(doc(db, P_COL, profileId), updates);
}

// ── Fame ──────────────────────────────────────────────────────────
async function addFame(walletAddress: string, amount: number): Promise<void> {
  try {
    const profile = await fetchProfile(walletAddress);
    if (!profile) return;
    await updateDoc(doc(db, P_COL, profile.id), {
      fame: (profile.fame || 0) + amount,
    });
  } catch {}
}

// ── Streak ────────────────────────────────────────────────────────
export async function updateStreak(walletAddress: string): Promise<void> {
  try {
    const profile = await fetchProfile(walletAddress);
    if (!profile) return;

    const today     = new Date().toDateString();
    const lastActive = profile.last_active
      ? new Date(profile.last_active).toDateString()
      : null;

    if (lastActive === today) return; // Already active today

    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const newStreak = lastActive === yesterday
      ? (profile.streak || 0) + 1   // consecutive day
      : 1;                           // streak broken, reset to 1

    await updateDoc(doc(db, P_COL, profile.id), {
      streak:      newStreak,
      last_active: new Date().toISOString(),
      fame:        (profile.fame || 0) + 5, // +5 fame for daily action
    });
  } catch {}
}

export async function getUserStreak(walletAddress: string): Promise<number> {
  const profile = await fetchProfile(walletAddress);
  return profile?.streak || 0;
}

// ── Leaderboard ───────────────────────────────────────────────────
export async function getLeaderboard(limitCount = 50): Promise<Profile[]> {
  try {
    const snap = await getDocs(
      query(collection(db, P_COL), orderBy('fame', 'desc'), limit(limitCount))
    );
    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as Profile[];
  } catch {
    return [];
  }
}

// ── Notifications (stored in Firestore for in-app) ────────────────
export async function getNotifications(userId: string): Promise<any[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'notifications'),
        where('user_id', '==', userId),
        orderBy('created_at', 'desc'),
        limit(30)
      )
    );
    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  data?: any,
): Promise<void> {
  try {
    await addDoc(collection(db, 'notifications'), {
      user_id:    userId,
      type,
      title,
      body,
      data:       data || {},
      read:       false,
      created_at: new Date().toISOString(),
    });
  } catch {}
}

// ── Accept challenge (legacy 1v1) ─────────────────────────────────
export async function acceptChallenge(challengeId: string, opponentId: string): Promise<Challenge> {
  await updateDoc(doc(db, C_COL, challengeId), {
    opponent_id: opponentId,
    status:      'active',
  });
  return getChallengeById(challengeId) as Promise<Challenge>;
}

// ── Delete challenge ──────────────────────────────────────────────
export async function deleteChallenge(id: string): Promise<void> {
  await deleteDoc(doc(db, C_COL, id));
}