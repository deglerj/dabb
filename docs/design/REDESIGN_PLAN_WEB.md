# Web App Redesign Plan

**Design concept**: See `docs/design/STAMMTISCH_CONCEPT.md` — read it fully before starting.

**Goal**: Facelift the existing web app to the "Gaststätte Abend" Stammtisch aesthetic. The page structure, routing, game logic, and all functionality stay exactly as-is. This is purely a visual overhaul.

**Target**: `apps/web/` — touch nothing in `apps/server/`, `packages/`, or `apps/mobile/`.

**Prerequisite**: Make sure CI passes before starting (`/ci-check`). It must also pass when you're done.

---

## Reading List (read these files before starting)

- `docs/design/STAMMTISCH_CONCEPT.md` — full design spec (colors, fonts, components, cards, animations, sounds)
- `apps/web/src/styles.css` — the single global CSS file (834 lines); this is where most visual work happens
- `apps/web/src/components/game/Card.tsx` — card component to be redesigned
- `apps/web/src/components/SuitIcon.tsx` — existing suit icon SVGs (kept as-is, used in corners of face cards)
- `apps/web/src/pages/HomePage.tsx`
- `apps/web/src/pages/WaitingRoomPage.tsx`
- `apps/web/src/pages/GamePage.tsx`
- `apps/web/src/components/game/ScoreBoard.tsx`
- `apps/web/src/components/game/GameLog.tsx`
- `apps/web/src/components/game/TrickArea.tsx`
- `apps/web/src/components/game/BiddingPanel.tsx`
- `apps/web/src/components/ConfirmModal.tsx`

---

## Phase W1: CSS Foundations

**Files**: `apps/web/index.html`, `apps/web/src/styles.css`

### Step 1.1 — Google Fonts

Add to `apps/web/index.html` `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&family=Caveat:wght@400;700&family=Lato:wght@400;700&display=swap"
  rel="stylesheet"
/>
```

### Step 1.2 — Replace CSS custom properties

Replace the entire `:root` block in `styles.css` with the new palette from the concept doc. The old properties to remove: `--bg-dark`, `--bg-card`, `--bg-input`, `--text-primary`, `--text-secondary`, `--accent`, `--accent-hover`, `--success`, `--border`, `--card-shadow`. The new properties to add: all `--wood-*`, `--paper-*`, `--ink-*`, `--card-red`, `--card-black`, `--amber`, `--amber-light`, `--amber-glow`, `--success`, `--error`, `--shadow-*`, `--font-*`.

Keep all card dimension variables (`--card-width`, `--card-height`, `--card-overlap`, `--card-icon-size`, `--card-rank-font`, `--card-hover-lift`, `--card-selected-lift`) unchanged.

### Step 1.3 — Body / wood background

Update `body` styles:

- Replace `background: var(--bg-dark)` with the layered wood gradient from the concept doc
- Set `font-family: 'Lato', sans-serif`
- Set `color: var(--ink-dark)` (text on paper elements inherits this)
- `min-height: 100vh` (unchanged)

### Step 1.4 — Panel class (replaces `.card`)

The existing `.card` class is used as a content panel (not a playing card). Rename its concept to `.panel` in the CSS, but **do not rename the CSS class itself** (too many JSX usages). Update the `.card` CSS class styles instead:

- Background: `var(--paper-aged)` + noise texture (SVG data URI from concept doc)
- Box-shadow: `var(--shadow-panel)`
- Border-radius: `3px` (reduced from 12px)
- Border: `1px solid var(--paper-edge)`
- Remove: `background: var(--bg-card)`

### Step 1.5 — Buttons

Update all button styles to match the concept doc (amber primary, paper secondary, press effect). Add `:active` state with `translateY(2px)` and shadow shrink.

Also update specific button variant classes already in the CSS (`.btn-secondary`, `.btn-danger`, `.btn-small`, `.btn-icon` if they exist).

