/**
 * Test setup for React Native mobile app
 * Mocks native modules that don't work in jsdom
 */

import { vi } from 'vitest';
import { initI18n } from '@dabb/i18n';
import '@testing-library/jest-dom/vitest';

// Initialize i18n with German for tests
initI18n('de');

// Mock react-native modules
vi.mock('react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');

  const View = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    const { children, testID, style: _style, ...rest } = props;
    return React.createElement('div', { 'data-testid': testID, ref, ...rest }, children);
  });
  View.displayName = 'View';

  const Text = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    const { children, testID, style: _style, ...rest } = props;
    return React.createElement('span', { 'data-testid': testID, ref, ...rest }, children);
  });
  Text.displayName = 'Text';

  const TouchableOpacity = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    const {
      children,
      testID,
      style: _style,
      onPress,
      disabled,
      activeOpacity: _activeOpacity,
      ...rest
    } = props;
    return React.createElement(
      'button',
      {
        'data-testid': testID,
        onClick: disabled ? undefined : onPress,
        disabled,
        ref,
        ...rest,
      },
      children
    );
  });
  TouchableOpacity.displayName = 'TouchableOpacity';

  const TextInput = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    const {
      testID,
      style: _style,
      value,
      onChangeText,
      placeholder,
      maxLength,
      autoCapitalize: _autoCapitalize,
      ...rest
    } = props;
    return React.createElement('input', {
      'data-testid': testID,
      value,
      placeholder,
      maxLength,
      ref,
      onChange: (e: { target: { value: string } }) =>
        (onChangeText as (text: string) => void)?.(e.target.value),
      ...rest,
    });
  });
  TextInput.displayName = 'TextInput';

  const ScrollView = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    const {
      children,
      testID,
      style: _style,
      contentContainerStyle: _contentContainerStyle,
      horizontal: _horizontal,
      showsHorizontalScrollIndicator: _showsHorizontalScrollIndicator,
      ...rest
    } = props;
    return React.createElement('div', { 'data-testid': testID, ref, ...rest }, children);
  });
  ScrollView.displayName = 'ScrollView';

  const Modal = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    const {
      children,
      visible,
      testID,
      animationType: _animationType,
      transparent: _transparent,
      onRequestClose: _onRequestClose,
      ...rest
    } = props;
    if (!visible) {
      return null;
    }
    return React.createElement(
      'div',
      { 'data-testid': testID || 'modal', ref, role: 'dialog', ...rest },
      children
    );
  });
  Modal.displayName = 'Modal';

  const ActivityIndicator = React.forwardRef((_props: Record<string, unknown>, ref: unknown) => {
    return React.createElement('div', {
      'data-testid': 'activity-indicator',
      ref,
      role: 'progressbar',
    });
  });
  ActivityIndicator.displayName = 'ActivityIndicator';

  const KeyboardAvoidingView = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    const { children, testID, style: _style, behavior: _behavior, ...rest } = props;
    return React.createElement('div', { 'data-testid': testID, ref, ...rest }, children);
  });
  KeyboardAvoidingView.displayName = 'KeyboardAvoidingView';

  return {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Modal,
    ActivityIndicator,
    KeyboardAvoidingView,
    Alert: {
      alert: vi.fn(),
    },
    Share: {
      share: vi.fn(),
    },
    Dimensions: {
      get: () => ({ width: 375, height: 812 }),
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    useWindowDimensions: () => ({ width: 375, height: 812, scale: 1, fontScale: 1 }),
    Platform: {
      OS: 'android',
      select: (obj: Record<string, unknown>) => obj.android,
    },
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T): T => styles,
      flatten: (style: unknown) => style,
    },
    Animated: {
      Value: vi.fn(() => ({
        interpolate: vi.fn(() => 0),
        setValue: vi.fn(),
      })),
      timing: vi.fn(() => ({
        start: vi.fn((cb?: () => void) => cb?.()),
      })),
      spring: vi.fn(() => ({
        start: vi.fn((cb?: () => void) => cb?.()),
      })),
      loop: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
      })),
      sequence: vi.fn(() => ({
        start: vi.fn((cb?: () => void) => cb?.()),
      })),
      parallel: vi.fn(() => ({
        start: vi.fn((cb?: () => void) => cb?.()),
      })),
      View,
      Text,
      createAnimatedComponent: (component: unknown) => component,
    },
  };
});

