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
    if (nickname) {
      return nickname;
    }
    return `${t('common.player')} ${(playerOrTeam as number) + 1}`;
  };

  const playerScores = Array.from(state.totalScores.entries());

  return (
    <View style={styles.root}>
      {/* Left panel — always mounted; width switches via style; opacity hides/shows sections */}
      <View
        style={[
          styles.panel,
          panelExpanded ? styles.panelExpanded : styles.panelCollapsed,
          { paddingLeft: insets.left },
        ]}
      >
        {/* Tap-to-expand overlay when collapsed (absoluteFill, out of layout flow) */}
        {!panelExpanded && (
          <TouchableOpacity
            testID="panel-toggle"
            style={StyleSheet.absoluteFill}
            onPress={onTogglePanel}
            activeOpacity={0.7}
          />
        )}

        {/* Expanded content: toggle button, scores, game log — invisible when collapsed */}
        <View
          style={{ opacity: panelExpanded ? 1 : 0, flex: 1 }}
          pointerEvents={panelExpanded ? 'auto' : 'none'}
        >
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

        {/* Icon strip: visible when collapsed, invisible when expanded */}
        <View style={[styles.iconStrip, { opacity: panelExpanded ? 0 : 1 }]} pointerEvents="none">
          <Feather name="chevron-right" size={16} color={Colors.paperAged} />
          <Feather name="bar-chart-2" size={14} color={Colors.inkFaint} style={styles.stripIcon} />
          <Feather name="list" size={14} color={Colors.inkFaint} style={styles.stripIcon} />
        </View>
      </View>

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