### Step 1.6 — Inputs

Update `input`, `select`, `textarea`:

- Background: `var(--paper-face)`
- Border: `1px solid var(--paper-edge)`
- Color: `var(--ink-dark)`
- Border-radius: 3px
- Focus: amber outline

### Step 1.7 — Scrollbars, selection, misc global

- `::selection`: amber highlight
- Scrollbar (WebKit): thin, wood-toned

### Step 1.8 — Modal styles

Update `.modal-overlay` and `.modal-content`:

- Overlay: `rgba(30, 15, 5, 0.65)` (warmer black)
- Content: `.card` base styles (paper panel) apply; add very slight rotation `rotate(0.5deg)` for "tossed note" feel
- Animation: `opacity` + `scale` (0.92→1), not translate

**Verify**: All four pages render without errors. The UI is paper/wood toned. Fonts are loading.

---

## Phase W2: Playing Card Redesign

**Files**: `apps/web/src/components/game/Card.tsx`, `apps/web/src/styles.css` (`.playing-card` section), new files for face SVGs.

### Step 2.1 — Card face styles

Update `.playing-card` in CSS:

- Background: `var(--paper-face)`
- Border: `1px solid #d0c8b0`
- Border-radius: `4px`
- Box-shadow: `var(--shadow-card)`
- Color: suit-specific (controlled via inline style in TSX)
- Remove old blue gradient for hidden cards (handled in TSX)

Add rank + suit corner elements to the card layout:

- Top-left: rank letter (small, **IM Fell English SC**) + tiny suit icon
- Bottom-right: same, rotated 180° (CSS `transform: rotate(180deg)`)
- Center: illustration area (for face cards) or large suit icon (for Ass)

### Step 2.2 — Card back

Update the hidden card style in `Card.tsx` to use the diamond-hatch pattern from the concept doc instead of the current blue gradient and emoji.

### Step 2.3 — Face card SVG illustrations

Create directory: `apps/web/src/components/game/CardFaces/`

Create these files, each exporting an inline SVG component:

- `KoenigFace.tsx` — props: `{ suit: Suit }`
- `OberFace.tsx` — props: `{ suit: Suit }`
- `BuabeFace.tsx` — props: `{ suit: Suit }`

**Style guide** (from concept doc):

- ViewBox: `0 0 80 120` (scales to actual card size via CSS)
- Folk-art / linocut style: bold 2px outlines, flat fills, no gradients
- Outline/linework color: suit color (black for Kreuz/Schippe, red for Herz/Bollen)
- Crown/hat accent: `#d4890a` (amber)
- Fill: `var(--paper-face)` background shows through (use `fill="none"` or very light fill)

**König** — crown (3-point silhouette, amber fill), oval head, simple dot eyes + line mouth, trapezoidal robe, vertical scepter. Frontal, symmetric.

**Ober** — wide-brimmed hat + curved feather (amber), standing figure slightly turned, 4-petal flower in one hand, amber belt-sash.

**Buabe** — round cap (shorter), smaller/rounder head and body, slight casual lean, hands at sides or small diamond shield.

### Step 2.4 — Update Card.tsx

- Import the three face components
- For `rank === 'koenig'`: render `<KoenigFace suit={card.suit} />` in the card center
- For `rank === 'ober'`: render `<OberFace suit={card.suit} />`
- For `rank === 'buabe'`: render `<BuabeFace suit={card.suit} />`
- For `rank === 'ass'`: render large centered `<SuitIcon>` + thin decorative border
- For `rank === '10'`: keep current layout (rank + icon) but with updated styles
- All cards: add corner rank/suit indicators (top-left and rotated bottom-right)

### Step 2.5 — Card state styles

Update CSS for card states:

- `.playing-card.selected`: amber glow border + lift (keep `--card-selected-lift`)
- `.playing-card.winner`: amber/gold glow `box-shadow: 0 0 12px 4px var(--amber-glow)`
- `.playing-card.dabb`: subtle amber border
- Invalid (via inline `filter`): `grayscale(80%) brightness(0.75)` (softer than current)

