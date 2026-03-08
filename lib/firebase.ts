import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';

// ── Firebase config ───────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyDakaRaREBzTh9J8rC6npr4eOFmkpnp6Bg',
  authDomain:        'mullerjob-68b96.firebaseapp.com',
  projectId:         'mullerjob-68b96',
  storageBucket:     'mullerjob-68b96.firebasestorage.app',
  messagingSenderId: '611156700841',
  appId:             '1:611156700841:web:91afb6d4a0f0ef5a5183b8',
  measurementId:     'G-WP89QLEJ5C',
};

// ── Init (safe for hot reload) ────────────────────────────────────
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db  = getFirestore(app);
const storage = getStorage(app);

let auth: ReturnType<typeof getAuth>;
try {
  auth = getAuth(app);
} catch {
  auth = initializeAuth(app);
}

// ── Exports ───────────────────────────────────────────────────────
export {

  // Firestore
  addDoc,
  // App
  app,
  auth, collection, db, deleteDoc,
  doc,
  getDoc,
  getDocs,
  // Storage
  getDownloadURL, limit,
  orderBy,
  query, ref, serverTimestamp,
  setDoc, storage, updateDoc, uploadBytesResumable, where
};
