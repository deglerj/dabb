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
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { PlayerIndex } from '@dabb/shared-types';
import { useTranslation } from '@dabb/i18n';

interface WaitingRoomScreenProps {
  sessionCode: string;
  players: Map<PlayerIndex, { nickname: string; connected: boolean; isAI: boolean }>;
  playerCount: number;
  isHost: boolean;
  onStartGame: () => void;
  onLeave: () => void;
  onAddAI?: () => void;
  onRemoveAI?: (playerIndex: PlayerIndex) => void;
  isAddingAI?: boolean;
}

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
}: WaitingRoomScreenProps) {
  const { t } = useTranslation();
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
    <View style={styles.container}>
      <Text style={styles.title}>{t('waitingRoom.title')}</Text>

      <View style={styles.codeContainer}>
        <Text style={styles.codeLabel}>{t('waitingRoom.gameCode')}:</Text>
        <Text style={styles.code}>{sessionCode}</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <View style={styles.buttonContent}>
            <Feather name="share-2" size={14} color="#fff" />
            <Text style={styles.shareButtonText}>{t('common.share')}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.playersSection}>
        <Text style={styles.playersTitle}>
          {t('common.players')} ({connectedPlayers}/{playerCount})
        </Text>

        <View style={styles.playersList}>
          {Array.from({ length: playerCount }).map((_, index) => {
            const player = players.get(index as PlayerIndex);
            return (
              <View key={index} style={styles.playerRow}>
                {player?.isAI ? (
                  <Feather name="cpu" size={14} color="#64748b" style={styles.aiIcon} />
                ) : (
                  <View
                    style={[
                      styles.statusDot,
                      player?.connected ? styles.statusOnline : styles.statusOffline,
                    ]}
                  />
                )}
                <Text style={styles.playerName}>
                  {player?.nickname || `${t('waitingRoom.waitingForPlayers')}...`}
                </Text>
                {index === 0 && <Text style={styles.hostBadge}>{t('waitingRoom.host')}</Text>}
                {isHost && player?.isAI && onRemoveAI && (
                  <TouchableOpacity
                    style={styles.removeAIButton}
                    onPress={() => onRemoveAI(index as PlayerIndex)}
                  >
                    <Feather name="x" size={14} color="#dc2626" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {isHost && players.size < playerCount && onAddAI && (
          <TouchableOpacity
            style={[styles.addAIButton, isAddingAI && styles.disabledButton]}
            onPress={onAddAI}
            disabled={isAddingAI}
          >
            <View style={styles.buttonContent}>
              {isAddingAI ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <Feather name="cpu" size={16} color="#2563eb" />
              )}
              <Text style={styles.addAIButtonText}>{t('waitingRoom.addAIPlayer')}</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {!canStart && (
        <View style={styles.waitingIndicator}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.waitingText}>
            {t('waitingRoom.waitingForPlayersCount', {
              count: playerCount - connectedPlayers,
            })}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        {isHost && (
          <TouchableOpacity
            style={[styles.button, styles.startButton, !canStart && styles.disabledButton]}
            onPress={onStartGame}
            disabled={!canStart}
          >
            <View style={styles.buttonContent}>
              {canStart ? (
                <Feather name="play" size={18} color="#fff" />
              ) : (
                <ActivityIndicator size="small" color="#fff" />
              )}
              <Text style={styles.buttonText}>{t('waitingRoom.startGame')}</Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.button, styles.leaveButton]} onPress={onLeave}>
          <View style={styles.buttonContent}>
            <Feather name="log-out" size={16} color="#dc2626" />
            <Text style={styles.leaveButtonText}>{t('common.leave')}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#f0f9ff',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e3a5f',
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 48,
  },
  codeContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  codeLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  code: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e3a5f',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 12,
  },
  shareButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  playersSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  playersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  playersList: {
    gap: 8,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  statusOnline: {
    backgroundColor: '#22c55e',
  },
  statusOffline: {
    backgroundColor: '#d1d5db',
  },
  playerName: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  hostBadge: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiIcon: {
    marginRight: 12,
  },
  removeAIButton: {
    padding: 4,
    marginLeft: 8,
  },
  addAIButton: {
    marginTop: 12,
    backgroundColor: '#dbeafe',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addAIButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  waitingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  waitingText: {
    color: '#64748b',
    fontSize: 14,
  },
  actions: {
    gap: 12,
    marginTop: 'auto',
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#22c55e',
  },
  leaveButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  leaveButtonText: {
    color: '#dc2626',
    fontSize: 16,
  },
});

export default WaitingRoomScreen;
