// ============================================================
// NEXUS MACHINERY — FIREBASE INITIALIZATION
// Uses the same Firebase project as the website
// Replace config values with your actual Firebase project config
// ============================================================

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// ─── REPLACE WITH YOUR ACTUAL FIREBASE CONFIG ─────────────────
// Get this from Firebase Console → Project Settings → Your apps → Web app
const firebaseConfig = {
  apiKey: "AIzaSyBYjOZqjDfUG5gkZatuJI2AVHw8WWwU92M",
  authDomain: "nexus-machinery.firebaseapp.com",
  projectId: "nexus-machinery",
  storageBucket: "nexus-machinery.appspot.com",
  messagingSenderId: "165083917791",
  appId: "1:165083917791:web:c6f8bca1ce81d3c272286a"
};
// ──────────────────────────────────────────────────────────────

let app: FirebaseApp;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export default app;
