/**
 * GameLogTab — a collapsible panel showing recent game events in text form.
 * Always mounted; uses height/overflow to show/hide content (no conditional mount).
 * When collapsed, shows the last important event inline in the header.
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from '@dabb/i18n';

export interface GameLogTabProps {
  entries: string[];
  isExpanded: boolean;
  onToggle: () => void;
  collapsedSummary?: string;
}

export function GameLogTab({ entries, isExpanded, onToggle, collapsedSummary }: GameLogTabProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (isExpanded && entries.length > 0) {
      scrollRef.current?.scrollToEnd({ animated: false });
    }
  }, [isExpanded, entries.length]);

  return (
    <View style={styles.container}>
      {/* Header — always visible */}
      <Pressable style={styles.header} onPress={onToggle}>
        <Text style={styles.headerTitle}>{t('gameLog.title')}</Text>
        <Text style={styles.headerCount}>({entries.length})</Text>
        {!isExpanded && collapsedSummary ? (
          <Text style={styles.collapsedSummary} numberOfLines={1}>
            {collapsedSummary}
          </Text>
        ) : (
          <View style={styles.collapsedSummaryPlaceholder} />
        )}
        <Text style={styles.toggleIcon}>{isExpanded ? '▼' : '▲'}</Text>
      </Pressable>

      {/* Content — always mounted; height collapses when not expanded */}
      <View style={isExpanded ? styles.contentExpanded : styles.contentCollapsed}>
        <ScrollView ref={scrollRef} style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {entries.map((entry, i) => (
            <Text key={i} style={styles.entryText}>
              {entry}
            </Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a0f05',
    borderTopWidth: 1,
    borderTopColor: '#3d2e18',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f2e8d0',
  },
  headerCount: {
    fontSize: 12,
    color: '#c8b090',
  },
  collapsedSummary: {
    flex: 1,
    fontSize: 12,
    color: '#c8b090',
    fontStyle: 'italic',
    paddingLeft: 4,
  },
  collapsedSummaryPlaceholder: {
    flex: 1,
  },
  toggleIcon: {
    fontSize: 12,
    color: '#c8b090',
  },
  contentCollapsed: {
    height: 0,
    overflow: 'hidden',
  },
  contentExpanded: {
    maxHeight: 200,
  },
  scrollView: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  entryText: {
    fontSize: 12,
    color: '#c8b090',
    paddingVertical: 2,
    lineHeight: 18,
  },
});
