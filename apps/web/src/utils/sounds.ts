const SOUNDS = [
  'card-deal',
  'card-play',
  'card-select',
  'bid-place',
  'pass',
  'trick-win',
  'game-win',
] as const;

type SoundName = (typeof SOUNDS)[number];

const cache: Partial<Record<SoundName, HTMLAudioElement>> = {};

export function preloadSounds() {
  SOUNDS.forEach((name) => {
    const audio = new Audio(`/sounds/${name}.mp3`);
    audio.preload = 'auto';
    cache[name] = audio;
  });
}

export function playSound(name: SoundName) {
  try {
    const source = cache[name];
    if (source) {
      const clone = source.cloneNode() as HTMLAudioElement;
      clone.volume = 0.5;
      clone.play().catch(() => {
        /* fail silently */
      });
    }
  } catch {
    /* fail silently */
  }
}
