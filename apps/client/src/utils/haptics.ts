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
  enabled = localStorage.getItem(HAPTICS_ENABLED_KEY) !== 'false';
}

export async function setHapticsEnabled(value: boolean): Promise<void> {
  enabled = value;
  localStorage.setItem(HAPTICS_ENABLED_KEY, String(value));
}

export function isHapticsEnabled() {
  return enabled;
}

// The Vibration API doesn't exist on Safari (desktop or iOS) — 'vibrate' in
// navigator is false there, so this is always a no-op on iPhone/iPad.
export function triggerHaptic(name: HapticName) {
  if (!enabled || !('vibrate' in navigator)) {
    return;
  }
  switch (name) {
    case 'card-select':
    case 'card-deal':
    case 'pass':
      navigator.vibrate(10);
      break;
    case 'card-play':
    case 'bid-place':
      navigator.vibrate(20);
      break;
    case 'trick-win':
      navigator.vibrate(30);
      break;
    case 'turn-notification':
    case 'game-win':
      navigator.vibrate([10, 50, 10]);
      break;
  }
}
