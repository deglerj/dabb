import type { HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ensureBaseCss } from './baseCss.js';
import { flattenStyle, hitSlopStyle, type HitSlop, type StyleProp } from './styles.js';

export { StyleSheet } from './styles.js';
export type { Style, StyleProp } from './styles.js';
export type { Style as ViewStyle, Style as TextStyle } from './styles.js';
export { useWindowDimensions, useSafeAreaInsets } from './hooks.js';
export type { SafeAreaInsets } from './hooks.js';

// ---------------------------------------------------------------------------
// View / Text
// ---------------------------------------------------------------------------

export interface ViewProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style'> {
  style?: StyleProp;
  pointerEvents?: 'auto' | 'none' | 'box-none';
  testID?: string;
}

export const View = forwardRef<HTMLDivElement, ViewProps>(function View(
  { style, pointerEvents, testID, className, children, ...rest },
  ref
) {
  ensureBaseCss();
  const classes = ['rn-box', pointerEvents === 'box-none' ? 'rn-box-none' : '', className]
    .filter(Boolean)
    .join(' ');
  const inlineStyle = flattenStyle(style);
  const finalStyle =
    pointerEvents && pointerEvents !== 'box-none' ? { pointerEvents, ...inlineStyle } : inlineStyle;
  return (
    <div ref={ref} className={classes} data-testid={testID} style={finalStyle} {...rest}>
      {children}
    </div>
  );
});

export interface TextProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style'> {
  style?: StyleProp;
  numberOfLines?: number;
  testID?: string;
}

