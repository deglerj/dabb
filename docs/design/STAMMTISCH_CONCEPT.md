# Design Concept: "Gaststätte Abend"

## Core Philosophy

The player is sitting at a regular Stammtisch — a light oak table in a village Gasthof on a Tuesday evening. Cards come out of a battered box. Scores are scrawled in a spiral notebook with a ballpoint pen. Beer steins leave rings on the table. There is no felt, no casino aesthetic, no luxury. Just familiar, warm, slightly worn.

Everything in the UI should feel like it has a physical analogue on that table. Cards are played on bare wood. The scoreboard is a notebook page. Modals are paper notes. The UI should feel like it was assembled from objects you'd actually find there.

---

## Color Palette

All values are CSS custom properties defined in `:root`.

### Wood (table surface)

```css
--wood-light: #d4a264 /* highlight / raised grain */ --wood-mid: #b8834a /* base table color */
  --wood-dark: #8a5e2e /* shadow / recessed grain */ --wood-grain: #9e6e38
  /* secondary grain lines */;
```

### Paper (cards, panels, modals, scoreboard)

```css
--paper-face: #faf8f2 /* card face, clean notebook page */ --paper-aged: #f2e8d0
  /* slightly yellowed panel / log background */ --paper-lines: #c4cfe0
  /* faint blue ruled lines (scoreboard) */ --paper-edge: #d8ccb0 /* paper edge / shadow */;
```

### Ink (text on paper)

```css
--ink-dark: #1a1208 /* primary text — dark ballpoint ink */ --ink-mid: #3d2e18 /* secondary text */
  --ink-faint: #8a7a60 /* tertiary / placeholder text */;
```

### Cards (suit colors)

```css
--card-red: #c0392b /* Herz, Bollen */ --card-black: #1a1208 /* Kreuz, Schippe */;
```

### Accent (active states, highlights)

```css
--amber: #d4890a /* warm amber — active, selected, current player */ --amber-light: #f0a830
  /* hover state */ --amber-glow: rgba(212, 137, 10, 0.25) /* selection glow */;
```

### Feedback

```css
--success: #3a7d44 /* success — muted green */ --error: #a32020 /* error — muted dark red */;
```

### Shadows

```css
--shadow-card: 2px 4px 8px rgba(60, 30, 10, 0.35) --shadow-panel: 0 2px 12px rgba(60, 30, 10, 0.25)
  --shadow-modal: 0 8px 32px rgba(30, 15, 5, 0.5);
```

---

## Typography

All fonts loaded from Google Fonts.

| Role        | Font               | Weights  | Usage                                        |
| ----------- | ------------------ | -------- | -------------------------------------------- |
| Display     | IM Fell English SC | 400      | Game title, phase banners, modal headings    |
| Handwriting | Caveat             | 400, 700 | Scoreboard values, game log, notebook labels |
| UI          | Lato               | 400, 700 | Buttons, form labels, body text, navigation  |

### Google Fonts import

```html
<link
  href="https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&family=Caveat:wght@400;700&family=Lato:wght@400;700&display=swap"
  rel="stylesheet"
/>
```

### Font size scale

```css
--font-display: 2rem /* game title */ --font-heading: 1.375rem /* section headings */
  --font-body: 1rem /* body text */ --font-small: 0.875rem /* secondary labels */ --font-xs: 0.75rem
  /* game log entries */ --font-hand: 1.125rem /* scoreboard handwriting */;
```

---

## Background & Textures

All textures are CSS-only — no image files required.

### Wood table surface (body background)

Achieved with layered CSS gradients simulating light oak grain:

```css
background-color: var(--wood-mid);
background-image:
  /* fine grain lines */
  repeating-linear-gradient(
    93deg,
    transparent,
    transparent 3px,
    rgba(255, 255, 255, 0.03) 3px,
    rgba(255, 255, 255, 0.03) 4px
  ),
  /* coarser grain bands */
  repeating-linear-gradient(
      90deg,
      transparent,
      transparent 18px,
      rgba(0, 0, 0, 0.04) 18px,
      rgba(0, 0, 0, 0.04) 36px
    ),
  /* warm light from above (vignette) */
  radial-gradient(ellipse at 50% 20%, rgba(255, 200, 120, 0.12) 0%, rgba(0, 0, 0, 0.18) 100%);
```

### Paper panels (.panel class)

Used for: home page container, waiting room, modals, game log.

```css
background-color: var(--paper-aged);
background-image:
  /* subtle noise texture */ url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
box-shadow: var(--shadow-panel);
border-radius: 3px; /* slight rounding — like a piece of paper, not a UI card */
```

### Ruled notebook lines (.notebook class)

Used for: scoreboard, log background.

```css
background-color: var(--paper-face);
background-image:
  /* horizontal ruled lines */
  repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 27px,
    var(--paper-lines) 27px,
    var(--paper-lines) 28px
  ),
  /* left margin line */
  linear-gradient(
      to right,
      transparent 38px,
      rgba(220, 180, 180, 0.4) 38px,
      rgba(220, 180, 180, 0.4) 39px,
      transparent 39px
    );
```

