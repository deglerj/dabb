/**
 * Bidding panel component for React Native
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from '@dabb/i18n';
import { getMinBid } from '@dabb/game-logic';

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
              <TouchableOpacity
                key={amount}
                style={styles.bidOptionButton}
                onPress={() => onBid(amount)}
              >
                <Text style={styles.bidOptionText}>{amount}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.passButton} onPress={onPass}>
            <View style={styles.buttonContent}>
              <Feather name="x" size={16} color="#dc2626" />
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentBid: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  bidOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  bidOptionButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  bidOptionText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  passButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dc2626',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'center',
  },
  passButtonText: {
    color: '#dc2626',
    fontWeight: 'bold',
    fontSize: 16,
  },
  waitingText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default BiddingPanel;
