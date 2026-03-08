import {
  collection,
  db,
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

interface Profile {
  id: string;
  wallet_address: string;
  user_id: string;
  username: string;
  profile_image: string | null;
  wins: number;
  losses: number;
  win_rate: number;
  fame: number;
  total_earned: number;
  created_at: string;
  updated_at: string;
}

const PROFILES_COLLECTION = 'profiles';

// Generate unique user ID
function generateUserId(): string {
  return 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// Create or get user profile when wallet connects
export async function createOrUpdateProfile(walletAddress: string): Promise<Profile> {
  try {
    // Check if profile already exists for this wallet
    const q = query(
      collection(db, PROFILES_COLLECTION),
      where('wallet_address', '==', walletAddress)
    );
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      // Profile exists, return it
      const existingProfile = querySnapshot.docs[0];
      return {
        id: existingProfile.id,
        ...existingProfile.data()
      } as Profile;
    }
    
    // Create new profile
    const userId = generateUserId();
    const newProfile: Omit<Profile, 'id'> = {
      wallet_address: walletAddress,
      user_id: userId,
      username: `user_${userId.substr(-6)}`, // Default username
      profile_image: null,
      wins: 0,
      losses: 0,
      win_rate: 0,
      fame: 0,
      total_earned: 0,
      created_at: serverTimestamp() as any,
      updated_at: serverTimestamp() as any
    };
    
    const docRef = doc(collection(db, PROFILES_COLLECTION));
    await setDoc(docRef, newProfile);
    
    return {
      id: docRef.id,
      ...newProfile,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error creating/updating profile:', error);
    throw error;
  }
}

// Get profile by wallet address
export async function getProfileByWallet(walletAddress: string): Promise<Profile | null> {
  try {
    const q = query(
      collection(db, PROFILES_COLLECTION),
      where('wallet_address', '==', walletAddress)
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return null;
    
    const profileDoc = querySnapshot.docs[0];
    return {
      id: profileDoc.id,
      ...profileDoc.data()
    } as Profile;
  } catch (error) {
    console.error('Error fetching profile by wallet:', error);
    return null;
  }
}

// Get profile by user ID
export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  try {
    const q = query(
      collection(db, PROFILES_COLLECTION),
      where('user_id', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return null;
    
    const profileDoc = querySnapshot.docs[0];
    return {
      id: profileDoc.id,
      ...profileDoc.data()
    } as Profile;
  } catch (error) {
    console.error('Error fetching profile by user ID:', error);
    return null;
  }
}

// Update profile (username, profile_image)
export async function updateProfile(profileId: string, updates: Partial<Pick<Profile, 'username' | 'profile_image'>>): Promise<Profile> {
  try {
    const profileRef = doc(db, PROFILES_COLLECTION, profileId);
    await updateDoc(profileRef, {
      ...updates,
      updated_at: serverTimestamp()
    });
    
    // Get updated profile
    const updatedDoc = await getDoc(profileRef);
    if (!updatedDoc.exists()) throw new Error('Profile not found after update');
    
    return {
      id: updatedDoc.id,
      ...updatedDoc.data()
    } as Profile;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
}

// Update user stats (wins, losses, etc.)
export async function updateUserStats(
  profileId: string, 
  stats: Partial<Pick<Profile, 'wins' | 'losses' | 'total_earned'>>
): Promise<Profile> {
  try {
    // Calculate new win rate
    const profileDoc = await getDoc(doc(db, PROFILES_COLLECTION, profileId));
    if (!profileDoc.exists()) throw new Error('Profile not found');
    
    const currentProfile = profileDoc.data() as Profile;
    const newWins = stats.wins !== undefined ? stats.wins : currentProfile.wins;
    const newLosses = stats.losses !== undefined ? stats.losses : currentProfile.losses;
    const newTotalEarned = stats.total_earned !== undefined ? stats.total_earned : currentProfile.total_earned;
    
    // Calculate win rate
    const totalGames = newWins + newLosses;
    const winRate = totalGames > 0 ? Math.round((newWins / totalGames) * 100) : 0;
    
    // Calculate fame (wins * 10 + total_earned * 100)
    const fame = (newWins * 10) + (newTotalEarned * 100);
    
    const profileRef = doc(db, PROFILES_COLLECTION, profileId);
    await updateDoc(profileRef, {
      wins: newWins,
      losses: newLosses,
      win_rate: winRate,
      fame: fame,
      total_earned: newTotalEarned,
      updated_at: serverTimestamp()
    });
    
    // Get updated profile
    const updatedDoc = await getDoc(profileRef);
    if (!updatedDoc.exists()) throw new Error('Profile not found after update');
    
    return {
      id: updatedDoc.id,
      ...updatedDoc.data()
    } as Profile;
  } catch (error) {
    console.error('Error updating user stats:', error);
    throw error;
  }
}

// Get leaderboard (top users by fame)
export async function getLeaderboard(limitCount = 50): Promise<Profile[]> {
  try {
    const q = query(
      collection(db, PROFILES_COLLECTION),
      orderBy('fame', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Profile[];
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
}
