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

export async function loadSoundPreferences() {
  muted = localStorage.getItem(MUTED_KEY) === 'true';
}

export async function setMuted(value: boolean) {
  muted = value;
  localStorage.setItem(MUTED_KEY, String(value));
}

export function isMuted() {
  return muted;
}

export function playSound(name: SoundName) {
  if (muted) {
    return;
  }
  const audio = new Audio(SOUND_FILES[name]);
  audio.volume = 0.6;
  audio.play().catch(() => {
    // Ignore autoplay policy errors (NotAllowedError before user interaction)
  });
}
