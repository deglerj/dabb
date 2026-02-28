import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { Colors, Shadows } from '../theme';

interface PaperPanelProps {
  children: React.ReactNode;
  style?: ViewStyle;
  aged?: boolean;
}

export function PaperPanel({ children, style, aged = false }: PaperPanelProps) {
  return <View style={[styles.panel, aged && styles.aged, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.paperFace,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    padding: 16,
    ...Shadows.panel,
  },
  aged: {
    backgroundColor: Colors.paperAged,
  },
});
