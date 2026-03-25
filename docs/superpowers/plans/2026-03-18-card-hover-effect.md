# Card Hover Effect Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an animated hover effect to player hand cards on web — the card lifts up, scales slightly, and straightens its rotation when the cursor moves over it.

**Architecture:** All changes are self-contained in `CardView.tsx`. Four new Reanimated shared values drive the animation; `mouseenter`/`mouseleave` DOM events (web only) trigger them. A separate `useEffect` with `[targetRotation]` in its dependency array handles the wiring so the rotation delta is always fresh.

**Tech Stack:** React Native Reanimated (`useSharedValue`, `useAnimatedStyle`, `withTiming`, `Easing`), `react-native-gesture-handler`, DOM event listeners via `viewRef`.

---

### Task 1: Add hover animation to `CardView`

**Files:**

- Modify: `packages/game-canvas/src/cards/CardView.tsx`

No automated tests are applicable — this is a pure visual/DOM interaction change with no logic to unit-test. Verification is manual (see the checklist at the end).

- [ ] **Step 1: Add four new shared values and a `isHovered` ref**

Open `packages/game-canvas/src/cards/CardView.tsx`. After the existing shared value declarations (lines ~61–66), add:

```ts
const hoverLiftY = useSharedValue(0);
const hoverScaleMult = useSharedValue(1);
const hoverRotDelta = useSharedValue(0);
const hoverZ = useSharedValue(0); // always plain integer — CSS z-index does not interpolate
const isHovered = useRef(false);
```

- [ ] **Step 2: Update `animatedStyle` to include hover values**

Replace the existing `animatedStyle` `useAnimatedStyle` block with:

```ts
const animatedStyle = useAnimatedStyle(() => ({
  position: 'absolute' as const,
  left: x.value + translateX.value,
  top: y.value + translateY.value + hoverLiftY.value,
  zIndex: zIndex + hoverZ.value,
  // perspective forces Firefox into 3D compositing path (DEAA anti-aliasing)
  transform: [
    { perspective: 1000 },
    { rotate: `${rotation.value - hoverRotDelta.value}deg` },
    { scale: scale.value * hoverScaleMult.value },
  ],
  backfaceVisibility: 'hidden' as const,
}));
```

- [ ] **Step 3: Add the hover `useEffect`**

Add a new `useEffect` below the existing two (after line ~102). It must have `[targetRotation]` in its dependency array:

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
    hoverZ.value = 1000; // instant — no withTiming
  };

  let leaveTimer: ReturnType<typeof setTimeout> | undefined;

  const onLeave = () => {
    isHovered.current = false;
    hoverLiftY.value = withTiming(0, cfg);
    hoverScaleMult.value = withTiming(1, cfg);
    hoverRotDelta.value = withTiming(0, cfg);
    leaveTimer = setTimeout(() => {
      hoverZ.value = 0;
    }, ANIM_MS); // defer until animation completes so card stays on top
  };

  el.addEventListener('mouseenter', onEnter);
  el.addEventListener('mouseleave', onLeave);

  // targetRotation changed while cursor is still over this card — snap delta immediately
  // so the card stays at 0° rotation. Known: rotation.value is mid-animation at this point,
  // so a brief (~150 ms) non-zero net rotation is possible before it catches up. Accepted.
  if (isHovered.current) {
    hoverRotDelta.value = targetRotation; // snap, no animation
  }

  return () => {
    el.removeEventListener('mouseenter', onEnter);
    el.removeEventListener('mouseleave', onLeave);
    clearTimeout(leaveTimer); // prevent stale hoverZ write after unmount
    // isHovered is intentionally NOT reset: the cleanup + re-run is synchronous,
    // so no mouseleave fires between them, and the ref stays accurate.
  };
}, [targetRotation]);
```

- [ ] **Step 4: Verify the build passes**

```bash
pnpm run build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add packages/game-canvas/src/cards/CardView.tsx
git commit -m "feat(client): add hover lift animation to player hand cards on web"
```

---

### Manual Verification Checklist

Start the web dev server (`pnpm --filter @dabb/client start`) and join a game. Verify:

1. **Basic hover** — hovering any card in hand shows it lifting ~18px upward, scaling to ~1.05×, and rotation straightening to 0°. Animation is smooth (~150 ms).
2. **Leave** — moving the cursor off a card animates it back to its resting position. The card stays above siblings while animating down.
3. **Fast movement** — quickly sweeping the cursor over multiple cards leaves no card stuck in hover state.
4. **Drag** — starting a drag on a card clears the hover lift (card returns to resting transform while being dragged, or mouseleave clears it).
5. **Re-fan** — play a card to re-fan the hand while hovering another card. The hovered card should stay at 0° rotation without a visible glitch (a brief flicker of ~1–2° is acceptable per the spec).
6. **Phases** — hover works the same in all phases (bidding, dabb, melding, tricks) since `CardView` is phase-agnostic.
7. **Mobile** — on the native app there is no hover effect (cards behave exactly as before).
