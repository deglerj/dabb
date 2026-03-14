/**
 * MeldingOverlay — lists declared melds with point totals and a confirm button.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from '@dabb/i18n';
import type { Meld } from '@dabb/shared-types';
import { MELD_NAMES, SUIT_NAMES } from '@dabb/shared-types';

export interface MeldingOverlayProps {
  melds: Meld[];
  canConfirm: boolean;
  onConfirm: () => void;
}

function getMeldDisplayName(meld: Meld): string {
  const baseName = MELD_NAMES[meld.type];
  if ((meld.type === 'paar' || meld.type === 'familie') && meld.suit) {
    return `${SUIT_NAMES[meld.suit]}-${baseName}`;
  }
  return baseName;
}

export function MeldingOverlay({ melds, canConfirm, onConfirm }: MeldingOverlayProps) {
  const { t } = useTranslation();
  const total = melds.reduce((sum, m) => sum + m.points, 0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('game.declareMelds')}</Text>

      {melds.length === 0 ? (
        <Text style={styles.noMelds}>{t('game.noMelds')}</Text>
      ) : (
        <View style={styles.meldList}>
          {melds.map((meld, i) => (
            <View key={i} style={styles.meldRow}>
              <Text style={styles.meldName}>{getMeldDisplayName(meld)}</Text>
              <Text style={styles.meldPoints}>{meld.points}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('game.total')}</Text>
            <Text style={styles.totalPoints}>{total}</Text>
          </View>
        </View>
      )}

      {canConfirm && (
        <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
          <Text style={styles.confirmButtonText}>{t('game.confirmMelds')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    minWidth: 220,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3a2800',
    marginBottom: 12,
  },
  noMelds: {
    fontSize: 14,
    color: '#7a6040',
    marginBottom: 12,
  },
  meldList: {
    width: '100%',
    marginBottom: 14,
  },
  meldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  meldName: {
    fontSize: 14,
    color: '#3a2800',
  },
  meldPoints: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3a2800',
    marginLeft: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#c8b090',
    marginTop: 6,
    paddingTop: 6,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3a2800',
  },
  totalPoints: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3a2800',
    marginLeft: 16,
  },
  confirmButton: {
    backgroundColor: '#2e7d32',
    borderRadius: 6,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