### Step 2.6 — Trick area card rotations

In `TrickArea.tsx`, add a slight random rotation to each card in the trick (±3–6°). Use a deterministic approach (e.g., based on card index) so it's consistent:

```tsx
const rotations = [-4, 3, -2, 5];  // one per player slot
style={{ transform: `rotate(${rotations[index % 4]}deg)` }}
```

**Verify**: All 5 ranks × 4 suits render correctly. Hidden cards show the back pattern. Card states (selected, winner, invalid) work. Face illustrations look reasonable at 80×120px.

---

## Phase W3: Home Page

**Files**: `apps/web/src/pages/HomePage.tsx`, `apps/web/src/styles.css`

### Step 3.1 — Layout

The home page `.card` container already centers on the wood background. With Phase W1 done, it will automatically look like a paper panel on wood. Fine-tune:

- Padding: `2rem 2rem 2.5rem` (slightly more bottom breathing room)
- Max-width: 380px

### Step 3.2 — Title

Update the game title element:

- Font: **IM Fell English SC** (`font-family: 'IM Fell English SC', serif`)
- Size: `var(--font-display)` (2rem)
- Color: `var(--ink-dark)`
- Add subtle `letter-spacing: 0.02em`

### Step 3.3 — Logo/stamp

The existing stamp image (120×120px) should sit above the title. Add a subtle drop-shadow to make it look like a rubber stamp pressed on paper: `filter: drop-shadow(1px 2px 3px rgba(60, 30, 0, 0.3))`.

### Step 3.4 — Buttons

Already updated globally in Phase W1. Home page buttons should look correct. Verify spacing.

### Step 3.5 — Language switcher

Make it feel more like a small handwritten note corner:

- Font: **Caveat**, small
- Color: `var(--ink-faint)`
- No background / border, just text links

**Verify**: Home page looks like a paper note pinned to a warm wood surface. Title font is loaded and rendering.

---

## Phase W4: Waiting Room

**Files**: `apps/web/src/pages/WaitingRoomPage.tsx`, `apps/web/src/styles.css`

### Step 4.1 — Overall feel

The `.card` container is already paper-panel from Phase W1. No major layout changes.

### Step 4.2 — Game code display

Style the code display block:

- Font: **Caveat** 700, large (1.75rem)
- Color: `var(--ink-dark)`
- Background: none (shows through paper panel)
- Border-bottom: `2px solid var(--paper-lines)` (underlined like written on paper)
- "Table number" label above in **IM Fell English SC**, small

### Step 4.3 — Player list entries

Each player row:

- Font: **Caveat** for the name, `var(--ink-dark)`
- Separator: `border-bottom: 1px solid var(--paper-lines)` (ruled line)
- Remove/kick button: small ink-faint color icon, no background
- Empty slots: font `var(--ink-faint)`, italic, dashed style text "— frei —"

### Step 4.4 — AI player entries

Same as player entries but with a subtle "(AI)" label in **Caveat** italic `var(--ink-faint)`.

**Verify**: Waiting room looks like a handwritten guest list on paper.

---

## Phase W5: Game Board

**Files**: `apps/web/src/pages/GamePage.tsx`, `apps/web/src/styles.css`

### Step 5.1 — Game board background

The `.game-board` grid inherits the wood background from `body`. No change needed.

### Step 5.2 — Phase indicator

Style the phase indicator element:

- Background: `var(--paper-aged)`, small horizontal slip appearance
- Font: **IM Fell English SC**
- Box-shadow: subtle downward shadow (appears pinned to table)
- If it shows the trump suit icon, keep the `<SuitIcon>` but ensure it uses suit colors

### Step 5.3 — Bidding panel

In `BiddingPanel.tsx`:

