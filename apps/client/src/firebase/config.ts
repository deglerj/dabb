import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getDatabase(app);

// TEMP DIAGNOSTIC — remove once smoke-test create/join hang is root-caused
console.warn(
  '[diag] EXPO_PUBLIC_USE_FIREBASE_EMULATOR =',
  process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR
);
if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  console.warn('[diag] calling connectDatabaseEmulator(db, 10.0.2.2, 9000)');
  connectDatabaseEmulator(db, '10.0.2.2', 9000);
  console.warn('[diag] connectDatabaseEmulator call returned');
}
