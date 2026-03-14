/**
 * ReconnectingBanner — thin banner shown at the top when the socket connection is lost.
 * Always mounted; visibility is controlled via opacity. Non-interactive (pointerEvents none).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface ReconnectingBannerProps {
  visible: boolean;
}

export function ReconnectingBanner({ visible }: ReconnectingBannerProps) {
  return (
    <View style={[styles.banner, { opacity: visible ? 1 : 0 }]} pointerEvents="none">
      <Text style={styles.label}>Reconnecting...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: '#c97f00',
    paddingVertical: 6,
    alignItems: 'center',
  },
  label: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
