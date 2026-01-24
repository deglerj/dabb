/**
 * Bidding panel component for React Native
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from '@dabb/i18n';

interface BiddingPanelProps {
  currentBid: number;
  isMyTurn: boolean;
  onBid: (amount: number) => void;
  onPass: () => void;
}

const BID_INCREMENTS = [10, 20, 50];

function BiddingPanel({ currentBid, isMyTurn, onBid, onPass }: BiddingPanelProps) {
  const { t } = useTranslation();
  const [selectedBid, setSelectedBid] = useState(currentBid + 10);

  const handleBid = () => {
    if (selectedBid > currentBid) {
      onBid(selectedBid);
    }
  };

  const incrementBid = (amount: number) => {
    setSelectedBid((prev) => Math.max(prev + amount, currentBid + 10));
  };

  if (!isMyTurn) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t('game.waitingForOtherPlayers')}</Text>
        <Text style={styles.currentBid}>
          {t('game.currentBid')}: {currentBid}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('game.yourBid')}</Text>
      <Text style={styles.currentBid}>
        {t('game.currentBid')}: {currentBid}
      </Text>

      <View style={styles.bidSelector}>
        <TouchableOpacity
          style={styles.decrementButton}
          onPress={() => setSelectedBid((prev) => Math.max(prev - 10, currentBid + 10))}
        >
          <Text style={styles.buttonText}>-10</Text>
        </TouchableOpacity>

        <Text style={styles.selectedBid}>{selectedBid}</Text>

        <View style={styles.incrementButtons}>
          {BID_INCREMENTS.map((inc) => (
            <TouchableOpacity
              key={inc}
              style={styles.incrementButton}
              onPress={() => incrementBid(inc)}
            >
              <Text style={styles.buttonText}>+{inc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={[styles.button, styles.bidButton]} onPress={handleBid}>
          <Text style={styles.buttonText}>{t('game.bid')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.passButton]} onPress={onPass}>
          <Text style={styles.passButtonText}>{t('game.pass')}</Text>
        </TouchableOpacity>
      </View>
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  currentBid: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  bidSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  selectedBid: {
    fontSize: 32,
    fontWeight: 'bold',
    marginHorizontal: 16,
    minWidth: 80,
    textAlign: 'center',
  },
  decrementButton: {
    backgroundColor: '#e5e7eb',
    padding: 12,
    borderRadius: 8,
  },
  incrementButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  incrementButton: {
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  bidButton: {
    backgroundColor: '#22c55e',
  },
  passButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  passButtonText: {
    color: '#dc2626',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default BiddingPanel;
