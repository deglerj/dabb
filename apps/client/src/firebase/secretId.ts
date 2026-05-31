import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export async function getOrCreateSecretId(sessionCode: string): Promise<string> {
  const key = `dabb-secret-${sessionCode}`;
  const existing = await AsyncStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const newId = uuidv4();
  await AsyncStorage.setItem(key, newId);
  return newId;
}

export async function hashSecretId(secretId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secretId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
