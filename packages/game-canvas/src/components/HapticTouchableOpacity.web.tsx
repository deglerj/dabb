import React from 'react';
import { TouchableOpacity, type TouchableOpacityProps } from 'react-native';

interface HapticTouchableOpacityProps extends TouchableOpacityProps {
  hapticsEnabled?: boolean;
}

export function HapticTouchableOpacity({
  hapticsEnabled: _hapticsEnabled,
  ...props
}: HapticTouchableOpacityProps) {
  return <TouchableOpacity {...props} />;
}
