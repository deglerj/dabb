# Card Hover Effect — Design Spec

**Date:** 2026-03-18
**Status:** Approved

## Summary

Cards in the player's hand gain an animated hover effect on web. When the user moves their cursor over a card it lifts upward, scales slightly, and straightens its rotation — mimicking a player picking a card up for a better look. The animation reverses when the cursor leaves.

## Scope

- **Platform:** Web only (`Platform.OS === 'web'`). No change on Android or iOS.
- **File changed:** `packages/game-canvas/src/cards/CardView.tsx` only. `PlayerHand` and all consumers are untouched.

## Hover Parameters

| Property                            | Resting  | Hovered                                                 |
| ----------------------------------- | -------- | ------------------------------------------------------- |
| Y offset (`hoverLiftY`)             | 0        | −18 px                                                  |
| Scale multiplier (`hoverScaleMult`) | 1        | 1.05                                                    |
| Rotation delta (`hoverRotDelta`)    | 0        | `targetRotation` (zeroes out the fan angle)             |
| z-index boost (`hoverZ`)            | 0 → 1000 | instant on enter; reset after leave animation completes |

Animation for lift/scale/rotation: `withTiming`, duration 150 ms, `Easing.out(Easing.quad)` — same curve in both directions.

**z-index strategy:** `hoverZ` is set to 1000 instantly on `mouseenter` so the card floats above siblings from the first frame. On `mouseleave` it is reset to 0 via a 150 ms `setTimeout` (matching the animation duration), so the card stays on top while animating back down. This is deliberate — fractional-z-index animation is avoided entirely.

## Implementation

### New state in `CardView`

```ts
const hoverLiftY = useSharedValue(0);
const hoverScaleMult = useSharedValue(1);
const hoverRotDelta = useSharedValue(0);
const hoverZ = useSharedValue(0); // always written as plain integer, never withTiming — CSS z-index does not interpolate
const isHovered = useRef(false);
```

`isHovered` is **not** reset in effect cleanup. The React effect cleanup + re-run cycle is synchronous within a single commit; no `mouseleave` event fires between cleanup and the new effect body, so the ref correctly reflects whether the cursor is still over the card. Card components are not remounted while visible in normal gameplay, so the unmount-while-hovered edge case does not arise.

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

### Event wiring (web only) — dedicated `useEffect`

The hover listeners live in their own `useEffect` with `[targetRotation]` in the dependency array (separate from the existing empty-dependency effect that sets `outline`/`will-change`). Using closure capture rather than a ref for `targetRotation` is intentional: fan-angle changes are infrequent and the re-attach cost is negligible.

```ts
useEffect(() => {
  if (Platform.OS !== 'web') return;
  const el = viewRef.current as unknown as HTMLElement | null;
  if (!el?.style) return;

  const ANIM_MS = 150;
  const cfg = { duration: ANIM_MS, easing: Easing.out(Easing.quad) };

  const onEnter = () => {
    isHovered.current = true;
    hoverLiftY.value = withTiming(-18, cfg);
    hoverScaleMult.value = withTiming(1.05, cfg);
    hoverRotDelta.value = withTiming(targetRotation, cfg);
    hoverZ.value = 1000; // instant z-index promotion
  };

  let leaveTimer: ReturnType<typeof setTimeout> | undefined;

  const onLeave = () => {
    isHovered.current = false;
    hoverLiftY.value = withTiming(0, cfg);
    hoverScaleMult.value = withTiming(1, cfg);
    hoverRotDelta.value = withTiming(0, cfg);
    leaveTimer = setTimeout(() => {
      hoverZ.value = 0;
    }, ANIM_MS); // reset after animation
  };

  el.addEventListener('mouseenter', onEnter);
  el.addEventListener('mouseleave', onLeave);

  // If targetRotation changed while this card is still hovered, snap hoverRotDelta
  // immediately to the new value so the card stays at 0°.
  // Known limitation: rotation.value is still mid-animation to the new targetRotation
  // at this point, so the card may show a brief non-zero net rotation before rotation.value
  // catches up (~150 ms). Accepted as a minor visual artifact on an infrequent event.
  if (isHovered.current) {
    hoverRotDelta.value = targetRotation; // snap, no animation
  }

  return () => {
    el.removeEventListener('mouseenter', onEnter);
    el.removeEventListener('mouseleave', onLeave);
    clearTimeout(leaveTimer); // prevent stale hoverZ write after unmount
    // isHovered is not reset here — see note above
  };
}, [targetRotation]); // re-attach whenever fan angle changes
```

## Interaction with existing gestures

- **Drag:** The pan gesture sets `scale.value` directly; `hoverScaleMult` is a separate multiplier so they compose correctly. Most browsers fire `mouseleave` when a drag starts, clearing hover state naturally. Manual testing should verify this.
- **Dimmed cards:** Dimmed cards (invalid plays) receive the same hover effect — purely cosmetic, no interactivity implied.
- **z-index:** Instant promotion on enter, deferred reset on leave, ensures the card is never obscured during either half of the animation.
- **Unmount while hovered:** Cleanup removes both listeners, preventing leaks. `hoverZ`/`hoverLiftY`/etc. are garbage-collected with the component.

## Testing

No automated tests required — this is a pure visual/interaction change with no logic. Manual verification on the web client:

1. Hover cards in all game phases — confirm lift/scale/straighten animation plays and reverses.
2. Move cursor quickly between cards — confirm no stuck hover states.
3. Start a drag — confirm hover clears when drag begins and card returns to resting position.
4. Play a card to re-fan the hand while hovering another card — confirm the hovered card stays at exactly 0° rotation (no intermediate angle) and remains lifted until the cursor leaves.
