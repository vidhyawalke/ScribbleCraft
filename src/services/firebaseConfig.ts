/**
 * Firebase Realtime Database configuration.
 *
 * Set the following environment variables in:
 *   - Local:  .env file (copy from .env.example)
 *   - Vercel: Dashboard → Project → Settings → Environment Variables
 *
 * Get these values from:
 *   Firebase Console → Project Settings → General → Your apps → Web app config
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || '',
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL       || '',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || '',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '',
};

/**
 * True only when all required Firebase keys are present.
 * When false, the app still works — collaboration is same-browser-tab only.
 */
export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.databaseURL &&
  firebaseConfig.projectId
);

let _db: Database | null = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    _db = getDatabase(app);
  } catch (err) {
    console.error('[ScribbleCraft] Firebase init failed:', err);
  }
}

export const db = _db;
