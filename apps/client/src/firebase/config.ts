import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  databaseURL: import.meta.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? '',
  projectId: import.meta.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getDatabase(app);

if (import.meta.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  connectDatabaseEmulator(db, 'localhost', 9000);
}
