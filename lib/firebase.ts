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
  apiKey:            '',
  authDomain:        '',
  projectId:         '',
  storageBucket:     '',
  messagingSenderId: '',
  appId:             '',
  measurementId:     '',
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
  apiKey:            '',
  authDomain:        '',
  projectId:         '',
  storageBucket:     '',
  messagingSenderId: '',
  appId:             '',
  measurementId:     '',
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
