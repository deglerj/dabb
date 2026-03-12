# Landscape Support Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add landscape orientation support to the Dabb mobile app, with a full two-panel layout for GameScreen and free rotation for HomeScreen and WaitingRoomScreen.

**Architecture:** Unlock orientation in `app.json`. Add a `disableExpand` prop to `GameLog` for use in the landscape panel. Extract a `LandscapeGameLayout` component that renders the left info panel (scores + game log) and the right game area. `GameScreen` detects orientation via `useWindowDimensions` and delegates to `LandscapeGameLayout` when landscape.

**Tech Stack:** React Native `useWindowDimensions`, `useSafeAreaInsets` (react-native-safe-area-context), `@expo/vector-icons` Feather icons, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-03-12-landscape-support-design.md`

---

## Chunk 1: Foundation

### Task 1: Unlock orientation in app.json

**Files:**

- Modify: `apps/mobile/app.json`

- [ ] **Step 1: Change orientation setting**

In `apps/mobile/app.json`, change line 6:

```json
"orientation": "default",
```

Full updated file:

```json
{
  "expo": {
    "name": "Dabb – Binokel",
    "slug": "dabb-binokel",
    "version": "1.0.0",
    "orientation": "default",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "package": "com.dabb.binokel",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "favicon": "./assets/favicon.png"
    }
  }
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm run build
```

Expected: Build passes with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app.json
git commit -m "feat(mobile): unlock landscape orientation"
```

---

### Task 2: Add `disableExpand` prop to GameLog

**Files:**

- Modify: `apps/mobile/src/components/game/GameLog.tsx`
- Create: `apps/mobile/src/components/game/__tests__/GameLog.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/mobile/src/components/game/__tests__/GameLog.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GameLog from '../GameLog';
import type { GameState, PlayerIndex, Trick, GameLogEntry } from '@dabb/shared-types';

// `useGameLog` is the only hook used — mock at module level so Vitest hoisting works
const mockUseGameLog = vi.fn();
vi.mock('@dabb/ui-shared', () => ({
  useGameLog: (...args: unknown[]) => mockUseGameLog(...args),
}));

vi.mock('@dabb/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'de' },
  }),
}));

const emptyTrick: Trick = { cards: [], leadSuit: null, winnerIndex: null };

const baseState: GameState = {
  phase: 'tricks',
  playerCount: 2,
  players: [
    { id: 'p0', nickname: 'Alice', playerIndex: 0 as PlayerIndex, connected: true },
    { id: 'p1', nickname: 'Bob', playerIndex: 1 as PlayerIndex, connected: true },
  ],
  hands: new Map(),
  dabb: [],
  currentBid: 150,
  bidWinner: null,
  currentBidder: 0 as PlayerIndex,
  firstBidder: 0 as PlayerIndex,
  passedPlayers: new Set(),
  trump: 'herz',
  currentTrick: emptyTrick,
  tricksTaken: new Map(),
  currentPlayer: 0 as PlayerIndex,
  roundScores: new Map(),
  totalScores: new Map([
    [0 as PlayerIndex, 100],
    [1 as PlayerIndex, 50],
  ]),
  targetScore: 1000,
  declaredMelds: new Map(),
  dealer: 0 as PlayerIndex,
  round: 1,
  wentOut: false,
  dabbCardIds: [],
  lastCompletedTrick: null,
};

const nicknames = new Map<PlayerIndex, string>([
  [0 as PlayerIndex, 'Alice'],
  [1 as PlayerIndex, 'Bob'],
]);

// Helper to build a minimal valid GameLogEntry
function makeEntry(id: string, round: number): GameLogEntry {
  return {
    id,
    timestamp: 0,
    type: 'round_started',
    playerIndex: null,
    data: { kind: 'round_started', round },
  };
}

// Six entries; the hook normally returns the last 5 as latestEntries
const sixEntries = [1, 2, 3, 4, 5, 6].map((n) => makeEntry(String(n), n));
const lastFive = sixEntries.slice(1);

describe('GameLog', () => {
  it('shows show-more toggle when there are more entries than latest entries', () => {
    mockUseGameLog.mockReturnValue({
      entries: sixEntries,
      latestEntries: lastFive,
      isYourTurn: false,
    });

    render(
      <GameLog
        state={baseState}
        events={[]}
        currentPlayerIndex={0 as PlayerIndex}
        nicknames={nicknames}
      />
    );

    expect(screen.getByText('gameLog.showMore')).toBeInTheDocument();
  });

  it('hides show-more toggle when disableExpand is true', () => {
    mockUseGameLog.mockReturnValue({
      entries: sixEntries,
      latestEntries: lastFive,
      isYourTurn: false,
    });

    render(
      <GameLog
        state={baseState}
        events={[]}
        currentPlayerIndex={0 as PlayerIndex}
        nicknames={nicknames}
        disableExpand
      />
    );

    expect(screen.queryByText('gameLog.showMore')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm --filter @dabb/mobile test GameLog
```