- Bid amount buttons: paper secondary style (not amber) for +0, +10, +20, +50
- Pass button: muted-red destructive style
- Current bid display: **Caveat** large, on a paper slip

### Step 5.4 — Trump selector

In `TrumpSelector.tsx`:

- Suit buttons: paper panel style with large suit icon centered
- Hover: amber glow border
- Label: **IM Fell English SC**

### Step 5.5 — Player name plates (scoreboard header / in-game)

Player names shown during gameplay (top area, current player indicator):

- Font: **Caveat** 700 for active player, 400 for others
- Active/current: amber color `var(--amber)`
- The "your turn" banner: amber background, **IM Fell English SC**, pulsing animation

### Step 5.6 — Celebration overlay

The confetti / fireworks colors should use the new palette:

- Confetti: mix of amber, card-red, wood tones
- Keep the existing animation; just update colors

**Verify**: Game board feels like playing on a table. Phase UI elements read correctly. Bidding and trump selection work.

---

## Phase W6: Scoreboard

**Files**: `apps/web/src/components/game/ScoreBoard.tsx`, `apps/web/src/styles.css`

### Step 6.1 — Container

The scoreboard area: apply `.notebook` CSS class (ruled lines, paper-face background). Add a left-margin line effect.

### Step 6.2 — Header row

- Player name headers: **Lato** bold, underlined with a `border-bottom: 2px solid var(--ink-mid)` (hand-underlined look)
- Column separator: `border-right: 1px solid var(--paper-lines)`

### Step 6.3 — Score rows

- Round scores: **Caveat** 700, `var(--ink-dark)`, sized at `var(--font-hand)`
- "Bid not met" indicator: small `✗` in `var(--error)`, or strikethrough style
- Current round: amber background tint on the row `rgba(212, 137, 10, 0.08)`

### Step 6.4 — Total row

- Totals: **Caveat** 700, slightly larger, bold underline above

### Step 6.5 — Mobile collapsed header

The compact scoreboard header on mobile should show just names and totals in **Caveat**, collapsible.

**Verify**: Scoreboard looks like a battered score notebook. Numbers are legible. Expand/collapse works on mobile.

---

## Phase W7: Game Log

**Files**: `apps/web/src/components/game/GameLog.tsx`, `apps/web/src/styles.css`

### Step 7.1 — Log container

- Apply paper background (`var(--paper-aged)`) + optional ruled lines
- Remove the dark sidebar background
- Border-left: `3px solid var(--paper-edge)` (like a notebook binding edge)

### Step 7.2 — Log entries

- Font: **Caveat** 400, `var(--font-xs)` (0.75rem)
- Color: `var(--ink-dark)`
- Entry separator: very faint ruled line
- Expandable sub-entries (meld breakdown, dabb cards): indented, `var(--ink-faint)`

### Step 7.3 — "Your turn" banner

Already styled in Phase W5. Just ensure it sits naturally above the log.

**Verify**: Game log reads like handwritten notes. Expandable entries work. Scrolling works.

---

## Phase W8: Sounds

**Files**: new `apps/web/src/utils/sounds.ts`, `apps/web/public/sounds/` (empty dir initially), integration in `GamePage.tsx` and relevant components.

### Step 8.1 — Create sound utility

```typescript
// apps/web/src/utils/sounds.ts

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
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
}
export function isMuted() {
  return muted;
}

export function preloadSounds() {
  SOUNDS.forEach((name) => {
    const audio = new Audio(`/sounds/${name}.mp3`);
    audio.preload = 'auto';
    cache[name] = audio;
  });
}

export function playSound(name: SoundName) {
  if (muted) return;
  const audio = cache[name];
  if (!audio) return;
  // Clone to allow overlapping plays
  const clone = audio.cloneNode() as HTMLAudioElement;
  clone.volume = 0.6;
  clone.play().catch(() => {}); // Fail silently
}
```

