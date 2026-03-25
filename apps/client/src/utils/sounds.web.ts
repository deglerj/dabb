/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Web implementation of sounds — uses the native Audio API directly.
 * expo-audio's web layer calls HTMLAudioElement.play() but discards the
 * returned Promise, so autoplay-policy rejections become unhandled and
 * surface as uncaught errors. Using Audio.play().catch() fixes this.
 */
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

const SOUND_FILES: Record<SoundName, string> = {
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
  const audio = new Audio(SOUND_FILES[name] as string);
  audio.volume = 0.6;
  audio.play().catch(() => {
    // Ignore autoplay policy errors (NotAllowedError before user interaction)
  });
}
