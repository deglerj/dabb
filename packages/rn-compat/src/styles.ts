import type { CSSProperties } from 'react';

/** A single RN `transform: [{ translateY: 1 }, { scale: 2 }]` entry. */
type RNTransform = ReadonlyArray<Record<string, string | number>>;

/**
 * RN StyleSheet shape: mostly plain CSS (camelCase, same names), plus a handful of RN-only
 * shorthands/conventions with no CSS equivalent (paddingHorizontal, textShadowColor, the
 * shadow/elevation family, transform-as-array). flattenStyle() below normalizes all of these
 * into plain CSSProperties, so ~200 existing JSX sites keep using RN-shaped style objects
 * unchanged instead of being rewritten to raw CSS one by one.
 */
export interface Style extends Omit<CSSProperties, 'transform'> {
  transform?: CSSProperties['transform'] | RNTransform;
  paddingHorizontal?: number | string;
  paddingVertical?: number | string;
  marginHorizontal?: number | string;
  marginVertical?: number | string;
  textShadowColor?: string;
  textShadowOffset?: { width: number; height: number };
  textShadowRadius?: number;
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
}

export type StyleProp = Style | false | null | undefined | readonly StyleProp[];

function isSet<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function mergeRaw(style: StyleProp): Style | undefined {
  if (!style) {
    return undefined;
  }
  if (Array.isArray(style)) {
    let result: Style | undefined;
    for (const entry of style) {
      const flat = mergeRaw(entry as StyleProp);
      if (flat) {
        result = result ? { ...result, ...flat } : flat;
      }
    }
    return result;
  }
  return style as Style;
}

function transformToCss(transform: Style['transform']): string | undefined {
  if (!isSet(transform)) {
    return undefined;
  }
  if (typeof transform === 'string') {
    return transform;
  }
  return (transform as RNTransform)
    .map((entry) => {
      const [key, value] = Object.entries(entry)[0] as [string, string | number];
      const isAngleOrScale = /rotate|scale/i.test(key);
      const cssValue = typeof value === 'number' && !isAngleOrScale ? `${value}px` : value;
      return `${key}(${cssValue})`;
    })
    .join(' ');
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function withOpacity(color: string, alpha: number): string {
  if (alpha >= 1 || !color.startsWith('#')) {
    return color;
  }
  return hexToRgba(color, alpha);
}

/** Flattens an RN-style style array (possibly nested, possibly containing falsy entries) into
 * one plain CSSProperties object, converting RN-only shorthands along the way. */
export function flattenStyle(style: StyleProp): CSSProperties | undefined {
  const merged = mergeRaw(style);
  if (!merged) {
    return undefined;
  }

  const {
    paddingHorizontal,
    paddingVertical,
    marginHorizontal,
    marginVertical,
    textShadowColor,
    textShadowOffset,
    textShadowRadius,
    shadowColor,
    shadowOffset,
    shadowOpacity,
    shadowRadius,
    elevation,
    transform,
    ...rest
  } = merged;
  void elevation; // Android-only shadow depth; the boxShadow synthesized below covers the visual.

  const out: CSSProperties = { ...(rest as CSSProperties) };

  if (isSet(paddingHorizontal)) {
    out.paddingLeft = paddingHorizontal;
    out.paddingRight = paddingHorizontal;
  }
  if (isSet(paddingVertical)) {
    out.paddingTop = paddingVertical;
    out.paddingBottom = paddingVertical;
  }
  if (isSet(marginHorizontal)) {
    out.marginLeft = marginHorizontal;
    out.marginRight = marginHorizontal;
  }
  if (isSet(marginVertical)) {
    out.marginTop = marginVertical;
    out.marginBottom = marginVertical;
  }
  if (textShadowColor || textShadowOffset || textShadowRadius) {
    const { width = 0, height = 0 } = textShadowOffset ?? {};
    out.textShadow = `${width}px ${height}px ${textShadowRadius ?? 0}px ${textShadowColor ?? 'transparent'}`;
  }
  if (shadowColor || shadowOffset || isSet(shadowOpacity) || isSet(shadowRadius)) {
    const { width = 0, height = 0 } = shadowOffset ?? {};
    out.boxShadow = `${width}px ${height}px ${shadowRadius ?? 0}px ${withOpacity(shadowColor ?? '#000000', shadowOpacity ?? 1)}`;
  }
  if (isSet(transform)) {
    out.transform = transformToCss(transform);
  }
  // RN lineHeight is always in dp (== px). CSS treats a unitless number as a
  // font-size multiplier instead, so it must be given an explicit unit here.
  if (typeof out.lineHeight === 'number') {
    out.lineHeight = `${out.lineHeight}px`;
  }

  return out;
}

export type HitSlop = number | { top?: number; left?: number; right?: number; bottom?: number };

/** RN expands the hit target via hitSlop without changing layout; padding+equal negative
 * margin does the same on the web, as long as the element has no visible border/background
 * (true for every current hitSlop consumer — icon-only touchables). */
export function hitSlopStyle(hitSlop?: HitSlop): CSSProperties | undefined {
  if (!isSet(hitSlop)) {
    return undefined;
  }
  const s =
    typeof hitSlop === 'number'
      ? { top: hitSlop, left: hitSlop, right: hitSlop, bottom: hitSlop }
      : hitSlop;
  return {
    paddingTop: s.top ?? 0,
    paddingLeft: s.left ?? 0,
    paddingRight: s.right ?? 0,
    paddingBottom: s.bottom ?? 0,
    marginTop: -(s.top ?? 0),
    marginLeft: -(s.left ?? 0),
    marginRight: -(s.right ?? 0),
    marginBottom: -(s.bottom ?? 0),
  };
}

export const StyleSheet = {
  create<T extends Record<string, Style>>(styles: T): T {
    return styles;
  },
  absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as Style,
  absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as Style,
};
