/**
 * BiddingOverlay — bidding UI shown inside PhaseOverlay.
 *
 * If isMyTurn: scrollable chips for valid bid amounts + Pass button.
 * If not isMyTurn: waiting text.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ScrollView, View } from 'react-native';
import { useTranslation } from '@dabb/i18n';

export interface BiddingOverlayProps {
  currentBid: number;
  isMyTurn: boolean;
  onBid: (amount: number) => void;
  onPass: () => void;
}

const MIN_BID = 150;
const MAX_BID = 300;

function generateBidAmounts(currentBid: number): number[] {
  const amounts: number[] = [];
  // Steps of 10 from 150 to 250, then 300
  for (let bid = MIN_BID; bid <= MAX_BID; bid += bid < 300 ? 10 : 50) {
    if (bid > currentBid) {
      amounts.push(bid);
    }
    if (bid === 250) {
      if (300 > currentBid) {
        amounts.push(300);
      }
      break;
    }
  }
  return amounts;
}

export function BiddingOverlay({ currentBid, isMyTurn, onBid, onPass }: BiddingOverlayProps) {
  const { t } = useTranslation();
  const bidAmounts = generateBidAmounts(currentBid);

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
            {bidAmounts.map((amount) => (
              <TouchableOpacity key={amount} style={styles.chip} onPress={() => onBid(amount)}>
                <Text style={styles.chipText}>{amount}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.passButton} onPress={onPass}>
            <Text style={styles.passText}>{t('game.pass')}</Text>
          </TouchableOpacity>
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
    maxWidth: 280,
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
