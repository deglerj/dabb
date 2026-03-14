/**
 * CelebrationLayer — full-screen overlay shown when the local player wins a round.
 * Always mounted; visibility is controlled via opacity and pointerEvents.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface CelebrationLayerProps {
  visible: boolean;
  message: string;
}

export function CelebrationLayer({ visible, message }: CelebrationLayerProps) {
  return (
    <View
      style={[styles.overlay, { opacity: visible ? 1 : 0 }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  message: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