---

## Component Designs

### Home Page

- Full wood background visible
- Centered `.panel` container, max-width 380px
- Game title in **IM Fell English SC**, large
- Dabb logo/stamp centered above title
- 4 action buttons stacked vertically
- Buttons: warm amber accent, slightly rounded (border-radius: 4px), tactile press effect
- Language switcher: subtle, top-right corner, small text link style

### Waiting Room

- Same `.panel` on wood background
- "Tisch Nr. [CODE]" heading with code displayed like a written table number
- Code copy/share: subtle icon buttons inline with the code
- Player list: each player is a handwritten-style name entry (`Caveat` font), with a small pencil-cross icon for removal
- AI slots: dashed line entries ("— frei —") awaiting a name
- Start button: full-width amber button at bottom

### Game Board (game-main area)

- Background is the raw wood surface (inherited from body)
- Phase indicator: small paper slip with **IM Fell English SC** text, pinned appearance (subtle drop shadow)
- Bidding panel: buttons styled as simple wooden chips or paper slips
- Trick area: cards placed directly on wood with slight random rotations (±3–6°), each with drop shadow as if lying on the table

### Player Hand

- Cards displayed at bottom, fan spread
- Cards styled realistically (see Card section below)
- Hover: card lifts with shadow enlargement
- Selected: card lifts further + amber glow border

### Scoreboard

- `.notebook` class background
- Header row: **Lato** bold, underlined with a pencil-line style border
- Score values: **Caveat** font, slightly larger
- "Bid not met" rows: red X or strikethrough in handwriting style
- Current round highlight: faint amber underline
- Expandable on mobile (collapsed by default)

### Game Log

- `.panel` background with `.notebook` ruled lines
- Each entry: **Caveat** font, ink-dark color, small
- Expandable section: card plays show icon + text ("Alice spielt König ♥")
- "Your turn" banner: amber background, pulsing, **IM Fell English SC**

### Modals (Confirm, Game Terminated, etc.)

- Paper note appearance: `.panel` with slight rotation (±1–2°) for "tossed on table" feel
- Optional: torn top edge (CSS clip-path or ::before pseudo-element)
- Heading: **IM Fell English SC**
- Body: **Lato**
- Buttons: same tactile button style

### Buttons

#### Primary (amber)

```css
background: var(--amber);
color: var(--ink-dark);
font-family: 'Lato', sans-serif;
font-weight: 700;
border: none;
border-radius: 4px;
padding: 0.75rem 1.5rem;
box-shadow: 0 3px 0 rgba(120, 60, 0, 0.4); /* bottom shadow = depth */
transition:
  transform 80ms,
  box-shadow 80ms;
```

#### Press state

```css
transform: translateY(2px);
box-shadow: 0 1px 0 rgba(120, 60, 0, 0.4);
```

#### Secondary (paper)

```css
background: var(--paper-aged);
color: var(--ink-mid);
border: 1px solid var(--paper-edge);
box-shadow: 0 2px 0 var(--paper-edge);
```

#### Destructive (muted red)

```css
background: var(--error);
color: var(--paper-face);
```

---

## Playing Card Design

### Card Dimensions (unchanged)

```css
--card-width: 80px /* desktop */ --card-height: 120px --card-width: 60px /* mobile */
  --card-height: 90px;
```

### Card Face

- Background: `var(--paper-face)` — warm white
- Border: 1px solid `#d0c8b0` (very subtle warm border)
- Border-radius: 4px (realistic card corner)
- Box-shadow: `var(--shadow-card)`
- Rank + suit displayed top-left and bottom-right (rotated 180°) in **IM Fell English SC**
- Suit color: `var(--card-red)` or `var(--card-black)`

### Card Back

- Background: `#5c2e0a` (dark reddish-brown)
- Pattern: repeating diamond hatch in lighter tone (`rgba(255,255,255,0.12)`)
- Thin inner border: `rgba(255,255,255,0.2)`
- Center motif: optional simple cross or diamond

```css
background-color: #5c2e0a;
background-image:
  repeating-linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.08) 0px,
    rgba(255, 255, 255, 0.08) 1px,
    transparent 1px,
    transparent 6px
  ),
  repeating-linear-gradient(
    -45deg,
    rgba(255, 255, 255, 0.08) 0px,
    rgba(255, 255, 255, 0.08) 1px,
    transparent 1px,
    transparent 6px
  );
```

### Face Card Illustrations (König, Ober, Buabe)

**Style**: Folk-art / linocut. Bold 2px outlines, flat fills, no gradients. Simple geometric faces. Think hand-stamped woodblock print — charming and slightly naive, not photorealistic.

**Color rules**:

- Outline/linework: suit color (`var(--card-black)` or `var(--card-red)`)
- Main fill: `var(--paper-face)` (card background shows through)
- Crown/hat accent: `#d4890a` (amber/gold) for all suits