export const Text = forwardRef<HTMLDivElement, TextProps>(function Text(
  { style, numberOfLines, testID, className, children, ...rest },
  ref
) {
  ensureBaseCss();
  const classes = ['rn-text', numberOfLines === 1 ? 'rn-truncate' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} data-testid={testID} style={flattenStyle(style)} {...rest}>
      {children}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Pressable / TouchableOpacity
//
// onClick calls stopPropagation() before invoking onPress: RN's touch responder system
// gives the deepest matching view sole ownership of a touch, unlike DOM click bubbling.
// Several screens nest a "card" touchable inside a backdrop touchable (tap-outside-to-close)
// relying on that RN behavior — without stopPropagation, clicking the card would also fire
// the backdrop's onPress and close the dialog underneath it.
// ---------------------------------------------------------------------------

export interface PressableStateCallbackType {
  pressed: boolean;
}

export interface PressableProps {
  style?: StyleProp | ((state: PressableStateCallbackType) => StyleProp);
  onPress?: (e: MouseEvent<HTMLDivElement>) => void;
  disabled?: boolean;
  hitSlop?: HitSlop;
  testID?: string;
  accessibilityRole?: string;
  /** Maps to aria-label. Required in practice for buttons whose only content is an icon or emoji. */
  accessibilityLabel?: string;
  children?: ReactNode | ((state: PressableStateCallbackType) => ReactNode);
}

export interface TouchableOpacityProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp;
  activeOpacity?: number;
  children?: ReactNode;
}

function activationKeyDown<T extends HTMLElement>(
  e: KeyboardEvent<T>,
  onPress?: (e: MouseEvent<T>) => void
) {
  if (e.key !== 'Enter' && e.key !== ' ') {
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  onPress?.(e as unknown as MouseEvent<T>);
}

/**
 * The pressable div behind both exports below.
 *
 * `activeOpacity` is what separates them: TouchableOpacity dims while held, via CSS on the
 * `rn-touchable` class, and Pressable instead reports `pressed` so the caller can swap
 * styles itself. Tracking the pressed state costs a render per press, so it is only wired
 * up when something actually asks for it.
 */
function pressableDiv({
  style,
  onPress,
  disabled,
  hitSlop,
  testID,
  accessibilityRole,
  accessibilityLabel,
  children,
  activeOpacity,
  reportPressed,
}: PressableProps & { activeOpacity?: number; reportPressed: boolean }) {
  const [pressed, setPressed] = useState(false);
  const resolvedStyle = typeof style === 'function' ? style({ pressed }) : style;
  const resolvedChildren = typeof children === 'function' ? children({ pressed }) : children;
  const track = reportPressed
    ? {
        onPointerDown: () => setPressed(true),
        onPointerUp: () => setPressed(false),
        onPointerLeave: () => setPressed(false),
      }
    : {};

  return (
    <div
      role={accessibilityRole ?? 'button'}
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={accessibilityLabel}
      className={
        activeOpacity === undefined ? 'rn-box rn-pressable' : 'rn-box rn-pressable rn-touchable'
      }
      data-testid={testID}
      style={{
        ...(activeOpacity === undefined
          ? {}
          : { ['--rn-active-opacity' as string]: activeOpacity }),
        ...hitSlopStyle(hitSlop),
        ...flattenStyle(resolvedStyle),
      }}
      {...track}
      onKeyDown={disabled ? undefined : (e) => activationKeyDown(e, onPress)}
      onClick={
        disabled
          ? undefined
          : (e) => {
              e.stopPropagation();
              onPress?.(e);
            }
      }
    >
      {resolvedChildren}
    </div>
  );
}

/** Reports its pressed state to `style`/`children` callbacks; applies no effect of its own. */
export function Pressable(props: PressableProps) {
  ensureBaseCss();
  return pressableDiv({ ...props, reportPressed: true });
}

/** Dims while held. Pass `activeOpacity={1}` for a tap target that should not visibly react. */
export function TouchableOpacity({ activeOpacity = 0.2, ...props }: TouchableOpacityProps) {
  ensureBaseCss();
  return pressableDiv({ ...props, activeOpacity, reportPressed: false });
}

// ---------------------------------------------------------------------------
// ScrollView
// ---------------------------------------------------------------------------

export interface NativeScrollEvent {
  contentOffset: { x: number; y: number };
  contentSize: { width: number; height: number };
  layoutMeasurement: { width: number; height: number };
}

export interface NativeSyntheticEvent<T> {
  nativeEvent: T;
}

export interface ScrollViewHandle {
  scrollToEnd: (options?: { animated?: boolean }) => void;
}

export interface ScrollViewProps {
  style?: StyleProp;
  contentContainerStyle?: StyleProp;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  horizontal?: boolean;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
  children?: ReactNode;
}

export const ScrollView = forwardRef<ScrollViewHandle, ScrollViewProps>(function ScrollView(
  {
    style,
    contentContainerStyle,
    showsVerticalScrollIndicator = true,
    showsHorizontalScrollIndicator = true,
    horizontal = false,
    onScroll,
    children,
  },
  ref
) {
  ensureBaseCss();
  const elRef = useRef<HTMLDivElement>(null);
  const showsScrollIndicator = horizontal
    ? showsHorizontalScrollIndicator
    : showsVerticalScrollIndicator;

  useImperativeHandle(
    ref,
    () => ({
      scrollToEnd: ({ animated = true } = {}) => {
        const el = elRef.current;
        if (!el) {
          return;
        }
        if (horizontal) {
          el.scrollTo({ left: el.scrollWidth, behavior: animated ? 'smooth' : 'auto' });
        } else {
          el.scrollTo({ top: el.scrollHeight, behavior: animated ? 'smooth' : 'auto' });
        }
      },
    }),
    [horizontal]
  );

  const classes = ['rn-box', 'rn-scroll', showsScrollIndicator ? '' : 'rn-scroll-hide']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={elRef}
      className={classes}
      style={
        horizontal
          ? { overflowX: 'auto', ...flattenStyle(style) }
          : { overflowY: 'auto', ...flattenStyle(style) }
      }
      onScroll={
        onScroll
          ? (e) => {
              const el = e.currentTarget;
              onScroll({
                nativeEvent: {
                  contentOffset: { x: el.scrollLeft, y: el.scrollTop },
                  contentSize: { width: el.scrollWidth, height: el.scrollHeight },
                  layoutMeasurement: { width: el.clientWidth, height: el.clientHeight },
                },
              });
            }
          : undefined
      }
    >
      <div
        className="rn-box"
        style={{
          flexDirection: horizontal ? 'row' : 'column',
          ...flattenStyle(contentContainerStyle),
        }}
      >
        {children}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// ActivityIndicator
// ---------------------------------------------------------------------------

export interface ActivityIndicatorProps {
  size?: 'small' | 'large';
  color?: string;
  style?: StyleProp;
}

export function ActivityIndicator({
  size = 'small',
  color = '#999999',
  style,
}: ActivityIndicatorProps) {
  ensureBaseCss();
  const px = size === 'large' ? 36 : 20;
  return (
    <div
      className="rn-spinner"
      style={{ width: px, height: px, borderColor: color, ...flattenStyle(style) }}
    />
  );
}

// ---------------------------------------------------------------------------
// Modal — native <dialog>, gets ESC-to-close and focus trapping for free.
// ---------------------------------------------------------------------------

interface ModalProps {
  visible?: boolean;
  onRequestClose?: () => void;
  children?: ReactNode;
}

export function Modal({ visible = false, onRequestClose, children }: ModalProps) {
  ensureBaseCss();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (visible && !dialog.open) {
      dialog.showModal();
    }
    if (!visible && dialog.open) {
      dialog.close();
    }
  }, [visible]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !onRequestClose) {
      return;
    }
    const handleCancel = () => onRequestClose();
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onRequestClose]);

  return (
    <dialog ref={ref} className="rn-modal-backdrop">
      {children}
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// TextInput
// ---------------------------------------------------------------------------

export interface TextInputProps {
  style?: StyleProp;
  value?: string;
  placeholder?: string;
  placeholderTextColor?: string;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
  testID?: string;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: () => void;
}

export function TextInput({
  style,
  placeholderTextColor,
  autoCorrect,
  secureTextEntry,
  testID,
  onChangeText,
  onSubmitEditing,
  ...rest
}: TextInputProps) {
  ensureBaseCss();
  return (
    <input
      className="rn-textinput"
      type={secureTextEntry ? 'password' : 'text'}
      data-testid={testID}
      autoCorrect={autoCorrect === false ? 'off' : 'on'}
      onChange={(e) => onChangeText?.(e.target.value)}
      onKeyDown={
        onSubmitEditing
          ? (e) => {
              if (e.key === 'Enter') {
                onSubmitEditing();
              }
            }
          : undefined
      }
      style={{ ['--rn-placeholder-color' as string]: placeholderTextColor, ...flattenStyle(style) }}
      {...rest}
    />
  );
}

// ---------------------------------------------------------------------------
// Switch
// ---------------------------------------------------------------------------

export interface SwitchProps {
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  trackColor?: { false?: string; true?: string };
  thumbColor?: string;
  disabled?: boolean;
  testID?: string;
}

export function Switch({
  value = false,
  onValueChange,
  trackColor,
  thumbColor,
  disabled,
  testID,
}: SwitchProps) {
  ensureBaseCss();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      data-testid={testID}
      data-checked={value}
      className="rn-switch-track"
      style={{
        ['--rn-switch-off' as string]: trackColor?.false,
        ['--rn-switch-on' as string]: trackColor?.true,
        ['--rn-switch-thumb' as string]: thumbColor,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onValueChange?.(!value);
      }}
    >
      <span className="rn-switch-thumb" />
    </button>
  );
}
