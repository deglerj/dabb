import cardDeal from '../../assets/sounds/card-deal.mp3';
import cardPlay from '../../assets/sounds/card-play.mp3';
import cardSelect from '../../assets/sounds/card-select.mp3';
import bidPlace from '../../assets/sounds/bid-place.mp3';
import pass from '../../assets/sounds/pass.mp3';
import trickWin from '../../assets/sounds/trick-win.mp3';
import gameWin from '../../assets/sounds/game-win.mp3';

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
  'card-deal': cardDeal,
  'card-play': cardPlay,
  'card-select': cardSelect,
  'bid-place': bidPlace,
  pass,
  'trick-win': trickWin,
  'game-win': gameWin,
};

let muted = false;

export function loadSoundPreferences() {
  muted = localStorage.getItem(MUTED_KEY) === 'true';
}

export function setMuted(value: boolean) {
  muted = value;
  localStorage.setItem(MUTED_KEY, String(value));
}

export function isMuted() {
  return muted;
}

// Sound effects go through the Web Audio API rather than `new Audio()`: Chrome on
// Android gives a media element exclusive audio focus, which pauses whatever the
// user has playing in the background. Web Audio only ever ducks.
let context: AudioContext | null = null;
const buffers = new Map<SoundName, AudioBuffer>();

function getContext(): AudioContext {
  if (!context) {
    context = new AudioContext();
    // Safari: mix with other apps' audio instead of interrupting it.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) {
      session.type = 'ambient';
    }
  }
  return context;
}

function play(ctx: AudioContext, buffer: AudioBuffer) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = 0.6;
  source.connect(gain).connect(ctx.destination);
  source.start();
}

export function playSound(name: SoundName) {
  if (muted) {
    return;
  }
  const ctx = getContext();
  void ctx.resume().catch(() => {
    // Ignore autoplay policy errors (before user interaction)
  });

  const cached = buffers.get(name);
  if (cached) {
    play(ctx, cached);
    return;
  }

  void fetch(SOUND_FILES[name])
    .then((response) => response.arrayBuffer())
    .then((data) => ctx.decodeAudioData(data))
    .then((buffer) => {
      buffers.set(name, buffer);
      play(ctx, buffer);
    })
    .catch(() => {
      // Ignore fetch/decode failures — sound effects are cosmetic
    });
}
