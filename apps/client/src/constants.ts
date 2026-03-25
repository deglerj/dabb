import Constants from 'expo-constants';

/**
 * Runtime constants sourced from app.json extra / EAS environment.
 * Falls back to localhost for local development.
 */
export const SERVER_URL: string =
  (Constants.expoConfig?.extra?.serverUrl as string | undefined) || 'http://localhost:3000';

export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';
