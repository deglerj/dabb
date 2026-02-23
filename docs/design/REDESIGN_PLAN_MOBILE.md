# Mobile App Redesign Plan

**Design concept**: See `docs/design/STAMMTISCH_CONCEPT.md` — read it fully before starting.

**Prerequisite**: The web app redesign (`docs/design/REDESIGN_PLAN_WEB.md`) must be **fully completed and merged** before starting the mobile redesign. The web app is the reference implementation — use it as the visual target.

**Goal**: Apply the same "Gaststätte Abend" visual language to the React Native / Expo mobile app. The two apps do not need to look identical — React Native has different layout primitives and different constraints — but they must share the same design DNA: warm oak wood, paper panels, handwriting fonts, folk-art card illustrations, and the same color palette.

**Target**: `apps/mobile/` only.

---

## Key Differences: Web vs Mobile

| Aspect      | Web (reference)                  | Mobile (this task)                                       |
| ----------- | -------------------------------- | -------------------------------------------------------- |
| Styling     | CSS / CSS variables              | React Native `StyleSheet`                                |
| Fonts       | Google Fonts (CSS import)        | `expo-google-fonts` packages                             |
| SVG         | Inline `<svg>` elements          | `react-native-svg` components                            |
| Backgrounds | CSS gradient layers              | RN `LinearGradient` (expo-linear-gradient)               |
| Textures    | CSS `background-image` data URIs | RN SVG overlays or `ImageBackground`                     |
| Animations  | CSS transitions + keyframes      | React Native `Animated` API or `react-native-reanimated` |
| Sounds      | HTMLAudioElement                 | `expo-av`                                                |
| Screen nav  | React Router                     | Expo Router / React Navigation                           |

---

## Reading List (read before starting)

- `docs/design/STAMMTISCH_CONCEPT.md` — full design spec
- `docs/design/REDESIGN_PLAN_WEB.md` — web reference (understand what was built)
- `apps/mobile/src/` — explore the full mobile source tree
- `apps/mobile/app.json` — Expo config (check existing plugins)
- `apps/mobile/package.json` — check what's already installed
- The web app's finished result — visually inspect it before porting

Key mobile source files to read:

- `apps/mobile/src/screens/` — all screens (Home, Lobby, Game)
- `apps/mobile/src/components/game/Card.tsx` — current mobile card component
- `apps/mobile/src/components/game/ScoreBoard.tsx`
- `apps/mobile/src/components/game/ScoreBoardHeader.tsx`
- `apps/mobile/src/components/game/GameLog.tsx`
- `apps/mobile/src/hooks/useSocket.ts`

---

## Phase M1: Dependencies & Theme Foundation

### Step M1.1 — Install font packages

Install the Expo Google Fonts packages for the three chosen fonts:

```bash
pnpm --filter @dabb/mobile add @expo-google-fonts/im-fell-english-sc @expo-google-fonts/caveat @expo-google-fonts/lato
```

Load fonts at app startup (in the root layout or `App.tsx`):

```typescript
import { useFonts, IMFellEnglishSC_400Regular } from '@expo-google-fonts/im-fell-english-sc';
import { Caveat_400Regular, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { Lato_400Regular, Lato_700Bold } from '@expo-google-fonts/lato';
```

Use `SplashScreen.preventAutoHideAsync()` and hide it when fonts are loaded (`fontsLoaded`).

### Step M1.2 — Install gradient library (if not present)

```bash
pnpm --filter @dabb/mobile add expo-linear-gradient
```

Also check if `react-native-svg` is installed; if not:

```bash
pnpm --filter @dabb/mobile add react-native-svg
```

### Step M1.3 — Create theme constants

Create `apps/mobile/src/theme.ts`:

