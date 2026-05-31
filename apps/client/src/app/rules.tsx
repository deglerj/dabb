import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useTranslation } from '@dabb/i18n';
import { Colors, Fonts } from '../theme.js';

export default function RulesScreen() {
  const { t } = useTranslation();

  const melds = [
    { desc: t('rules.meldPaar'), points: `20 (40 ${t('rules.trumpSuffix')})` },
    { desc: t('rules.meldFamilie'), points: `100 (150 ${t('rules.trumpSuffix')})` },
    { desc: t('rules.meldBinokel'), points: '40' },
    { desc: t('rules.meldDoppelBinokel'), points: '300' },
    { desc: t('rules.meldFour'), points: '100 / 80 / 60 / 40' },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.appTitle}>Dabb</Text>

      <View style={styles.card}>
        <Text style={styles.title}>{t('rules.title')}</Text>

        <Text style={styles.sectionHeader}>{t('rules.sectionGoal')}</Text>
        <Text style={styles.body}>{t('rules.goal')}</Text>

        <Text style={styles.sectionHeader}>{t('rules.sectionBidding')}</Text>
        <Text style={styles.body}>{t('rules.bidding')}</Text>

        <Text style={styles.sectionHeader}>{t('rules.melds')}</Text>
        <Text style={styles.body}>{t('rules.meldsIntro')}</Text>

        <View style={styles.table}>
          {melds.map((meld, i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
              <Text style={styles.tableCellDesc}>{meld.desc}</Text>
              <Text style={styles.tableCellPoints}>{meld.points}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionHeader}>{t('rules.sectionTricks')}</Text>
        <Text style={styles.body}>{t('rules.tricks')}</Text>
        <Text style={styles.cardValues}>{t('rules.cardValues')}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.woodDark,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  appTitle: {
    fontFamily: Fonts.display,
    fontSize: 28,
    color: Colors.paperFace,
    textAlign: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  card: {
    backgroundColor: Colors.paperFace,
    borderRadius: 12,
    padding: 20,
  },
  title: {
    fontFamily: Fonts.bodyBold,
    fontSize: 18,
    color: Colors.inkDark,
    marginBottom: 20,
  },
  sectionHeader: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 6,
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkMid,
    lineHeight: 22,
  },
  table: {
    marginTop: 10,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.paperEdge,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: Colors.paperFace,
  },
  tableRowAlt: {
    backgroundColor: Colors.paperAged,
  },
  tableCellDesc: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.inkMid,
  },
  tableCellPoints: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.inkDark,
    textAlign: 'right',
    marginLeft: 8,
  },
  cardValues: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.inkFaint,
    marginTop: 10,
  },
});
