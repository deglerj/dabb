# Landscape Support Design

**Date:** 2026-03-12
**Status:** Approved

## Overview

Add landscape orientation support to the Dabb mobile app. HomeScreen and WaitingRoomScreen allow free rotation but keep their existing portrait-centered layouts. GameScreen renders a purpose-built landscape layout that makes productive use of the wider viewport.

## Scope

| Screen            | Landscape behavior                                                                  |
| ----------------- | ----------------------------------------------------------------------------------- |
| HomeScreen        | Allowed; centered panel on WoodBackground fills extra horizontal space naturally    |
| WaitingRoomScreen | Allowed; ScrollView with centered PaperPanel fills extra horizontal space naturally |
| GameScreen        | Full landscape layout (see below)                                                   |

## Orientation Unlock

Change `apps/mobile/app.json`:

```json
"orientation": "default"
```

This allows all three orientations (portrait, landscape-left, landscape-right) on both iOS and Android.

## GameScreen Landscape Layout

### Orientation Detection

Use React Native's `useWindowDimensions` hook inside `GameScreen`:

```ts
const { width, height } = useWindowDimensions();
const isLandscape = width > height;
```

Render either the portrait layout (unchanged) or the landscape layout based on `isLandscape`.

### Layout Shift Convention

CLAUDE.md states: "never conditionally mount/unmount layout-affecting sections." This convention targets individual components within a stable layout (e.g., hiding a scoreboard row while the rest of the screen stays put). In this feature, the entire root layout tree is replaced — a `flexDirection: column` portrait tree vs. a `flexDirection: row` landscape tree. Because both subtrees are replaced atomically when orientation changes, there is no "missing UI flash" within a stable layout. This is an intentional exception to the convention, justified by the structural incompatibility of the two layouts.

### Layout Structure (landscape)

```
┌──────────────┬─────────────────────────────────────┐
│ Left panel   │ Header bar                          │
│              ├─────────────────────────────────────┤
│  Scores      │                                     │
│  ──────────  │         Game area                   │
│  Game log    │    (trick / bidding / phase UI)     │
│              │                                     │
│  [◀ hide]    ├─────────────────────────────────────┤
│              │ Player hand (horizontal scroll)     │
└──────────────┴─────────────────────────────────────┘
```

Root container: `flexDirection: 'row'`

### Left Panel — Expanded (width: 160dp)

**Contents:**

- **Scores section:** per-player or per-team names and total scores, same logic as `ScoreBoardHeader` (uses `getName()` helper to handle 2/3-player individual and 4-player team modes). Also shows current round bid info (bid winner + winning bid) below the scores, matching what `ScoreBoardHeader` currently shows.
- **Round history:** not accessible in landscape. The full `ScoreBoard` modal is portrait-only. This is intentional: the panel provides current scores; historical detail is deprioritized in landscape.
- **Game log section:** same content as the inline portrait `GameLog` component (last 5 events, pulsing your-turn banner).
- **Collapse button:** at the top of the panel, using a `Feather` chevron-left icon. Tapping collapses the panel to the icon strip.

`ScoreBoardHeader` and the inline `GameLog` are **not rendered** in landscape (replaced by the panel). The expanded `ScoreBoard` modal is **not triggered** in landscape.

### Left Panel — Collapsed (width: 32dp)

A thin vertical strip containing (top to bottom):

- Expand icon (`Feather` chevron-right)
- Scores icon (`Feather` bar-chart-2)
- Log icon (`Feather` list)

Icons are purely decorative in collapsed state (no score values shown). Tapping **anywhere on the strip** expands the panel. No individual icon actions.

### Panel State

```ts
const [panelExpanded, setPanelExpanded] = useState(true);

// Reset to expanded whenever we enter landscape
useEffect(() => {
  if (isLandscape) setPanelExpanded(true);
}, [isLandscape]);
```

This ensures a fresh expanded panel each time the user rotates to landscape.

### Right Area

- Same three-zone vertical structure as portrait: header bar → game area (flex: 1) → hand container
- `ScoreBoardHeader` is **not rendered** in landscape
- Inline `GameLog` is **not rendered** in landscape
- Header bar, game area, and hand container are structurally unchanged
- The inline `ScoreBoard` rendered during `scoring` and `finished` phases (inside the game area) renders unchanged in landscape — it sits in the center game area alongside the left panel. The wider landscape viewport gives the game area sufficient room for this.

### Safe Area Insets

Apply `useSafeAreaInsets()` in landscape to handle notch/camera-cutout on modern devices:

- Apply `insets.left` as `paddingLeft` on the left panel (or the collapsed strip)
- Apply `insets.right` as `paddingRight` on the right area's hand container
- Apply `insets.top` as `paddingTop` on the header bar (same as portrait)

### Drag-and-Drop in Landscape

`TrickArea` uses `measureInWindow` on `onLayout` to register drop-zone bounds in `DropZoneContext`. When orientation changes, `onLayout` fires again because the game area resizes, triggering a fresh `measureInWindow` call. The drag system therefore self-corrects and requires no changes. This should be verified with a manual test (drag a card to the trick area in landscape).

### Panel Collapse Animation

Instant re-layout (no width animation). Simple and consistent with the app's existing modal approach (which uses `animationType="slide"` only on explicit modal overlays, not on inline layout changes).

### Exact Dimensions

| Element                    | Value |
| -------------------------- | ----- |
| Left panel expanded width  | 160dp |
| Left panel collapsed width | 32dp  |

### Components to Change

| File                                                   | Change                                                                                                                                                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/app.json`                                 | `orientation` → `"default"`                                                                                                                                                                        |
| `apps/mobile/src/screens/GameScreen.tsx`               | Detect orientation; render landscape layout when `isLandscape`; add `panelExpanded` state with reset effect; suppress `ScoreBoardHeader` and inline `GameLog` in landscape; apply safe area insets |
| `apps/mobile/src/components/game/ScoreBoardHeader.tsx` | No change                                                                                                                                                                                          |
| `apps/mobile/src/components/game/GameLog.tsx`          | No change                                                                                                                                                                                          |

No new components are required. The landscape layout is implemented directly in `GameScreen`. Note: `GameScreen.tsx` is already large (746 lines); the implementer may extract a `LandscapeGameLayout` helper component to keep the file manageable — this is permitted but not required.

The `GameLog` component has its own internal expand/collapse toggle. In the left panel, this toggle should be suppressed — the log always shows in its default (collapsed, last-5-entries) state at 160dp width. Pass a `disableExpand` prop or equivalent to prevent the toggle from rendering inside the panel.

## Non-Goals

- HomeScreen and WaitingRoomScreen do not get landscape-specific layouts
- The player hand does not move to a vertical sidebar
- Drag-to-play gesture system is not changed
- Card size does not change between orientations
- Round history is not accessible in landscape

## Testing

- Manual: rotate emulator/device on each screen and verify layout
- Manual: verify drag-to-play still works correctly in landscape after orientation change
- Existing unit and integration tests are unaffected (they do not test layout)
- No new automated tests required (layout-only change, no logic changes)
