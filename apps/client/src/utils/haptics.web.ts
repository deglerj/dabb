type HapticName =
  | 'card-select'
  | 'card-play'
  | 'card-deal'
  | 'bid-place'
  | 'pass'
  | 'trick-win'
  | 'turn-notification'
  | 'game-win';

export async function loadHapticsPreferences(): Promise<void> {}

export async function setHapticsEnabled(_value: boolean): Promise<void> {}

export function isHapticsEnabled() {
  return false;
}

export function triggerHaptic(_name: HapticName) {}
