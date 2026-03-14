/* eslint-disable @typescript-eslint/no-require-imports */
import { createAudioPlayer } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MUTED_KEY = 'dabb-muted';

type SoundName =
  | 'card-deal'
  | 'card-play'
  | 'card-select'
  | 'bid-place'
  | 'pass'
  | 'trick-win'
  | 'game-win';

const SOUND_FILES: Record<SoundName, number> = {
  'card-deal': require('../../assets/sounds/card-deal.mp3'),
  'card-play': require('../../assets/sounds/card-play.mp3'),
  'card-select': require('../../assets/sounds/card-select.mp3'),
  'bid-place': require('../../assets/sounds/bid-place.mp3'),
  pass: require('../../assets/sounds/pass.mp3'),
  'trick-win': require('../../assets/sounds/trick-win.mp3'),
  'game-win': require('../../assets/sounds/game-win.mp3'),
};

let muted = false;

export async function loadSoundPreferences() {
  try {
    const stored = await AsyncStorage.getItem(MUTED_KEY);
    muted = stored === 'true';
  } catch {
    // Fail silently
  }
}

export async function setMuted(value: boolean) {
  muted = value;
  try {
    await AsyncStorage.setItem(MUTED_KEY, String(value));
  } catch {
    // Fail silently
  }
}

export function isMuted() {
  return muted;
}

export function playSound(name: SoundName) {
  if (muted) {
    return;
  }
  try {
    const player = createAudioPlayer(SOUND_FILES[name]);
    player.volume = 0.6;
    player.play();
    // Remove player after a reasonable duration for short sound effects
    setTimeout(() => {
      try {
        player.remove();
      } catch {
        // Ignore cleanup errors
      }
    }, 3000);
  } catch {
    // Fail silently
  }
}
