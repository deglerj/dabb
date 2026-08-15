import { TouchableOpacity, triggerHaptic, type TouchableOpacityProps } from '@dabb/rn-compat';

export function HapticTouchableOpacity({ onPress, ...props }: TouchableOpacityProps) {
  const handlePress: TouchableOpacityProps['onPress'] = (event) => {
    triggerHaptic('card-select');
    onPress?.(event);
  };

  return <TouchableOpacity onPress={handlePress} {...props} />;
}
