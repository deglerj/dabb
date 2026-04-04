/**
 * Privacy policy — accessible at /privacy on web.
 * Required as a public URL by the Google Play Store listing.
 */
import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../theme.js';

const PRIVACY_DE = `Diese App speichert keine personenbezogenen Daten dauerhaft. Beim Erstellen oder Beitreten einer Spielrunde wird ein frei gewählter Spitzname an den Spielserver übertragen und dort für die Dauer der Spielsitzung gespeichert. Nach Beendigung der Sitzung werden diese Daten gelöscht. Es werden keine Konten erstellt, keine E-Mail-Adressen erhoben und keine Daten an Dritte weitergegeben.`;

const PRIVACY_EN = `This app does not store any personal data permanently. When creating or joining a game session, a freely chosen nickname is transmitted to the game server and stored for the duration of that session. Once the session ends, this data is deleted. No accounts are created, no email addresses are collected, and no data is shared with third parties.`;

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.appTitle}>Dabb</Text>

      <View style={styles.section}>
        <Text style={styles.heading}>Datenschutzerklärung</Text>
        <Text style={styles.body}>{PRIVACY_DE}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.heading}>Privacy Policy</Text>
        <Text style={styles.body}>{PRIVACY_EN}</Text>
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
  section: {
    backgroundColor: Colors.paperFace,
    borderRadius: 12,
    padding: 20,
  },
  heading: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.inkDark,
    marginBottom: 12,
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkMid,
    lineHeight: 22,
  },
  divider: {
    height: 16,
  },
});