Expected: FAIL — `disableExpand` prop does not exist yet.

- [ ] **Step 3: Add `disableExpand` prop to GameLog**

In `apps/mobile/src/components/game/GameLog.tsx`:

Change the interface (line 15):

```tsx
interface GameLogProps {
  state: GameState;
  events: GameEvent[];
  currentPlayerIndex: PlayerIndex;
  nicknames: Map<PlayerIndex, string>;
  disableExpand?: boolean;
}
```

Update the function signature (line 22):

```tsx
function GameLog({ state, events, currentPlayerIndex, nicknames, disableExpand = false }: GameLogProps) {
```

Update the toggle button condition (line 247). Find this block:

```tsx
{
  hasMoreEntries && (
    <TouchableOpacity style={styles.toggleButton} onPress={() => setIsExpanded(!isExpanded)}>
      <View style={styles.toggleContent}>
        <Feather
          name={isExpanded ? 'chevron-down' : 'chevron-up'}
          size={10}
          color={Colors.inkFaint}
        />
        <Text style={styles.toggleText}>
          {isExpanded ? t('gameLog.showLess') : t('gameLog.showMore')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
```

Replace with:

```tsx
{
  hasMoreEntries && !disableExpand && (
    <TouchableOpacity style={styles.toggleButton} onPress={() => setIsExpanded(!isExpanded)}>
      <View style={styles.toggleContent}>
        <Feather
          name={isExpanded ? 'chevron-down' : 'chevron-up'}
          size={10}
          color={Colors.inkFaint}
        />
        <Text style={styles.toggleText}>
          {isExpanded ? t('gameLog.showLess') : t('gameLog.showMore')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
pnpm --filter @dabb/mobile test GameLog
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/game/GameLog.tsx apps/mobile/src/components/game/__tests__/GameLog.test.tsx
git commit -m "feat(mobile): add disableExpand prop to GameLog"
```

---

## Chunk 2: LandscapeGameLayout Component

### Task 3: Create LandscapeGameLayout

**Files:**

- Create: `apps/mobile/src/components/game/LandscapeGameLayout.tsx`
- Create: `apps/mobile/src/components/game/__tests__/LandscapeGameLayout.test.tsx`
- Modify: `apps/mobile/src/components/game/index.ts`

- [ ] **Step 1: Write failing test**