```typescript
export const Colors = {
  // Wood
  woodLight: '#d4a264',
  woodMid: '#b8834a',
  woodDark: '#8a5e2e',
  woodGrain: '#9e6e38',

  // Paper
  paperFace: '#faf8f2',
  paperAged: '#f2e8d0',
  paperLines: '#c4cfe0',
  paperEdge: '#d8ccb0',

  // Ink
  inkDark: '#1a1208',
  inkMid: '#3d2e18',
  inkFaint: '#8a7a60',

  // Cards
  cardRed: '#c0392b',
  cardBlack: '#1a1208',

  // Accent
  amber: '#d4890a',
  amberLight: '#f0a830',

  // Feedback
  success: '#3a7d44',
  error: '#a32020',
} as const;

export const Fonts = {
  display: 'IMFellEnglishSC_400Regular',
  handwriting: 'Caveat_400Regular',
  handwritingBold: 'Caveat_700Bold',
  body: 'Lato_400Regular',
  bodyBold: 'Lato_700Bold',
} as const;

export const Shadows = {
  card: {
    shadowColor: '#3c1e0a',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  panel: {
    shadowColor: '#3c1e0a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;
```

### Step M1.4 — Wood background component

Create `apps/mobile/src/components/WoodBackground.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../theme';

export function WoodBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.woodLight, Colors.woodMid, Colors.woodDark, Colors.woodMid]}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Grain overlay — subtle vertical lines via thin View strips */}
      <View style={[StyleSheet.absoluteFill, styles.grainOverlay]} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.woodMid },
  grainOverlay: { opacity: 0.06 }, // Contains SVG grain pattern via react-native-svg
});
```

The grain overlay can use a `react-native-svg` `<Pattern>` of thin vertical lines, or simply be omitted — the LinearGradient alone gives adequate wood feel on mobile.

### Step M1.5 — Paper panel component

Create `apps/mobile/src/components/PaperPanel.tsx`:

```tsx
import { View, ViewStyle, StyleSheet } from 'react-native';
import { Colors, Shadows } from '../theme';

interface PaperPanelProps {
  children: React.ReactNode;
  style?: ViewStyle;
  aged?: boolean; // slightly more yellowed
}

export function PaperPanel({ children, style, aged = false }: PaperPanelProps) {
  return <View style={[styles.panel, aged && styles.aged, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.paperFace,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    padding: 16,
    ...Shadows.panel,
  },
  aged: {
    backgroundColor: Colors.paperAged,
  },
});
```

**Verify**: Fonts load at startup. Colors and theme constants are importable. WoodBackground renders without errors.

---

## Phase M2: Playing Card Redesign

**Files**: `apps/mobile/src/components/game/Card.tsx`, new `CardFaces/` directory.

### Step M2.1 — Port face card SVGs to React Native

The web app created `KoenigFace.tsx`, `OberFace.tsx`, `BuabeFace.tsx` as browser SVG components. Port them to React Native SVG.

Create `apps/mobile/src/components/game/CardFaces/` with the same three files, replacing `<svg>` / `<path>` etc. with equivalents from `react-native-svg`:

```typescript
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
```

The SVG paths themselves are identical to the web version — only the import and component names change.

### Step M2.2 — Update Card component

Update `apps/mobile/src/components/game/Card.tsx`:

- Card face background: `Colors.paperFace`, border `Colors.paperEdge`, border-radius 4
- Apply `Shadows.card`
- Face cards: render `KoenigFace`, `OberFace`, or `BuabeFace` component in center
- Ass: large `SuitIcon` centered + thin decorative border
- Zehn: keep current layout, update colors
- Card back: dark reddish-brown (`#5c2e0a`) + simple cross-hatch pattern via RN SVG
- Corner rank indicators: top-left + rotated bottom-right (same as web)

### Step M2.3 — Card states

- Selected: amber border + lift (use `transform: [{ translateY: -16 }]`)
- Winner: amber glow (add border + slight elevation increase)
- Invalid: `opacity: 0.5` (simpler than grayscale filter on RN)

**Verify**: All rank/suit combinations render. Face cards display correctly at mobile card size (60×90px). Card back shows hatch pattern.

---

## Phase M3: Home Screen

**File**: Home screen component (find via `apps/mobile/src/screens/` or Expo Router routes)

### Step M3.1 — Background

Wrap screen content in `<WoodBackground>`.

### Step M3.2 — Panel

Wrap the button group and title in `<PaperPanel aged>`. Keep max-width and centering.

### Step M3.3 — Title

- Font: `Fonts.display` (**IM Fell English SC**)
- Color: `Colors.inkDark`

### Step M3.4 — Buttons

Update all buttons to use amber primary style:

- Background: `Colors.amber`
- Text color: `Colors.inkDark`
- Font: `Fonts.bodyBold` (**Lato Bold**)
- Border-radius: 4
- Add press feedback with `Pressable` (scale down slightly on press)

