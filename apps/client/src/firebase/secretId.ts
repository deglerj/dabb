import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
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
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, secretId);
}