**Implementation**: Each rank has its own SVG component: `KoenigFace.tsx`, `OberFace.tsx`, `BuabeFace.tsx`. The component receives `suit` as a prop for coloring. SVGs are inline (no external files).

**König (King)** — placed in SVG viewBox `0 0 80 120`:

- Crown: simple 3-point silhouette at top, amber fill, positioned ~y=10–25
- Head: oval shape y=25–40, suit-colored outline
- Eyes: two small filled circles
- Mouth: small curved line
- Body: trapezoidal robe shape y=40–90, suit-colored outline, plain fill
- Scepter: vertical line with circle at top, to the right of body
- Pose: frontal, symmetric

**Ober (Upper Jack)** — same viewBox:

- Hat: wide-brimmed with curved feather, amber accent for feather, y=8–28
- Head: slightly smaller oval y=28–42
- Body: standing figure, slightly taller proportions, y=42–90
- Holding: stylized 4-petal flower in one hand (nod to Württemberg tradition)
- Belt/sash: horizontal band across waist in amber

**Buabe (Knave/Jack)** — same viewBox:

- Cap: simple round cap (shorter brim), y=15–30
- Head: smaller, rounder y=30–44
- Body: shorter, y=44–90
- More casual: slight diagonal tilt implied by clothing lines
- Hands at sides or holding a small diamond-shaped shield

**Ass (Ace)**:

- No figure
- Large suit SVG icon centered (~50×50px) at the card center
- Simple thin decorative rectangular border (4–6px inset from card edge)
- Rank letter "A" in corner (small, **IM Fell English SC**)

**Zehn (Ten)**:

- Rank "10" in top-left + bottom-right corners with small suit icon
- Standard layout (same as current, just restyled)

---

## Animations

### Card animations

| Action                | Animation                                                | Duration                                 |
| --------------------- | -------------------------------------------------------- | ---------------------------------------- |
| Card dealt to hand    | `translateX` from center + `rotate` into position        | 150ms ease-out, 50ms stagger             |
| Card hover            | `translateY(-12px)` + shadow enlarges                    | 150ms ease                               |
| Card selected         | `translateY(-20px)` + amber glow border                  | 150ms ease                               |
| Card played to trick  | Translate from hand to trick area + slight random rotate | 280ms ease-in-out                        |
| Trick swept (won)     | Cards scale to 0 + fade out                              | 300ms ease-in, 400ms delay after display |
| Hidden card revealed  | CSS `rotateY` 0→180° with face swap at 90°               | 300ms ease                               |
| Card invalid (greyed) | `filter: grayscale(80%) brightness(0.75)`                | 200ms transition                         |

### UI animations

| Action                 | Animation                          | Duration                  |
| ---------------------- | ---------------------------------- | ------------------------- |
| Button press           | `translateY(2px)` + shadow shrink  | 80ms                      |
| Modal appear           | `opacity` 0→1 + `scale` 0.92→1     | 200ms ease-out            |
| Phase indicator change | `opacity` 0→1 + `translateY` 6px→0 | 200ms ease                |
| Score update           | Brief amber highlight fade         | 400ms                     |
| "Your turn" banner     | Amber pulse (`opacity` 0.7↔1.0)    | 1.5s ease-in-out infinite |

---

## Sound Design

All sounds are short (< 500ms except win fanfare). Load lazily via HTMLAudioElement. Fail silently if files are absent. A mute toggle is available in the game UI.

| File              | Duration | Description               | Search terms (freesound.org, CC0) |
| ----------------- | -------- | ------------------------- | --------------------------------- |
| `card-deal.mp3`   | ~100ms   | Soft card slide / riffle  | "card deal" "card slide" CC0      |
| `card-play.mp3`   | ~150ms   | Card slap on wooden table | "card slap" "card table" CC0      |
| `card-select.mp3` | ~60ms    | Soft pick-up click        | "card pickup" "paper click" CC0   |
| `bid-place.mp3`   | ~100ms   | Wooden knock / chip click | "wooden knock" "wood tap" CC0     |
| `pass.mp3`        | ~150ms   | Soft thud                 | "soft knock" "dull thud" CC0      |
| `trick-win.mp3`   | ~200ms   | Card sweep / sliding      | "card sweep" "paper slide" CC0    |
| `game-win.mp3`    | ~800ms   | Warm short fanfare        | "fanfare short" "brass short" CC0 |

**Sound utility**: `apps/web/src/utils/sounds.ts` — a simple module that preloads audio files and exposes `playSound(name)`. Sounds are stored in `apps/web/public/sounds/`.

---

## What Does NOT Change

- Page routing and page structure
- All game logic, phases, event handling
- Socket.IO communication
- Scoreboard data and round history logic
- Game log event mapping
- i18n / translation system
- Accessibility (ARIA labels, keyboard navigation)
- Responsive breakpoint (768px)
- Mobile layout (single column, overlay log)