### Step M3.5 — Language switcher

- Font: `Fonts.handwriting` (**Caveat**)
- Color: `Colors.inkFaint`
- Simple text links, no background

**Verify**: Home screen renders on iOS and Android. Wood background visible. Fonts correct.

---

## Phase M4: Lobby Screen

**File**: Lobby/waiting room screen

### Step M4.1 — Background + panel

Same pattern: `<WoodBackground>` + `<PaperPanel>`.

### Step M4.2 — Game code display

- Font: `Fonts.handwritingBold` (**Caveat Bold**), large (28px)
- Color: `Colors.inkDark`
- Bottom border only (pen-underline look)

### Step M4.3 — Player list

- Each row: `Fonts.handwriting` (**Caveat**), `Colors.inkDark`
- Bottom border: 1px `Colors.paperLines` (ruled line)
- Empty slots: `Colors.inkFaint`, italic style

### Step M4.4 — Buttons

Consistent with home screen.

---

## Phase M5: Game Screen

**Files**: Game screen, ScoreBoard, ScoreBoardHeader, GameLog

The game screen is the most complex. Approach:

### Step M5.1 — Background

Wrap game screen root in `<WoodBackground>`. The game content sits on the wood.

### Step M5.2 — ScoreBoardHeader (compact, always visible)

`apps/mobile/src/components/game/ScoreBoardHeader.tsx`:

- Background: `Colors.paperFace` with ruled-line accent
- Player names: `Fonts.handwriting` (**Caveat**) for values, `Fonts.body` (**Lato**) for labels
- Scores: `Fonts.handwritingBold` (**Caveat Bold**), `Colors.inkDark`
- Border bottom: 2px `Colors.paperEdge` (like a notebook page)

### Step M5.3 — Full ScoreBoard (expanded modal or sheet)

`apps/mobile/src/components/game/ScoreBoard.tsx`:

- Wrap in `<PaperPanel>` or `<WoodBackground>` + inner panel
- Ruled lines: use repeating bottom-borders on rows, or a background approach
- Round scores: `Fonts.handwritingBold` (**Caveat Bold**)
- Headers: `Fonts.body` (**Lato Bold**), underlined
- "Bid not met": red strikethrough or ✗ indicator

### Step M5.4 — GameLog

`apps/mobile/src/components/game/GameLog.tsx`:

- Background: `Colors.paperAged`
- Entries: `Fonts.handwriting` (**Caveat**), size 13, `Colors.inkDark`
- Expandable sub-entries: indented, `Colors.inkFaint`
- "Your turn" banner: `Colors.amber` background, `Fonts.display` (**IM Fell English SC**)

### Step M5.5 — Game phase UI (bidding, trump, etc.)

- Phase indicator: `<PaperPanel>` small slip, `Fonts.display` text
- Bidding buttons: paper secondary style (not amber)
- Pass button: error/red style
- Trump suit selector: `<PaperPanel>` buttons with large suit icons

### Step M5.6 — Trick area

- Cards placed with slight rotation (same ±3–6° deterministic approach as web)
- Wood surface visible behind cards (no background panel for trick area)

### Step M5.7 — Player hand

- Cards fan at bottom, same visual style as face-up card component
- Selected state: amber border + translate-up
- Hover/press: scale-down briefly with `Pressable`

### Step M5.8 — Celebration overlay

Update confetti/fireworks colors to use amber, card-red, wood tones from `Colors`.

---

## Phase M6: Sounds

**Prerequisite**: Sound files already placed in `apps/web/public/sounds/` (from web redesign). Copy them to `apps/mobile/assets/sounds/`.

### Step M6.1 — Install expo-av (if not present)

```bash
pnpm --filter @dabb/mobile add expo-av
```

### Step M6.2 — Create sound utility

Create `apps/mobile/src/utils/sounds.ts`, mirroring the web version but using `expo-av`:

