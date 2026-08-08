import { TouchableOpacity, type TouchableOpacityProps } from '@dabb/rn-compat';

interface HapticTouchableOpacityProps extends TouchableOpacityProps {
  hapticsEnabled?: boolean;
}

export function HapticTouchableOpacity({
  hapticsEnabled = true,
  onPress,
  ...props
}: HapticTouchableOpacityProps) {
  const handlePress: TouchableOpacityProps['onPress'] = (event) => {
    if (hapticsEnabled && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
    onPress?.(event);
  };

  return <TouchableOpacity onPress={handlePress} {...props} />;
}
