/**
 * ErrorBoundaryScreen — full-screen error display shown when a React error boundary catches a crash.
 * Pure display component; all logic (reload, copy) is handled by the parent boundary.
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../../theme.js';

export interface ErrorBoundaryScreenProps {
  error: Error;
  extraContext?: Record<string, unknown>;
  onReload: () => void;
  onCopy: () => void;
}

export default function ErrorBoundaryScreen({
  error,
  extraContext,
  onReload,
  onCopy,
}: ErrorBoundaryScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{error.message}</Text>

      <ScrollView style={styles.debugBox} contentContainerStyle={styles.debugContent}>
        <Text style={styles.sectionLabel}>Stack Trace</Text>
        <Text style={styles.mono}>{error.stack ?? '(no stack trace)'}</Text>

        {extraContext !== undefined && (
          <>
            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Game Context</Text>
            <Text style={styles.mono}>{JSON.stringify(extraContext, null, 2)}</Text>
          </>
        )}
      </ScrollView>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.reloadButton} onPress={onReload}>
          <Text style={styles.reloadButtonText}>Reload</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.copyButton} onPress={onCopy}>
          <Text style={styles.copyButtonText}>Copy error info</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.woodDark,
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 24,
    color: Colors.paperFace,
    marginBottom: 8,
  },
  errorMessage: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.paperFace,
    marginBottom: 16,
  },
  debugBox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 6,
    marginBottom: 20,
  },
  debugContent: {
    padding: 12,
  },
  sectionLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  sectionLabelSpaced: {
    marginTop: 20,
  },
  mono: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.paperAged,
    lineHeight: 16,
  },
  buttons: {
    gap: 10,
  },
  reloadButton: {
    backgroundColor: Colors.amber,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  reloadButtonText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.paperFace,
  },
  copyButton: {
    borderWidth: 1,
    borderColor: Colors.amber,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  copyButtonText: {
    fontFamily: Fonts.body,
    fontSize: 16,
    color: Colors.amber,
  },
});
