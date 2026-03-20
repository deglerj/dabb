/**
 * BiddingOverlay — bidding UI shown inside PhaseOverlay.
 *
 * If isMyTurn: scrollable chips for valid bid amounts + Pass button.
 * If not isMyTurn: waiting text.
 */
import React from 'react';
import { StyleSheet, Text, ScrollView, View } from 'react-native';
import { HapticTouchableOpacity } from '../components/HapticTouchableOpacity.js';
import { useTranslation } from '@dabb/i18n';

export interface BiddingOverlayProps {
  currentBid: number;
  isMyTurn: boolean;
  onBid: (amount: number) => void;
  onPass: () => void;
}

function generateBidAmounts(): number[] {
  const amounts: number[] = [];
  for (let bid = 150; bid <= 250; bid += 10) {
    amounts.push(bid);
  }
  amounts.push(300);
  return amounts;
}

export function BiddingOverlay({ currentBid, isMyTurn, onBid, onPass }: BiddingOverlayProps) {
  const { t } = useTranslation();
  const bidAmounts = generateBidAmounts();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('game.currentBid')}</Text>
      <Text style={styles.bidValue}>{currentBid}</Text>

      {isMyTurn ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
          >
            {bidAmounts
              .filter((amount) => amount > currentBid)
              .map((amount) => (
                <HapticTouchableOpacity
                  key={amount}
                  style={styles.chip}
                  onPress={() => onBid(amount)}
                >
                  <Text style={styles.chipText}>{amount}</Text>
                </HapticTouchableOpacity>
              ))}
          </ScrollView>
          <HapticTouchableOpacity style={styles.passButton} onPress={onPass}>
            <Text style={styles.passText}>{t('game.pass')}</Text>
          </HapticTouchableOpacity>
        </>
      ) : (
        <Text style={styles.waitingText}>{t('game.waitingForOtherPlayers')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    minWidth: 240,
  },
  label: {
    fontSize: 12,
    color: '#7a6040',
    marginBottom: 2,
  },
  bidValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3a2800',
    marginBottom: 12,
  },
  chipsScroll: {
    alignSelf: 'stretch',
    marginBottom: 10,
  },
  chipsContent: {
    paddingHorizontal: 4,
    gap: 6,
  },
  chip: {
    backgroundColor: '#8b6914',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  passButton: {
    backgroundColor: '#c0392b',
    borderRadius: 6,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 4,
  },
  passText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  waitingText: {
    color: '#7a6040',
    fontSize: 14,
    marginTop: 4,
  },
});
