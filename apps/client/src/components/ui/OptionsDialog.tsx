/**
 * Options dialog — sound toggle, vibration toggle (native only), language selector.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { Modal, View, Text, Switch, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation, i18n, persistLanguage, type SupportedLanguage } from '@dabb/i18n';
import { isMuted, setMuted } from '../../utils/sounds.js';
import { isHapticsEnabled, setHapticsEnabled } from '../../utils/haptics.js';
import { Colors, Fonts, Shadows } from '../../theme.js';

interface OptionsDialogProps {
  visible: boolean;
  onClose: () => void;
  onExitGame?: () => void;
}

export function OptionsDialog({ visible, onClose, onExitGame }: OptionsDialogProps) {
  const { t } = useTranslation();

  // Read current values when dialog renders
  const [soundEnabled, setSoundEnabled] = useState(() => !isMuted());
  const [hapticsEnabled, setHapticsEnabledState] = useState(() => isHapticsEnabled());
  const [language, setLanguage] = useState<SupportedLanguage>(
    () => (i18n.language as SupportedLanguage) ?? 'de'
  );
  const [confirmingExit, setConfirmingExit] = useState(false);

  // Reset state when dialog is re-opened to avoid showing stale values
  useEffect(() => {
    if (visible) {
      setSoundEnabled(!isMuted());
      setHapticsEnabledState(isHapticsEnabled());
      setLanguage((i18n.language as SupportedLanguage) ?? 'de');
      setConfirmingExit(false);
    }
  }, [visible]);

  const handleSoundToggle = useCallback((value: boolean) => {
    setSoundEnabled(value);
    void setMuted(!value);
  }, []);

  const handleHapticsToggle = useCallback((value: boolean) => {
    setHapticsEnabledState(value);
    void setHapticsEnabled(value);
  }, []);

  const handleLanguageSelect = useCallback((lang: SupportedLanguage) => {
    setLanguage(lang);
    void i18n.changeLanguage(lang);
    persistLanguage(lang);
  }, []);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => undefined}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('options.title')}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={8}>
              <Feather name="x" size={18} color={Colors.inkMid} />
            </TouchableOpacity>
          </View>

          {/* Sound row */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>🔊 {t('options.sound')}</Text>
            <Switch
              value={soundEnabled}
              onValueChange={handleSoundToggle}
              trackColor={{ false: Colors.paperEdge, true: Colors.amber }}
              thumbColor={Colors.paperFace}
            />
          </View>

          {/* Vibration row — native only. Platform.OS is a compile-time constant so this
              conditional mount does not cause layout shifts at runtime. */}
          {Platform.OS !== 'web' && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>📳 {t('options.vibration')}</Text>
              <Switch
                value={hapticsEnabled}
                onValueChange={handleHapticsToggle}
                trackColor={{ false: Colors.paperEdge, true: Colors.amber }}
                thumbColor={Colors.paperFace}
              />
            </View>
          )}

          {/* Language section */}
          <View style={styles.languageSection}>
            <Text style={styles.languageLabel}>{t('options.language')}</Text>
            <View style={styles.flagRow}>
              {(['de', 'en'] as SupportedLanguage[]).map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[styles.flagButton, language === lang && styles.flagButtonSelected]}
                  onPress={() => handleLanguageSelect(lang)}
                >
                  <Text style={styles.flagEmoji}>{lang === 'de' ? '🇩🇪' : '🇬🇧'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {onExitGame && (
            <>
              <View style={styles.divider} />
              {!confirmingExit ? (
                <TouchableOpacity style={styles.exitButton} onPress={() => setConfirmingExit(true)}>
                  <Text style={styles.exitButtonLabel}>{t('options.exitGame')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.exitConfirm}>
                  <Text style={styles.exitConfirmTitle}>{t('options.exitGameConfirmTitle')}</Text>
                  <Text style={styles.exitConfirmMessage}>
                    {t('options.exitGameConfirmMessage')}
                  </Text>
                  <View style={styles.exitConfirmButtons}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setConfirmingExit(false)}
                    >
                      <Text style={styles.cancelButtonLabel}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.exitButtonConfirm}
                      onPress={() => {
                        onClose();
                        onExitGame();
                      }}
                    >
                      <Text style={styles.exitButtonLabel}>{t('options.exitGame')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.paperFace,
    borderRadius: 12,
    padding: 20,
    width: 280,
    ...Shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.paperEdge,
  },
  title: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.inkDark,
  },
  closeButton: {
    backgroundColor: Colors.paperAged,
    borderRadius: 6,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  rowLabel: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkDark,
  },
  languageSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.paperEdge,
    paddingTop: 14,
    marginTop: 2,
  },
  languageLabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  flagRow: {
    flexDirection: 'row',
    gap: 8,
  },
  flagButton: {
    backgroundColor: Colors.paperAged,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    opacity: 0.5,
  },
  flagButtonSelected: {
    backgroundColor: Colors.paperAged,
    borderColor: Colors.amber,
    opacity: 1,
  },
  flagEmoji: {
    fontSize: 22,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.paperEdge,
    marginTop: 14,
    marginBottom: 14,
  },
  exitButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  exitButtonLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: '#d32f2f',
  },
  exitConfirm: {
    alignItems: 'center',
    gap: 6,
  },
  exitConfirmTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.inkDark,
  },
  exitConfirmMessage: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkMid,
    textAlign: 'center',
  },
  exitConfirmButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: Colors.paperAged,
  },
  cancelButtonLabel: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkDark,
  },
  exitButtonConfirm: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#fdecea',
  },
});
