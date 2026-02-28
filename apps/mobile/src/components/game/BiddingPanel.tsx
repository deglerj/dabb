/**
 * Bidding panel component for React Native
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from '@dabb/i18n';
import { getMinBid } from '@dabb/game-logic';
import { Colors, Fonts, Shadows } from '../../theme';

interface BiddingPanelProps {
  currentBid: number;
  isMyTurn: boolean;
  onBid: (amount: number) => void;
  onPass: () => void;
}

function BiddingPanel({ currentBid, isMyTurn, onBid, onPass }: BiddingPanelProps) {
  const { t } = useTranslation();
  const minBid = getMinBid(currentBid);

  const bidOptions = [minBid, minBid + 10, minBid + 20, minBid + 50];

  return (
    <View style={styles.container}>
      <Text style={styles.currentBid}>
        {t('game.currentBid')}: {currentBid || '-'}
      </Text>

      {isMyTurn && (
        <>
          <View style={styles.bidOptions}>
            {bidOptions.map((amount) => (
              <Pressable
                key={amount}
                style={({ pressed }) => [
                  styles.bidOptionButton,
                  pressed && styles.bidOptionPressed,
                ]}
                onPress={() => onBid(amount)}
              >
                <Text style={styles.bidOptionText}>{amount}</Text>
              </Pressable>
            ))}
          </View>

          <TouchableOpacity style={styles.passButton} onPress={onPass}>
            <View style={styles.buttonContent}>
              <Feather name="x" size={16} color={Colors.error} />
              <Text style={styles.passButtonText}>{t('game.pass')}</Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {!isMyTurn && <Text style={styles.waitingText}>{t('game.waitingForOtherPlayers')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.paperFace,
    borderRadius: 3,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    ...Shadows.panel,
  },
  currentBid: {
    fontSize: 13,
    fontFamily: Fonts.handwriting,
    color: Colors.inkFaint,
    textAlign: 'center',
    marginBottom: 14,
  },
  bidOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  bidOptionButton: {
    backgroundColor: Colors.paperAged,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    minWidth: 60,
    alignItems: 'center',
    shadowColor: Colors.paperEdge,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  bidOptionPressed: {
    transform: [{ translateY: 1 }],
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  bidOptionText: {
    color: Colors.inkDark,
    fontFamily: Fonts.handwritingBold,
    fontSize: 18,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  passButton: {
    backgroundColor: Colors.paperFace,
    borderWidth: 1,
    borderColor: Colors.error,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 3,
    alignItems: 'center',
    alignSelf: 'center',
  },
  passButtonText: {
    color: Colors.error,
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
  },
  waitingText: {
    fontSize: 13,
    fontFamily: Fonts.handwriting,
    color: Colors.inkFaint,
    textAlign: 'center',
  },
});

export default BiddingPanel;
