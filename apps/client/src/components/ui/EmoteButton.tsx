/**
 * Emote picker — the game's only player-to-player channel.
 *
 * Tapping opens a vertical menu of the fixed emote set, each entry a glyph plus the short
 * phrase it stands for; picking one sends it and closes the menu. While the player's own
 * emote is live the button wears it, which is the only feedback they get that the send
 * landed (their own seat has no nameplate to hang a bubble on).
 *
 * The menu is absolutely positioned so opening it cannot push the options button sideways
 * or reflow the scoreboard strip it hangs under.
 *
 * Render inside a View with position: 'absolute' applied externally, alongside OptionsButton.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, triggerHaptic } from '@dabb/rn-compat';
import { useTranslation } from '@dabb/i18n';
import type { EmoteKey } from '@dabb/shared-types';
import { EMOTE_GLYPH, EMOTE_KEYS } from '@dabb/shared-types';
import { TOP_RIGHT_CONTROLS_SIZE } from '../../constants.js';

/**
 * Minimum gap between two sends. Emotes are broadcast to everyone with no way to mute a
 * single player, so the rate limit is the only thing standing between the table and someone
 * machine-gunning 🤦 at whoever is thinking.
 */
const COOLDOWN_MS = 3000;

export interface EmoteButtonProps {
  onSendEmote: (key: EmoteKey) => void;
  /** The local player's own live emote, shown on the button face. */
  activeEmote?: EmoteKey;
}

export function EmoteButton({ onSendEmote, activeEmote }: EmoteButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const lastSentAt = useRef(0);

  const handlePick = useCallback(
    (key: EmoteKey) => {
      setOpen(false);
      const now = Date.now();
      if (now - lastSentAt.current < COOLDOWN_MS) {
        return;
      }
      lastSentAt.current = now;
      triggerHaptic('card-select');
      onSendEmote(key);
    },
    [onSendEmote]
  );

  // Tap anywhere else to dismiss. A document listener rather than a full-screen backdrop
  // view: the backdrop would have to sit above the table to catch the tap, and would then
  // swallow the first tap on a card every time the menu happened to be open.
  useEffect(() => {
    if (!open) {
      return;
    }
    const close = () => setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    // Taps inside the picker must not reach the dismiss listener above. pointerdown fires
    // before click, so without this the button's own tap would close and immediately
    // reopen the menu, leaving it stuck open.
    <View style={styles.anchor} onPointerDown={(e) => e.stopPropagation()}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setOpen((v) => !v)}
        accessibilityLabel={open ? t('emotes.close') : t('emotes.open')}
      >
        <Text style={styles.glyph}>{activeEmote ? EMOTE_GLYPH[activeEmote] : '🙂'}</Text>
      </TouchableOpacity>
      {/* Kept mounted and merely transparent rather than conditionally rendered — see
          convention 2 in CLAUDE.md. */}
      <View
        style={[styles.menu, !open && styles.menuHidden]}
        pointerEvents={open ? 'auto' : 'none'}
      >
        {EMOTE_KEYS.map((key) => (
          <TouchableOpacity key={key} style={styles.menuItem} onPress={() => handlePick(key)}>
            <Text style={styles.glyph}>{EMOTE_GLYPH[key]}</Text>
            <Text style={styles.menuLabel} numberOfLines={1}>
              {t(`emotes.${key}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'relative' },
  menu: {
    position: 'absolute',
    top: TOP_RIGHT_CONTROLS_SIZE + 6,
    right: 0,
    backgroundColor: 'rgba(20,10,4,0.95)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c8b090',
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  menuHidden: { opacity: 0 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  menuLabel: {
    fontSize: 13,
    color: '#f2e8d0',
    // Wide enough for the longest phrase in either language, so the menu keeps one width.
    minWidth: 96,
  },
  button: {
    // Sized to sit inside the scoreboard strip, and no hitSlop: hitSlop is implemented as
    // negative margins, which pulled this button and the options button on top of each other.
    width: TOP_RIGHT_CONTROLS_SIZE,
    height: TOP_RIGHT_CONTROLS_SIZE,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 18 },
});
