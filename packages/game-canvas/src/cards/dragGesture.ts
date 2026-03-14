import { Gesture } from 'react-native-gesture-handler';
import { withSpring } from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import type { SharedValue } from 'react-native-reanimated';

export interface CardGestureOptions {
  draggable: boolean;
  onTap?: () => void;
  onDrop?: (x: number, y: number) => void;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
}

export function createCardGesture(opts: CardGestureOptions) {
  const tap = Gesture.Tap()
    .enabled(!!opts.onTap)
    .onEnd(() => {
      'worklet';
      if (opts.onTap) {
        runOnJS(opts.onTap)();
      }
    });

  const pan = Gesture.Pan()
    .enabled(opts.draggable)
    .activeOffsetY(-8)
    .failOffsetX([-20, 20])
    .onStart(() => {
      'worklet';
      opts.scale.value = withSpring(1.08, { damping: 15, stiffness: 300 });
    })
    .onUpdate((e) => {
      'worklet';
      opts.translateX.value = e.translationX;
      opts.translateY.value = e.translationY;
    })
    .onEnd((e) => {
      'worklet';
      opts.translateX.value = withSpring(0, { damping: 20, stiffness: 400 });
      opts.translateY.value = withSpring(0, { damping: 20, stiffness: 400 });
      opts.scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      if (opts.onDrop) {
        runOnJS(opts.onDrop)(e.absoluteX, e.absoluteY);
      }
    });

  return Gesture.Exclusive(pan, tap);
}