Create `apps/mobile/src/components/game/__tests__/LandscapeGameLayout.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LandscapeGameLayout from '../LandscapeGameLayout';
import type { GameState, PlayerIndex, Trick } from '@dabb/shared-types';

vi.mock('../GameLog', () => ({
  default: () => <div data-testid="game-log" />,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@dabb/ui-shared', () => ({
  useRoundHistory: vi.fn().mockReturnValue({
    currentRound: null,
    rounds: [],
  }),
}));

vi.mock('@dabb/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'de' },
  }),
}));

const emptyTrick: Trick = { cards: [], leadSuit: null, winnerIndex: null };

const baseState: GameState = {
  phase: 'tricks',
  playerCount: 2,
  players: [
    { id: 'p0', nickname: 'Alice', playerIndex: 0 as PlayerIndex, connected: true },
    { id: 'p1', nickname: 'Bob', playerIndex: 1 as PlayerIndex, connected: true },
  ],
  hands: new Map(),
  dabb: [],
  currentBid: 150,
  bidWinner: null,
  currentBidder: 0 as PlayerIndex,
  firstBidder: 0 as PlayerIndex,
  passedPlayers: new Set(),
  trump: 'herz',
  currentTrick: emptyTrick,
  tricksTaken: new Map(),
  currentPlayer: 0 as PlayerIndex,
  roundScores: new Map(),
  totalScores: new Map([
    [0 as PlayerIndex, 240],
    [1 as PlayerIndex, 180],
  ]),
  targetScore: 1000,
  declaredMelds: new Map(),
  dealer: 0 as PlayerIndex,
  round: 1,
  wentOut: false,
  dabbCardIds: [],
  lastCompletedTrick: null,
};

const nicknames = new Map<PlayerIndex, string>([
  [0 as PlayerIndex, 'Alice'],
  [1 as PlayerIndex, 'Bob'],
]);

const defaultProps = {
  state: baseState,
  events: [],
  playerIndex: 0 as PlayerIndex,
  nicknames,
  panelExpanded: true,
  onTogglePanel: vi.fn(),
  isMyTurn: false,
  soundMuted: false,
  onToggleMute: vi.fn(),
  canExit: true,
  onExitGame: vi.fn(),
  phaseContent: <div data-testid="phase-content">Phase Content</div>,
  handContent: <div data-testid="hand-content">Hand Content</div>,
};

describe('LandscapeGameLayout', () => {
  it('renders player scores in expanded panel', () => {
    render(<LandscapeGameLayout {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('240')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('180')).toBeInTheDocument();
  });

  it('renders game log in expanded panel', () => {
    render(<LandscapeGameLayout {...defaultProps} />);
    expect(screen.getByTestId('game-log')).toBeInTheDocument();
  });

  it('renders phaseContent and handContent in right area', () => {
    render(<LandscapeGameLayout {...defaultProps} />);
    expect(screen.getByTestId('phase-content')).toBeInTheDocument();
    expect(screen.getByTestId('hand-content')).toBeInTheDocument();
  });

  it('calls onTogglePanel when collapse button pressed', () => {
    const onTogglePanel = vi.fn();
    render(<LandscapeGameLayout {...defaultProps} onTogglePanel={onTogglePanel} />);
    fireEvent.click(screen.getByTestId('panel-toggle'));
    expect(onTogglePanel).toHaveBeenCalled();
  });

  it('hides scores and game log when panel is collapsed', () => {
    render(<LandscapeGameLayout {...defaultProps} panelExpanded={false} />);
    expect(screen.queryByText('240')).not.toBeInTheDocument();
    expect(screen.queryByTestId('game-log')).not.toBeInTheDocument();
  });

  it('still renders toggle button when panel is collapsed', () => {
    render(<LandscapeGameLayout {...defaultProps} panelExpanded={false} />);
    expect(screen.getByTestId('panel-toggle')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm --filter @dabb/mobile test LandscapeGameLayout
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement LandscapeGameLayout**

Create `apps/mobile/src/components/game/LandscapeGameLayout.tsx`:

```tsx
/**
 * Landscape layout for the game screen.
 * Left panel: collapsible sidebar with scores and game log.
 * Right area: header bar, game content, player hand.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GameState, GameEvent, PlayerIndex, Team } from '@dabb/shared-types';
import { useRoundHistory } from '@dabb/ui-shared';
import { useTranslation } from '@dabb/i18n';
import GameLog from './GameLog';
import { Colors, Fonts } from '../../theme';

const PANEL_EXPANDED_WIDTH = 160;
const PANEL_COLLAPSED_WIDTH = 32;

interface LandscapeGameLayoutProps {
  // Left panel data
  state: GameState;
  events: GameEvent[];
  playerIndex: PlayerIndex;
  nicknames: Map<PlayerIndex, string>;
  // Panel state
  panelExpanded: boolean;
  onTogglePanel: () => void;
  // Header bar
  isMyTurn: boolean;
  soundMuted: boolean;
  onToggleMute: () => void;
  canExit: boolean;
  onExitGame?: () => void;
  // Content areas (provided by GameScreen)
  phaseContent: React.ReactNode;
  handContent: React.ReactNode;
}

function LandscapeGameLayout({
  state,
  events,
  playerIndex,
  nicknames,
  panelExpanded,
  onTogglePanel,
  isMyTurn,
  soundMuted,
  onToggleMute,
  canExit,
  onExitGame,
  phaseContent,
  handContent,
}: LandscapeGameLayoutProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { currentRound } = useRoundHistory(events);

  const getName = (playerOrTeam: PlayerIndex | Team): string => {
    if (state.playerCount === 4) {
      const teamPlayers = state.players.filter((p) => p.team === playerOrTeam);
      if (teamPlayers.length > 0) {
        return teamPlayers.map((p) => p.nickname).join(' & ');
      }
    }
    const nickname = nicknames.get(playerOrTeam as PlayerIndex);
    if (nickname) return nickname;
    return `${t('common.player')} ${(playerOrTeam as number) + 1}`;
  };

  const playerScores = Array.from(state.totalScores.entries());

  return (
    <View style={styles.root}>
      {/* Left panel — expanded: View with toggle button at top; collapsed: entire strip is tappable */}
      {panelExpanded ? (
        <View style={[styles.panel, styles.panelExpanded, { paddingLeft: insets.left }]}>
          {/* Toggle button (collapse) */}
          <TouchableOpacity
            testID="panel-toggle"
            style={styles.toggleButton}
            onPress={onTogglePanel}
            activeOpacity={0.7}
          >
            <Feather name="chevron-left" size={16} color={Colors.paperAged} />
          </TouchableOpacity>

          {/* Scores section */}
          <View style={styles.scoresSection}>
            <Text style={styles.sectionLabel}>{t('game.scoreBoard')}</Text>
            {playerScores.map(([playerOrTeam, score]) => (
              <View key={playerOrTeam} style={styles.scoreRow}>
                <Text style={styles.scoreName} numberOfLines={1}>
                  {getName(playerOrTeam)}
                </Text>
                <Text style={styles.scoreValue}>{score}</Text>
              </View>
            ))}
            {currentRound && currentRound.bidWinner !== null && (
              <Text style={styles.roundBidText}>
                {t('game.round')} {currentRound.round}: {getName(currentRound.bidWinner)} —{' '}
                {currentRound.winningBid}
              </Text>
            )}
          </View>

          {/* Game log section */}
          <View style={styles.logSection}>
            <GameLog
              state={state}
              events={events}
              currentPlayerIndex={playerIndex}
              nicknames={nicknames}
              disableExpand
            />
          </View>
        </View>
      ) : (
        /* Collapsed: entire 32dp strip is a TouchableOpacity so tap anywhere expands */
        <TouchableOpacity
          testID="panel-toggle"
          style={[styles.panel, styles.panelCollapsed, { paddingLeft: insets.left }]}
          onPress={onTogglePanel}
          activeOpacity={0.7}
        >
          <View style={styles.iconStrip}>
            <Feather name="chevron-right" size={16} color={Colors.paperAged} />
            <Feather
              name="bar-chart-2"
              size={14}
              color={Colors.inkFaint}
              style={styles.stripIcon}
            />
            <Feather name="list" size={14} color={Colors.inkFaint} style={styles.stripIcon} />
          </View>
        </TouchableOpacity>
      )}

      {/* Right area */}
      <View style={styles.rightArea}>
        {/* Header bar */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.headerLeft}>
            <Text style={styles.phaseLabel}>
              {state.phase === 'bidding' && `${t('game.bid')}: ${state.currentBid}`}
              {state.phase === 'tricks' && state.trump && `${t('game.trump')}: ${state.trump}`}
            </Text>
            {isMyTurn && state.phase !== 'waiting' && state.phase !== 'dealing' && (
              <Text style={styles.turnIndicator}>{t('game.yourTurn')}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.muteButton} onPress={onToggleMute}>
              <Feather
                name={soundMuted ? 'volume-x' : 'volume-2'}
                size={14}
                color={Colors.paperFace}
              />
            </TouchableOpacity>
            {canExit && onExitGame && (
              <TouchableOpacity style={styles.exitButton} onPress={onExitGame}>
                <View style={styles.buttonContent}>
                  <Feather name="log-out" size={12} color={Colors.paperFace} />
                  <Text style={styles.exitButtonText}>{t('game.exitGame')}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Game area */}
        <View style={styles.gameArea}>{phaseContent}</View>

        {/* Hand container */}
        <View style={[styles.handContainer, { paddingRight: insets.right }]}>{handContent}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  panel: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.1)',
  },
  panelExpanded: {
    width: PANEL_EXPANDED_WIDTH,
  },
  panelCollapsed: {
    width: PANEL_COLLAPSED_WIDTH,
  },
  toggleButton: {
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  scoresSection: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: Fonts.bodyBold,
    color: Colors.amberLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  scoreName: {
    flex: 1,
    fontSize: 11,
    fontFamily: Fonts.body,
    color: Colors.paperAged,
    marginRight: 4,
  },
  scoreValue: {
    fontSize: 16,
    fontFamily: Fonts.handwritingBold,
    color: Colors.paperFace,
  },
  roundBidText: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    fontSize: 10,
    fontFamily: Fonts.handwriting,
    color: Colors.inkFaint,
  },
  logSection: {
    flex: 1,
    paddingTop: 8,
    overflow: 'hidden',
  },
  iconStrip: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 12,
    gap: 16,
  },
  stripIcon: {
    opacity: 0.5,
  },
  rightArea: {
    flex: 1,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phaseLabel: {
    color: Colors.paperAged,
    fontSize: 13,
    fontFamily: Fonts.handwritingBold,
  },
  turnIndicator: {
    color: Colors.amberLight,
    fontSize: 13,
    fontFamily: Fonts.display,
    letterSpacing: 0.5,
  },
  muteButton: {
    padding: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  exitButton: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  exitButtonText: {
    color: Colors.paperFace,
    fontSize: 11,
    fontFamily: Fonts.body,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gameArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  handContainer: {
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
});

export default LandscapeGameLayout;
```

- [ ] **Step 4: Export from index**

In `apps/mobile/src/components/game/index.ts`, add:

```ts
export { default as LandscapeGameLayout } from './LandscapeGameLayout';
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
pnpm --filter @dabb/mobile test LandscapeGameLayout
```

Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/game/LandscapeGameLayout.tsx \
        apps/mobile/src/components/game/__tests__/LandscapeGameLayout.test.tsx \
        apps/mobile/src/components/game/index.ts
git commit -m "feat(mobile): add LandscapeGameLayout component"
```

---

## Chunk 3: GameScreen Integration

### Task 4: Wire landscape layout into GameScreen

**Files:**

- Modify: `apps/mobile/src/screens/GameScreen.tsx`
- Modify: `apps/mobile/src/screens/__tests__/GameScreen.test.tsx`

- [ ] **Step 1: Write failing landscape test**

In `apps/mobile/src/screens/__tests__/GameScreen.test.tsx`, add these mocks near the top (with the existing mocks):

```tsx
vi.mock('../../components/game/LandscapeGameLayout', () => ({
  default: ({
    phaseContent,
    handContent,
  }: {
    phaseContent: React.ReactNode;
    handContent: React.ReactNode;
  }) => (
    <div data-testid="landscape-layout">
      {phaseContent}
      {handContent}
    </div>
  ),
}));

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-native')>();
  return {
    ...actual,
    useWindowDimensions: vi.fn().mockReturnValue({ width: 375, height: 812 }),
  };
});
```

Then add this test at the end of the `describe('GameScreen')` block:

```tsx
it('renders LandscapeGameLayout when width > height', () => {
  const { useWindowDimensions } = require('react-native');
  vi.mocked(useWindowDimensions).mockReturnValue({ width: 844, height: 390 });

  render(<GameScreen {...defaultProps} />);

  expect(screen.getByTestId('landscape-layout')).toBeInTheDocument();

  // Reset to portrait for other tests
  vi.mocked(useWindowDimensions).mockReturnValue({ width: 375, height: 812 });
});

it('renders portrait layout when height > width', () => {
  const { useWindowDimensions } = require('react-native');
  vi.mocked(useWindowDimensions).mockReturnValue({ width: 375, height: 812 });

  render(<GameScreen {...defaultProps} />);

  expect(screen.queryByTestId('landscape-layout')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Confirm existing tests still pass with the new mock**

```bash
pnpm --filter @dabb/mobile test GameScreen
```

Expected: All **existing** tests PASS (the `useWindowDimensions` default mock returns portrait dimensions `375×812` so `isLandscape` is false — existing behaviour unchanged). The two new landscape tests FAIL because `landscape-layout` is not yet rendered. If any previously-passing test now fails, fix the mock before continuing.

- [ ] **Step 3: Update GameScreen imports**

In `apps/mobile/src/screens/GameScreen.tsx`, update the import block:

Add `useWindowDimensions` to the react-native import:

```tsx
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Pressable,
  useWindowDimensions,
} from 'react-native';
```

Add `LandscapeGameLayout` to the game components import (`useSafeAreaInsets` is NOT needed in GameScreen — `LandscapeGameLayout` handles it internally):

```tsx
import {
  PlayerHand,
  BiddingPanel,
  TrumpSelector,
  TrickArea,
  ScoreBoard,
  ScoreBoardHeader,
  GameLog,
  CelebrationOverlay,
  LandscapeGameLayout,
} from '../components/game';
```

- [ ] **Step 4: Add orientation state and panel state to GameScreen**

Inside `GameScreen` function body, add after the existing `useState` declarations:

```tsx
const { width, height } = useWindowDimensions();
const isLandscape = width > height;

const [panelExpanded, setPanelExpanded] = useState(true);

// Reset panel to expanded each time we enter landscape
useEffect(() => {
  if (isLandscape) setPanelExpanded(true);
}, [isLandscape]);
```

`useSafeAreaInsets` is NOT called in `GameScreen` — it is called inside `LandscapeGameLayout` which handles insets for both the panel and the right area.

- [ ] **Step 5: Add landscape return branch to GameScreen**

In the `return` statement of `GameScreen`, wrap the existing portrait JSX and add a landscape branch. Replace the current `return (` through the end of the component with:

```tsx
  // ── Landscape layout ────────────────────────────────────────────
  if (isLandscape) {
    const handNode = (
      <>
        <PlayerHand
          cards={sortedHand}
          selectedCardId={selectedCardId}
          validCardIds={validCardIds}
          dabbCardIds={state.dabbCardIds}
          onCardSelect={handleCardSelect}
          selectionMode={
            state.phase === 'dabb' && state.dabb.length === 0 && state.bidWinner === playerIndex
              ? 'multiple'
              : 'single'
          }
          selectedCardIds={selectedCards}
          onMultiSelect={handleMultiSelect}
          draggable={state.phase === 'tricks' && isMyTurn && !isTrickPaused}
          onPlayCard={onPlayCard}
        />
        <Text
          style={[styles.hint, { opacity: state.phase === 'tricks' && selectedCardId ? 1 : 0 }]}
        >
          {t('game.tapAgainToPlay')}
        </Text>
      </>
    );

    return (
      <DropZoneProvider>
        <WoodBackground>
          <LandscapeGameLayout
            state={state}
            events={events}
            playerIndex={playerIndex}
            nicknames={nicknames}
            panelExpanded={panelExpanded}
            onTogglePanel={() => setPanelExpanded((p) => !p)}
            isMyTurn={isMyTurn}
            soundMuted={soundMuted}
            onToggleMute={handleToggleMute}
            canExit={canExit}
            onExitGame={onExitGame}
            phaseContent={renderPhaseContent()}
            handContent={handNode}
          />
          <CelebrationOverlay events={events} playerIndex={playerIndex} />
        </WoodBackground>
      </DropZoneProvider>
    );
  }

  // ── Portrait layout (unchanged) ──────────────────────────────────
  return (
    <DropZoneProvider>
      <WoodBackground>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.phaseLabel}>
              {state.phase === 'bidding' && `${t('game.bid')}: ${state.currentBid}`}
              {state.phase === 'tricks' && state.trump && `${t('game.trump')}: ${state.trump}`}
            </Text>
            {isMyTurn && state.phase !== 'waiting' && state.phase !== 'dealing' && (
              <Text style={styles.turnIndicator}>{t('game.yourTurn')}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.muteButton} onPress={handleToggleMute}>
              <Feather
                name={soundMuted ? 'volume-x' : 'volume-2'}
                size={14}
                color={Colors.paperFace}
              />
            </TouchableOpacity>
            <LanguageSwitcher compact />
            {canExit && onExitGame && (
              <TouchableOpacity style={styles.exitButton} onPress={onExitGame}>
                <View style={styles.buttonContent}>
                  <Feather name="log-out" size={12} color={Colors.paperFace} />
                  <Text style={styles.exitButtonText}>{t('game.exitGame')}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Compact scoreboard header - always rendered to avoid layout shifts */}
        <ScoreBoardHeader
          state={state}
          events={events}
          nicknames={nicknames}
          onExpand={() => setShowExpandedScoreboard(true)}
        />

        {/* Game Log below scoreboard header */}
        <GameLog
          state={state}
          events={events}
          currentPlayerIndex={playerIndex}
          nicknames={nicknames}
        />

        <View style={styles.gameArea}>{renderPhaseContent()}</View>

        <View style={styles.handContainer}>
          <PlayerHand
            cards={sortedHand}
            selectedCardId={selectedCardId}
            validCardIds={validCardIds}
            dabbCardIds={state.dabbCardIds}
            onCardSelect={handleCardSelect}
            selectionMode={
              state.phase === 'dabb' && state.dabb.length === 0 && state.bidWinner === playerIndex
                ? 'multiple'
                : 'single'
            }
            selectedCardIds={selectedCards}
            onMultiSelect={handleMultiSelect}
            draggable={state.phase === 'tricks' && isMyTurn && !isTrickPaused}
            onPlayCard={onPlayCard}
          />
          <Text
            style={[styles.hint, { opacity: state.phase === 'tricks' && selectedCardId ? 1 : 0 }]}
          >
            {t('game.tapAgainToPlay')}
          </Text>
        </View>

        {/* Expanded scoreboard modal */}
        <Modal
          visible={showExpandedScoreboard}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowExpandedScoreboard(false)}
        >
          <View style={styles.modalOverlay}>
            <ScoreBoard
              state={state}
              events={events}
              nicknames={nicknames}
              currentPlayerIndex={playerIndex}
              onCollapse={() => setShowExpandedScoreboard(false)}
            />
          </View>
        </Modal>

        {/* Celebration animations */}
        <CelebrationOverlay events={events} playerIndex={playerIndex} />
      </WoodBackground>
    </DropZoneProvider>
  );
}
```

- [ ] **Step 6: Run all mobile tests**

```bash
pnpm --filter @dabb/mobile test
```

Expected: All tests PASS including the two new GameScreen landscape tests.

- [ ] **Step 7: Run full CI check**

```bash
pnpm run build && pnpm lint && pnpm test
```

Expected: Build, lint, and tests all PASS. Fix any TypeScript or lint errors before committing.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/screens/GameScreen.tsx \
        apps/mobile/src/screens/__tests__/GameScreen.test.tsx
git commit -m "feat(mobile): add landscape layout to GameScreen"
```

---

### Task 5: Manual verification

- [ ] **Step 1: Start the mobile dev server**

```bash
pnpm --filter @dabb/mobile start
```

Open Expo Go on the emulator/device.

- [ ] **Step 2: Verify HomeScreen in landscape**

Rotate the emulator to landscape. Confirm:

- HomeScreen remains accessible (no crash)
- Centered panel is still usable; wood background fills the sides
- Rotation back to portrait works

- [ ] **Step 3: Verify WaitingRoomScreen in landscape**

Navigate to the waiting room. Rotate to landscape. Confirm:

- Content scrolls and remains usable
- Rotation back to portrait works

- [ ] **Step 4: Verify GameScreen portrait (regression)**

Rotate back to portrait. Start or join a game. Confirm:

- Portrait layout is identical to before (ScoreBoardHeader, GameLog, hand at bottom)
- Expanded scoreboard modal still opens from ScoreBoardHeader tap

- [ ] **Step 5: Verify GameScreen landscape layout**

Rotate to landscape mid-game. Confirm:

- Left panel appears with scores and game log
- Collapse button (chevron-left) hides the panel to a 32dp strip
- Expand button (chevron-right) on the strip reopens the panel
- Phase content renders in center (trick area, bidding panel, etc.)
- Player hand is visible at the bottom and horizontally scrollable
- Rotating back to portrait restores the portrait layout

- [ ] **Step 6: Verify drag-to-play in landscape**

During the `tricks` phase in landscape, drag a card to the trick area. Confirm:

- Drop zone registers correctly (card plays when dropped on the trick area)
- Rotate orientation and try again — drop zone re-registers correctly
