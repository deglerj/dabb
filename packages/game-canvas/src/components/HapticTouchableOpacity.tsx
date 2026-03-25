import React from 'react';
import { TouchableOpacity, type TouchableOpacityProps } from 'react-native';
import * as Haptics from 'expo-haptics';

interface HapticTouchableOpacityProps extends TouchableOpacityProps {
  hapticsEnabled?: boolean;
}

export function HapticTouchableOpacity({
  hapticsEnabled = true,
  onPress,
  ...props
}: HapticTouchableOpacityProps) {
  const handlePress: TouchableOpacityProps['onPress'] = (event) => {
    if (hapticsEnabled) {
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // Fail silently
      }
    }
    onPress?.(event);
  };

  return <TouchableOpacity onPress={handlePress} {...props} />;
}
