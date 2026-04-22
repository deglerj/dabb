import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import Constants from 'expo-constants';

const firebaseConfig = {
  apiKey: (Constants.expoConfig?.extra?.firebaseApiKey as string | undefined) ?? '',
  authDomain: (Constants.expoConfig?.extra?.firebaseAuthDomain as string | undefined) ?? '',
  databaseURL: (Constants.expoConfig?.extra?.firebaseDatabaseUrl as string | undefined) ?? '',
  projectId: (Constants.expoConfig?.extra?.firebaseProjectId as string | undefined) ?? '',
  storageBucket: (Constants.expoConfig?.extra?.firebaseStorageBucket as string | undefined) ?? '',
  messagingSenderId:
    (Constants.expoConfig?.extra?.firebaseMessagingSenderId as string | undefined) ?? '',
  appId: (Constants.expoConfig?.extra?.firebaseAppId as string | undefined) ?? '',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getDatabase(app);