```typescript
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SoundName =
  | 'card-deal'
  | 'card-play'
  | 'card-select'
  | 'bid-place'
  | 'pass'
  | 'trick-win'
  | 'game-win';

const SOUND_FILES: Record<SoundName, ReturnType<typeof require>> = {
  'card-deal': require('../../assets/sounds/card-deal.mp3'),
  'card-play': require('../../assets/sounds/card-play.mp3'),
  'card-select': require('../../assets/sounds/card-select.mp3'),
  'bid-place': require('../../assets/sounds/bid-place.mp3'),
  pass: require('../../assets/sounds/pass.mp3'),
  'trick-win': require('../../assets/sounds/trick-win.mp3'),
  'game-win': require('../../assets/sounds/game-win.mp3'),
};

const cache: Partial<Record<SoundName, Audio.Sound>> = {};
let muted = false;

export async function loadSounds() {
  await Audio.setAudioModeAsync({ playsInSilentModeIOS: false });
  const stored = await AsyncStorage.getItem('dabb-muted');
  muted = stored === 'true';
}

export async function setMuted(value: boolean) {
  muted = value;
  await AsyncStorage.setItem('dabb-muted', String(value));
}

export function isMuted() {
  return muted;
}

export async function playSound(name: SoundName) {
  if (muted) return;
  try {
    const { sound } = await Audio.Sound.createAsync(SOUND_FILES[name], { volume: 0.6 });
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
    });
  } catch {
    // Fail silently
  }
}
```

Note: Unlike web, sounds are bundled assets on mobile (require() paths), so no manual file download step is needed once the web sounds are copied into `assets/sounds/`.

### Step M6.3 — Wire sounds to events

Same event → sound mapping as web. Trigger in the game screen's effect that watches game events.

### Step M6.4 — Mute toggle

Add speaker icon button to game screen. Persist via `AsyncStorage` (already handled in utility). Read initial state on mount.

---

## Phase M7: Final Polish & CI

### Step M7.1 — Animation review

React Native animations are implemented differently from CSS. Use `Animated.timing` or `react-native-reanimated` (check what's already in the project):

- Card lift (selected): `Animated.Value` for `translateY`
- Press feedback: `Animated.spring` for scale
- "Your turn" banner: `Animated.loop` with `Animated.sequence` for pulse
- Modal appear: `Animated.timing` for `opacity` + `scale`

Use `useNativeDriver: true` where possible for performance.

### Step M7.2 — Layout consistency check

On both iOS and Android:

- [ ] Wood background fills screen edge-to-edge (incl. status bar area)
- [ ] Safe area insets handled (use `useSafeAreaInsets` or `SafeAreaView`)
- [ ] No layout shift when game log expands/collapses (use `opacity: 0` / constant height where needed — see CLAUDE.md convention)
- [ ] Scoreboard collapses/expands without layout shift

### Step M7.3 — Font rendering

- [ ] All three fonts render on iOS
- [ ] All three fonts render on Android
- [ ] Fallback font specified if expo-google-fonts fails to load

### Step M7.4 — Run CI

```bash
/ci-check
```

All of build, typecheck, lint, and tests must pass.

---

## Summary of Files Changed

| File                                                       | Change                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| `apps/mobile/package.json`                                 | Add font packages, expo-linear-gradient, expo-av       |
| `apps/mobile/src/theme.ts`                                 | New file — color, font, shadow constants               |
| `apps/mobile/src/components/WoodBackground.tsx`            | New file                                               |
| `apps/mobile/src/components/PaperPanel.tsx`                | New file                                               |
| `apps/mobile/src/components/game/Card.tsx`                 | Full visual redesign                                   |
| `apps/mobile/src/components/game/CardFaces/KoenigFace.tsx` | New file — RN SVG port                                 |
| `apps/mobile/src/components/game/CardFaces/OberFace.tsx`   | New file                                               |
| `apps/mobile/src/components/game/CardFaces/BuabeFace.tsx`  | New file                                               |
| `apps/mobile/src/components/game/ScoreBoard.tsx`           | Visual update                                          |
| `apps/mobile/src/components/game/ScoreBoardHeader.tsx`     | Visual update                                          |
| `apps/mobile/src/components/game/GameLog.tsx`              | Visual update                                          |
| `apps/mobile/src/utils/sounds.ts`                          | New file                                               |
| `apps/mobile/assets/sounds/`                               | Copy sound files from web                              |
| Home, Lobby, Game screens                                  | Wrap in WoodBackground + PaperPanel, update all styles |

## Files NOT Changed

Everything in `apps/server/`, `packages/`, `apps/web/`, all game logic, all socket handlers, all i18n files, all test files.