// Mock @expo/vector-icons
vi.mock('@expo/vector-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    Feather: (props: Record<string, unknown>) =>
      React.createElement('span', {
        'data-testid': `feather-${props.name}`,
        'data-icon': props.name,
      }),
  };
});

// Mock expo-audio
vi.mock('expo-audio', () => ({
  useAudioPlayer: vi.fn(() => ({
    play: vi.fn(),
    pause: vi.fn(),
    seekTo: vi.fn(),
    volume: 1,
  })),
  setAudioModeAsync: vi.fn(),
}));

// Mock react-native-svg
vi.mock('react-native-svg', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const createSvgComponent = (name: string) => (props: Record<string, unknown>) =>
    React.createElement(name.toLowerCase(), props, props.children);

  return {
    default: createSvgComponent('svg'),
    Svg: createSvgComponent('svg'),
    Path: createSvgComponent('path'),
    Ellipse: createSvgComponent('ellipse'),
    Rect: createSvgComponent('rect'),
    Circle: createSvgComponent('circle'),
    Polygon: createSvgComponent('polygon'),
    G: createSvgComponent('g'),
    Line: createSvgComponent('line'),
    Text: createSvgComponent('text'),
    TextPath: createSvgComponent('textpath'),
  };
});

// Mock react-native-safe-area-context
vi.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      const { children, ...rest } = props;
      return React.createElement('div', { ref, ...rest }, children);
    }),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// Mock @react-native-async-storage/async-storage
vi.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    default: {
      getItem: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((key) => delete store[key]);
        return Promise.resolve();
      }),
    },
  };
});

// Mock react-native-gesture-handler
vi.mock('react-native-gesture-handler', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');

  const ScrollView = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    const {
      children,
      testID,
      style: _style,
      contentContainerStyle: _contentContainerStyle,
      horizontal: _horizontal,
      showsHorizontalScrollIndicator: _showsHorizontalScrollIndicator,
      ...rest
    } = props;
    return React.createElement('div', { 'data-testid': testID, ref, ...rest }, children);
  });
  ScrollView.displayName = 'ScrollView';

  const GestureDetector = ({ children }: { children: React.ReactNode }) => children;
  const GestureHandlerRootView = React.forwardRef(
    (props: Record<string, unknown>, ref: unknown) => {
      const { children, ...rest } = props;
      return React.createElement('div', { ref, ...rest }, children);
    }
  );

  const createGesture = () => ({
    enabled: () => createGesture(),
    activeOffsetY: () => createGesture(),
    failOffsetX: () => createGesture(),
    failOffsetY: () => createGesture(),
    onStart: () => createGesture(),
    onUpdate: () => createGesture(),
    onEnd: () => createGesture(),
    onFinalize: () => createGesture(),
  });

  return {
    ScrollView,
    GestureDetector,
    GestureHandlerRootView,
    Gesture: {
      Pan: () => createGesture(),
      Tap: () => createGesture(),
    },
  };
});

// Mock react-native-reanimated
vi.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');

  const View = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    const { children, testID, style: _style, ...rest } = props;
    return React.createElement('div', { 'data-testid': testID, ref, ...rest }, children);
  });
  View.displayName = 'Animated.View';

  return {
    default: { View },
    useSharedValue: (initial: unknown) => ({ value: initial }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withSpring: (val: unknown) => val,
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
  };
});

// Mock the notification sound require
vi.mock('../../assets/sounds/notification.ogg', () => ({}));