### Step 8.2 — Add mute toggle

Add a small mute/unmute button to the game UI (top area or game log header):

- Icon: speaker / speaker-muted (use lucide-react icons already in the project)
- State: persisted to `localStorage` key `'dabb-muted'`
- Reads initial state on mount

### Step 8.3 — Wire sounds to events

In `GamePage.tsx`, use a `useEffect` watching game events to trigger sounds. Use the game state's `events` array and trigger on new events:

| Game event type | Sound                   |
| --------------- | ----------------------- |
| `CARDS_DEALT`   | `card-deal` (play once) |
| `CARD_PLAYED`   | `card-play`             |
| `BID_PLACED`    | `bid-place`             |
| `PLAYER_PASSED` | `pass`                  |
| `TRICK_WON`     | `trick-win`             |
| `GAME_FINISHED` | `game-win`              |

Card select sound (`card-select`) is triggered directly in `PlayerHand.tsx` on card click (before `onClick` propagates).

### Step 8.4 — Sound files (manual step)

The implementer must source CC0/Public Domain sound files from freesound.org or similar. See the sound table in `STAMMTISCH_CONCEPT.md` for search terms. Place `.mp3` files in `apps/web/public/sounds/`. The game works fine without them (sounds fail silently).

**Verify**: Mute toggle persists. No errors in console if sound files are absent. Sounds play (once files are added) for correct events.

---

## Phase W9: Final Polish & CI

### Step 9.1 — Animation review

Go through each animation defined in the concept doc and verify it's implemented:

- [ ] Card hover lift + shadow enlargement
- [ ] Card selected lift + amber glow
- [ ] Card played to trick (translate + rotate)
- [ ] Button press (translateY + shadow shrink)
- [ ] Modal appear (opacity + scale)
- [ ] "Your turn" pulse
- [ ] Phase indicator fade-in

Add the card-to-trick animation if not yet done (requires tracking card position in state — can be simplified to a CSS transition on the trick area appearing).

### Step 9.2 — Cross-browser check

Test in Firefox and Chrome. Verify:

- Google Fonts load
- CSS gradients render (wood, paper)
- SVG face illustrations display correctly

### Step 9.3 — Mobile responsive check

On a narrow viewport (375px wide):

- Wood background shows
- Paper panels fit without overflow
- Cards scale to mobile dimensions
- Scoreboard collapses
- Game log overlay shows as bottom sheet

### Step 9.4 — Run CI

```bash
/ci-check
```

All of build, lint, and tests must pass before finishing.

---

## Summary of Files Changed

| File                                                    | Change                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| `apps/web/index.html`                                   | Add Google Fonts link                                                       |
| `apps/web/src/styles.css`                               | Full CSS overhaul (colors, textures, fonts, all components)                 |
| `apps/web/src/components/game/Card.tsx`                 | New card layout with face illustrations + back pattern                      |
| `apps/web/src/components/game/CardFaces/KoenigFace.tsx` | New file — SVG illustration                                                 |
| `apps/web/src/components/game/CardFaces/OberFace.tsx`   | New file — SVG illustration                                                 |
| `apps/web/src/components/game/CardFaces/BuabeFace.tsx`  | New file — SVG illustration                                                 |
| `apps/web/src/components/game/TrickArea.tsx`            | Add card rotation per index                                                 |
| `apps/web/src/utils/sounds.ts`                          | New file — sound utility                                                    |
| `apps/web/src/pages/GamePage.tsx`                       | Wire sound events, add mute toggle                                          |
| `apps/web/src/components/game/PlayerHand.tsx`           | card-select sound on click                                                  |
| Minor JSX style tweaks                                  | HomePage, WaitingRoomPage, ScoreBoard, GameLog, BiddingPanel, TrumpSelector |

## Files NOT Changed

Everything in `apps/server/`, `packages/`, `apps/mobile/`, all game logic, all socket handlers, all i18n files, all test files.
