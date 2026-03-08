/**
 * services/notifications.ts
 * In-app notification service — Firebase Firestore backed.
 * No push tokens needed for hackathon demo.
 * Triggers notifications on key challenge events.
 */
import { db } from '@/lib/firebase';
import {
    addDoc,
    collection,
    doc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
    where,
    writeBatch,
} from 'firebase/firestore';

const N_COL = 'notifications';

export type NotifType =
  | 'challenge_received'   // Someone sent you a 1v1 challenge
  | 'challenge_accepted'   // Your opponent accepted
  | 'challenge_joined'     // Someone joined your open challenge
  | 'proof_submitted'      // Opponent submitted their proof
  | 'voting_open'          // Voting is now open on a challenge you're in
  | 'winner'               // You won
  | 'challenge_expired'    // Challenge expired with no opponent
  | 'new_vote'             // Someone voted on a challenge you're in
  | 'streak_broken';       // Your streak was broken

export interface Notification {
  id:          string;
  user_id:     string;
  type:        NotifType;
  title:       string;
  body:        string;
  read:        boolean;
  created_at:  string;
  data?:       Record<string, any>;
}

// ── Create ────────────────────────────────────────────────────────
export async function pushNotification(
  userId:    string,
  type:      NotifType,
  title:     string,
  body:      string,
  data?:     Record<string, any>,
): Promise<void> {
  if (!userId) return;
  try {
    await addDoc(collection(db, N_COL), {
      user_id:    userId,
      type,
      title,
      body,
      data:       data ?? {},
      read:       false,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[notifications] pushNotification error:', e);
  }
}

// ── Read ──────────────────────────────────────────────────────────
export async function getNotifications(userId: string): Promise<Notification[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, N_COL),
        where('user_id', '==', userId),
        orderBy('created_at', 'desc'),
        limit(40),
      )
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
  } catch (e) {
    console.error('[notifications] getNotifications error:', e);
    return [];
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const snap = await getDocs(
      query(
        collection(db, N_COL),
        where('user_id', '==', userId),
        where('read', '==', false),
      )
    );
    return snap.size;
  } catch { return 0; }
}

// ── Mark read ─────────────────────────────────────────────────────
export async function markRead(notifId: string): Promise<void> {
  try {
    await updateDoc(doc(db, N_COL, notifId), { read: true });
  } catch {}
}

export async function markAllRead(userId: string): Promise<void> {
  try {
    const snap = await getDocs(
      query(collection(db, N_COL), where('user_id', '==', userId), where('read', '==', false))
    );
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
  } catch {}
}

// ── Real-time unread listener ─────────────────────────────────────
export function subscribeUnreadCount(
  userId:   string,
  callback: (count: number) => void,
): () => void {
  try {
    const q = query(
      collection(db, N_COL),
      where('user_id', '==', userId),
      where('read', '==', false),
    );
    const unsub = onSnapshot(q, snap => callback(snap.size), () => callback(0));
    return unsub;
  } catch {
    return () => {};
  }
}

// ── Challenge event helpers (call these from firebase-challenges.ts) ─
export async function notifyChallengeSent(
  opponentId:   string,
  creatorName:  string,
  challengeId:  string,
  title:        string,
  stakeSol:     number,
): Promise<void> {
  await pushNotification(
    opponentId,
    'challenge_received',
    `⚔️ ${creatorName} challenged you`,
    `"${title}" · ${stakeSol > 0 ? `◎${stakeSol} stake` : 'Free'}`,
    { challenge_id: challengeId },
  );
}

export async function notifyChallengeAccepted(
  creatorId:    string,
  opponentName: string,
  challengeId:  string,
  title:        string,
): Promise<void> {
  await pushNotification(
    creatorId,
    'challenge_accepted',
    `✅ ${opponentName} accepted your challenge`,
    `"${title}" — battle is live. Upload your proof!`,
    { challenge_id: challengeId },
  );
}

export async function notifyChallengeJoined(
  creatorId:     string,
  joinerName:    string,
  challengeId:   string,
  title:         string,
  totalJoined:   number,
  maxParticipants: number,
): Promise<void> {
  await pushNotification(
    creatorId,
    'challenge_joined',
    `👥 ${joinerName} joined your challenge`,
    `"${title}" · ${totalJoined}/${maxParticipants} joined`,
    { challenge_id: challengeId },
  );
}

export async function notifyProofSubmitted(
  opponentId:   string,
  submitterName: string,
  challengeId:  string,
  title:        string,
): Promise<void> {
  await pushNotification(
    opponentId,
    'proof_submitted',
    `📹 ${submitterName} submitted their proof`,
    `"${title}" — submit yours before the deadline!`,
    { challenge_id: challengeId },
  );
}

export async function notifyVotingOpen(
  participantIds: string[],
  challengeId:    string,
  title:          string,
): Promise<void> {
  await Promise.all(
    participantIds.map(uid =>
      pushNotification(
        uid,
        'voting_open',
        '🗳️ Voting is now open',
        `"${title}" — community is judging. Results soon.`,
        { challenge_id: challengeId },
      )
    )
  );
}

export async function notifyWinner(
  winnerId:    string,
  challengeId: string,
  title:       string,
  prize:       number,
): Promise<void> {
  await pushNotification(
    winnerId,
    'winner',
    '👑 YOU WON',
    prize > 0
      ? `"${title}" — ◎${prize.toFixed(3)} SOL is in your wallet`
      : `"${title}" — fame points awarded!`,
    { challenge_id: challengeId },
  );
}

export async function notifyChallengeExpired(
  creatorId:   string,
  challengeId: string,
  title:       string,
): Promise<void> {
  await pushNotification(
    creatorId,
    'challenge_expired',
    '💀 Challenge expired',
    `"${title}" — no opponent joined in time. Refunded.`,
    { challenge_id: challengeId },
  );
}