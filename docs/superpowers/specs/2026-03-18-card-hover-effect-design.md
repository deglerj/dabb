# Card Hover Effect — Design Spec

**Date:** 2026-03-18
**Status:** Approved

## Summary

Cards in the player's hand gain an animated hover effect on web. When the user moves their cursor over a card it lifts upward, scales slightly, and straightens its rotation — mimicking a player picking a card up for a better look. The animation reverses when the cursor leaves.

## Scope

- **Platform:** Web only (`Platform.OS === 'web'`). No change on Android or iOS.
- **File changed:** `packages/game-canvas/src/cards/CardView.tsx` only. `PlayerHand` and all consumers are untouched.

## Hover Parameters

| Property                            | Resting | Hovered                                     |
| ----------------------------------- | ------- | ------------------------------------------- |
| Y offset (`hoverLiftY`)             | 0       | −18 px                                      |
| Scale multiplier (`hoverScaleMult`) | 1       | 1.05                                        |
| Rotation delta (`hoverRotDelta`)    | 0       | `targetRotation` (zeroes out the fan angle) |
| z-index boost (`hoverZ`)            | 0       | 1000                                        |

Animation: `withTiming`, duration 150 ms, `Easing.out(Easing.quad)` — same curve in both directions.

## Implementation

### New shared values in `CardView`

```ts
const hoverLiftY = useSharedValue(0);
const hoverScaleMult = useSharedValue(1);
const hoverRotDelta = useSharedValue(0);
const hoverZ = useSharedValue(0);
```

### Updated `animatedStyle`

```ts
const animatedStyle = useAnimatedStyle(() => ({
  position: 'absolute' as const,
  left: x.value + translateX.value,
  top: y.value + translateY.value + hoverLiftY.value,
  zIndex: zIndex + hoverZ.value,
  transform: [
    { perspective: 1000 },
    { rotate: `${rotation.value - hoverRotDelta.value}deg` },
    { scale: scale.value * hoverScaleMult.value },
  ],
  backfaceVisibility: 'hidden' as const,
}));
```

### Event wiring (web only)

Added inside the existing web `useEffect` (the one that sets `outline` / `will-change`), alongside the existing DOM mutations:

```ts
const cfg = { duration: 150, easing: Easing.out(Easing.quad) };

const onEnter = () => {
  hoverLiftY.value = withTiming(-18, cfg);
  hoverScaleMult.value = withTiming(1.05, cfg);
  hoverRotDelta.value = withTiming(targetRotation, cfg);
  hoverZ.value = withTiming(1000, cfg);
};
const onLeave = () => {
  hoverLiftY.value = withTiming(0, cfg);
  hoverScaleMult.value = withTiming(1, cfg);
  hoverRotDelta.value = withTiming(0, cfg);
  hoverZ.value = withTiming(0, cfg);
};

el.addEventListener('mouseenter', onEnter);
el.addEventListener('mouseleave', onLeave);

return () => {
  el.removeEventListener('mouseenter', onEnter);
  el.removeEventListener('mouseleave', onLeave);
};
```

**Note:** `targetRotation` is captured in the closure at effect-setup time. The effect re-runs whenever `targetRotation` changes (it is in the dependency array), so the listeners are always referencing the current value.

## Interaction with existing gestures

- **Drag:** The pan gesture sets `scale.value` directly; `hoverScaleMult` is a separate multiplier so they compose correctly (`scale.value * hoverScaleMult.value`). During a drag the cursor leaves the element, so hover state naturally clears.
- **Dimmed cards:** Dimmed cards (invalid plays) receive the same hover effect — the effect is purely visual lift and does not imply interactivity.
- **z-index:** Boosting to `zIndex + 1000` ensures the hovered card floats above all siblings regardless of their base z-index.

## Testing

No automated tests required — this is a pure visual/interaction change with no logic. Manual verification on the web client is sufficient: hover cards in all game phases and confirm the animation plays correctly.
