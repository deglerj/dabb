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

if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  // localhost, not 10.0.2.2 — paired with `adb reverse tcp:9000 tcp:9000` in
  // CI, which tunnels the emulator's own localhost:9000 to the host via ADB
  // directly. The emulator's virtual NAT gateway (10.0.2.2) turned out to be
  // unreliable in GitHub Actions specifically: host-side checks always
  // confirmed the emulator was alive, listening, and firewall-reachable, yet
  // the guest could never complete a TCP connection through it.
  connectDatabaseEmulator(db, 'localhost', 9000);
}
