/**
 * Waiting room screen for game lobby
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Pressable,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AIDifficulty, PlayerIndex } from '@dabb/shared-types';
import { useTranslation } from '@dabb/i18n';
import { WoodBackground } from '../components/WoodBackground';
import { PaperPanel } from '../components/PaperPanel';
import { Colors, Fonts } from '../theme';

interface WaitingRoomScreenProps {
  sessionCode: string;
  players: Map<
    PlayerIndex,
    { nickname: string; connected: boolean; isAI: boolean; aiDifficulty?: AIDifficulty }
  >;
  playerCount: number;
  isHost: boolean;
  onStartGame: () => void;
  onLeave: () => void;
  onAddAI?: () => void;
  onRemoveAI?: (playerIndex: PlayerIndex) => void;
  isAddingAI?: boolean;
  selectedAIDifficulty?: AIDifficulty;
  onSelectAIDifficulty?: (difficulty: AIDifficulty) => void;
}

const AI_DIFFICULTIES: AIDifficulty[] = ['easy', 'medium', 'hard'];

function WaitingRoomScreen({
  sessionCode,
  players,
  playerCount,
  isHost,
  onStartGame,
  onLeave,
  onAddAI,
  onRemoveAI,
  isAddingAI = false,
  selectedAIDifficulty = 'medium',
  onSelectAIDifficulty,
}: WaitingRoomScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const connectedPlayers = Array.from(players.values()).filter((p) => p.connected).length;
  const canStart = connectedPlayers === playerCount;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${t('waitingRoom.shareMessage')} Code: ${sessionCode}`,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  return (
    <WoodBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t('waitingRoom.title')}</Text>

        {/* Game code */}
        <PaperPanel style={styles.codePanel}>
          <Text style={styles.codeLabel}>{t('waitingRoom.gameCode')}</Text>
          <Text style={styles.code}>{sessionCode}</Text>
          <Pressable
            style={({ pressed }) => [styles.shareButton, pressed && styles.shareButtonPressed]}
            onPress={handleShare}
          >
            <View style={styles.buttonContent}>
              <Feather name="share-2" size={14} color={Colors.inkDark} />
              <Text style={styles.shareButtonText}>{t('common.share')}</Text>
            </View>
          </Pressable>
        </PaperPanel>

        {/* Player list */}
        <PaperPanel style={styles.playersPanel}>
          <Text style={styles.playersTitle}>
            {t('common.players')} ({connectedPlayers}/{playerCount})
          </Text>

          <View style={styles.playersList}>
            {Array.from({ length: playerCount }).map((_, index) => {
              const player = players.get(index as PlayerIndex);
              return (
                <View key={index} style={styles.playerRow}>
                  {player?.isAI ? (
                    <Feather name="cpu" size={14} color={Colors.inkFaint} style={styles.aiIcon} />
                  ) : (
                    <View
                      style={[
                        styles.statusDot,
                        player?.connected ? styles.statusOnline : styles.statusOffline,
                      ]}
                    />
                  )}
                  <Text style={[styles.playerName, !player && styles.emptySlot]}>
                    {player?.nickname || `— ${t('waitingRoom.waitingForPlayers')}... —`}
                  </Text>
                  {player?.isAI && player.aiDifficulty && (
                    <Text style={styles.difficultyBadge}>
                      {t(`waitingRoom.aiDifficulty.${player.aiDifficulty}`)}
                    </Text>
                  )}
                  {index === 0 && <Text style={styles.hostBadge}>{t('waitingRoom.host')}</Text>}
                  {isHost && player?.isAI && onRemoveAI && (
                    <TouchableOpacity
                      style={styles.removeAIButton}
                      onPress={() => onRemoveAI(index as PlayerIndex)}
                    >
                      <Feather name="x" size={14} color={Colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {isHost && players.size < playerCount && onAddAI && (
            <View style={styles.addAISection}>
              <View style={styles.difficultyRow}>
                {AI_DIFFICULTIES.map((diff) => (
                  <Pressable
                    key={diff}
                    style={[
                      styles.difficultyButton,
                      selectedAIDifficulty === diff && styles.difficultyButtonSelected,
                    ]}
                    onPress={() => onSelectAIDifficulty?.(diff)}
                  >
                    <Text
                      style={[
                        styles.difficultyButtonText,
                        selectedAIDifficulty === diff && styles.difficultyButtonTextSelected,
                      ]}
                    >
                      {t(`waitingRoom.aiDifficulty.${diff}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.addAIButton,
                  isAddingAI && styles.disabledButton,
                  pressed && !isAddingAI && styles.addAIButtonPressed,
                ]}
                onPress={onAddAI}
                disabled={isAddingAI}
              >
                <View style={styles.buttonContent}>
                  {isAddingAI ? (
                    <ActivityIndicator size="small" color={Colors.inkFaint} />
                  ) : (
                    <Feather name="cpu" size={16} color={Colors.inkMid} />
                  )}
                  <Text style={styles.addAIButtonText}>{t('waitingRoom.addAIPlayer')}</Text>
                </View>
              </Pressable>
            </View>
          )}
        </PaperPanel>

        {!canStart && (
          <View style={styles.waitingIndicator}>
            <ActivityIndicator size="small" color={Colors.amberLight} />
            <Text style={styles.waitingText}>
              {t('waitingRoom.waitingForPlayersCount', {
                count: playerCount - connectedPlayers,
              })}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {isHost && (
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.startButton,
                !canStart && styles.disabledButton,
                pressed && canStart && styles.buttonPressed,
              ]}
              onPress={onStartGame}
              disabled={!canStart}
            >
              <View style={styles.buttonContent}>
                {canStart ? (
                  <Feather name="play" size={18} color={Colors.inkDark} />
                ) : (
                  <ActivityIndicator size="small" color={Colors.inkFaint} />
                )}
                <Text style={styles.startButtonText}>{t('waitingRoom.startGame')}</Text>
              </View>
            </Pressable>
          )}

          <TouchableOpacity style={styles.leaveButton} onPress={onLeave}>
            <View style={styles.buttonContent}>
              <Feather name="log-out" size={16} color={Colors.error} />
              <Text style={styles.leaveButtonText}>{t('common.leave')}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </WoodBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.display,
    color: Colors.paperFace,
    textAlign: 'center',
    marginBottom: 4,
    // Text shadow for readability on wood
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  codePanel: {
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: Colors.inkFaint,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  code: {
    fontSize: 28,
    fontFamily: Fonts.handwritingBold,
    color: Colors.inkDark,
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: Colors.inkFaint,
    paddingBottom: 4,
    paddingHorizontal: 8,
  },
  shareButton: {
    backgroundColor: Colors.amber,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 4,
    shadowColor: 'rgba(120,60,0,0.4)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  shareButtonPressed: {
    transform: [{ translateY: 1 }],
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  shareButtonText: {
    color: Colors.inkDark,
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
  },
  playersPanel: {
    padding: 12,
  },
  playersTitle: {
    fontSize: 14,
    fontFamily: Fonts.bodyBold,
    color: Colors.inkMid,
    marginBottom: 8,
  },
  playersList: {
    gap: 0,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.paperLines,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  statusOnline: {
    backgroundColor: Colors.success,
  },
  statusOffline: {
    backgroundColor: Colors.paperEdge,
  },
  playerName: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.handwriting,
    color: Colors.inkDark,
  },
  emptySlot: {
    color: Colors.inkFaint,
    fontStyle: 'italic',
  },
  hostBadge: {
    fontSize: 11,
    fontFamily: Fonts.body,
    color: Colors.amber,
    borderWidth: 1,
    borderColor: Colors.amber,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
  },
  difficultyBadge: {
    fontSize: 11,
    fontFamily: Fonts.body,
    color: Colors.inkFaint,
    backgroundColor: Colors.paperAged,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 4,
  },
  aiIcon: {
    marginRight: 10,
  },
  removeAIButton: {
    padding: 4,
    marginLeft: 6,
  },
  addAISection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.paperLines,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  difficultyButton: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    backgroundColor: Colors.paperFace,
  },
  difficultyButtonSelected: {
    backgroundColor: Colors.amber,
    borderColor: Colors.amber,
  },
  difficultyButtonText: {
    fontSize: 13,
    fontFamily: Fonts.body,
    color: Colors.inkMid,
  },
  difficultyButtonTextSelected: {
    color: Colors.inkDark,
    fontFamily: Fonts.bodyBold,
  },
  addAIButton: {
    backgroundColor: Colors.paperAged,
    paddingVertical: 10,
    borderRadius: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.paperEdge,
  },
  addAIButtonPressed: {
    transform: [{ translateY: 1 }],
  },
  addAIButtonText: {
    color: Colors.inkMid,
    fontSize: 13,
    fontFamily: Fonts.body,
  },
  waitingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  waitingText: {
    color: Colors.paperAged,
    fontSize: 13,
    fontFamily: Fonts.handwriting,
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 4,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: Colors.amber,
    shadowColor: 'rgba(120,60,0,0.4)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  buttonPressed: {
    transform: [{ translateY: 2 }],
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  disabledButton: {
    backgroundColor: Colors.inkFaint,
    shadowOpacity: 0,
    elevation: 0,
  },
  startButtonText: {
    color: Colors.inkDark,
    fontSize: 18,
    fontFamily: Fonts.bodyBold,
  },
  leaveButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.error,
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  leaveButtonText: {
    color: Colors.error,
    fontSize: 15,
    fontFamily: Fonts.body,
  },
});

export default WaitingRoomScreen;
