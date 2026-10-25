import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

const useFirebaseEmulator = import.meta.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

const firebaseConfig = {
  apiKey:
    import.meta.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? (useFirebaseEmulator ? 'demo-api-key' : ''),
  authDomain: import.meta.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  databaseURL: import.meta.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? '',
  projectId: import.meta.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getDatabase(app);
export const auth = getAuth(app);

if (useFirebaseEmulator) {
  connectDatabaseEmulator(db, 'localhost', 9000);
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
}
