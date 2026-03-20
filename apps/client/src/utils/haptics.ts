import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HAPTICS_ENABLED_KEY = 'dabb-haptics-enabled';

type HapticName =
  | 'card-select'
  | 'card-play'
  | 'card-deal'
  | 'bid-place'
  | 'pass'
  | 'trick-win'
  | 'turn-notification'
  | 'game-win';

let enabled = true;

export async function loadHapticsPreferences(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(HAPTICS_ENABLED_KEY);
    enabled = stored !== 'false';
  } catch {
    // Fail silently
  }
}

export async function setHapticsEnabled(value: boolean): Promise<void> {
  enabled = value;
  try {
    await AsyncStorage.setItem(HAPTICS_ENABLED_KEY, String(value));
  } catch {
    // Fail silently
  }
}

export function isHapticsEnabled() {
  return enabled;
}

export function triggerHaptic(name: HapticName) {
  if (!enabled) {
    return;
  }
  try {
    switch (name) {
      case 'card-select':
      case 'card-deal':
      case 'pass':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'card-play':
      case 'bid-place':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'trick-win':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'turn-notification':
      case 'game-win':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
    }
  } catch {
    // Fail silently
  }
}
