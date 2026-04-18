/**
 * GameLogTab — a collapsible panel showing recent game events in text form.
 * Always mounted; uses height/overflow to show/hide content (no conditional mount).
 * When collapsed, shows the last important event inline in the header.
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useTranslation } from '@dabb/i18n';

export interface MeldDetail {
  name: string; // e.g. "Herz-Paar", "Binokel"
  cards: string[]; // e.g. ["Herz König", "Herz Ober"] — formatCard returns suit then rank
  points: number;
}

export interface RichLogEntry {
  key: string;
  text: string;
  detail?: MeldDetail[]; // Only set for melds_declared entries
}

export interface GameLogTabProps {
  entries: RichLogEntry[];
  isExpanded: boolean;
  onToggle: () => void;
  collapsedSummary?: string;
}

export function GameLogTab({ entries, isExpanded, onToggle, collapsedSummary }: GameLogTabProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const isAtBottom = useRef(true);

  // Scroll to bottom when panel opens
  useEffect(() => {
    if (isExpanded && entries.length > 0) {
      scrollRef.current?.scrollToEnd({ animated: false });
    }
  }, [isExpanded, entries.length]);

  // Follow new entries if already scrolled to the bottom.
  // Also fires when isExpanded changes — the isExpanded guard prevents scrolling
  // the hidden (height:0) ScrollView while collapsed. When the panel opens, this
  // effect fires alongside the open effect above; both calling scrollToEnd is harmless.
  useEffect(() => {
    if (isExpanded && isAtBottom.current) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [entries.length, isExpanded]);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    isAtBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 8;
  }

  return (
    <View style={styles.container}>
      {/* Header — always visible */}
      <Pressable style={styles.header} onPress={onToggle}>
        <Text style={styles.headerTitle}>{t('gameLog.title')}</Text>
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
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {entries.map((entry) => (
            <View key={entry.key}>
              <Text style={styles.entryText}>{entry.text}</Text>
              {entry.detail?.map((meld, i) => (
                <Text key={i} style={styles.meldDetailText}>
                  {meld.name}: {meld.cards.join(', ')} ({meld.points})
                </Text>
              ))}
            </View>
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
  meldDetailText: {
    fontSize: 11,
    color: '#8a7060',
    paddingLeft: 16,
    paddingBottom: 2,
    lineHeight: 16,
  },
});
