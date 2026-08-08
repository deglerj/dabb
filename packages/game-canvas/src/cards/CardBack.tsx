/**
 * CardBack — dark brown card back with a diagonal crosshatch pattern,
 * drawn with layered CSS repeating-linear-gradients instead of a canvas.
 */
import { View, StyleSheet } from '@dabb/rn-compat';

export interface CardBackProps {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export function CardBack({ width, height, x = 0, y = 0 }: CardBackProps) {
  return (
    <View
      style={[
        styles.card,
        {
          width,
          height,
          borderRadius: width * 0.06,
          left: x,
          top: y,
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 6px), ' +
            'repeating-linear-gradient(-45deg, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 6px)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
          // Firefox rasterises this View's rounded corners then composites the parent's
          // rotation — producing aliased edges. rotateX(0.001deg) promotes it to its own
          // GPU layer so Firefox composites a pre-rendered AA'd texture instead.
          transform: 'rotateX(0.001deg)',
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    position: 'absolute',
    backgroundColor: '#5c2e0a',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
