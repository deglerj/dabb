import type { TableEffects } from '../table/useTableEffects.js';

// Upward drag of at least this many px (before ±20px of horizontal drift) activates a play-drag.
// Mirrors the old gesture-handler activeOffsetY(-8)/failOffsetX([-20,20]) config: lets the app
// tell an upward flick-to-play from horizontal hand scrolling.
const PAN_ACTIVATE_DY = -8;
const PAN_FAIL_DX = 20;
// A pointerup within this distance of pointerdown counts as a tap rather than an aborted drag.
const TAP_MAX_DIST = 10;

export interface CardGestureOptions {
  draggable: boolean;
  onTap?: () => void;
  /** x/y are relative to the #game-wrapper element, matching cardPositions/feltBounds space. */
  onDrop?: (x: number, y: number) => void;
  onDragStart?: () => void;
  /** dx/dy are raw pointer deltas since pointerdown (matches CSS left/top translation). */
  onDragMove?: (dx: number, dy: number) => void;
  onDragEnd?: () => void;
  effects?: TableEffects;
}

/** Attaches upward-drag-to-play / tap-to-select handling to a card's DOM element. */
export function attachCardDrag(el: HTMLElement, opts: CardGestureOptions): () => void {
  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) {
      return;
    }
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let panFailed = !opts.draggable;
    let originX = 0;
    let originY = 0;

    el.setPointerCapture(e.pointerId);

    function toLocal(ev: PointerEvent) {
      return { x: ev.clientX - originX, y: ev.clientY - originY };
    }

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (!dragging && !panFailed) {
        if (Math.abs(dx) > PAN_FAIL_DX) {
          panFailed = true;
        } else if (dy <= PAN_ACTIVATE_DY) {
          dragging = true;
          // #game-wrapper is the untransformed ancestor cardPositions/feltBounds are computed
          // relative to. Cards themselves are rotated/scaled, so their own bounding rect can't
          // be used to derive this offset.
          const wrapperRect = document.getElementById('game-wrapper')?.getBoundingClientRect();
          originX = wrapperRect?.left ?? 0;
          originY = wrapperRect?.top ?? 0;
          opts.onDragStart?.();
        }
      }

      if (dragging) {
        opts.onDragMove?.(dx, dy);
        const local = toLocal(ev);
        opts.effects?.triggerCardShadow(local.x, local.y, 1);
      }
    }

    function cleanup() {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
    }

    function onUp(ev: PointerEvent) {
      cleanup();
      if (dragging) {
        opts.onDragEnd?.();
        opts.effects?.clearCardShadow();
        const local = toLocal(ev);
        opts.effects?.triggerFeltRipple(local.x, local.y);
        opts.onDrop?.(local.x, local.y);
      } else {
        const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        if (dist <= TAP_MAX_DIST) {
          opts.onTap?.();
        }
      }
    }

    function onCancel() {
      cleanup();
      if (dragging) {
        opts.onDragEnd?.();
        opts.effects?.clearCardShadow();
      }
    }

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
  }

  el.addEventListener('pointerdown', onPointerDown);
  return () => el.removeEventListener('pointerdown', onPointerDown);
}
