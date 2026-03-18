/**
 * CardBack — dark brown card back with cached Skia diagonal hatching.
 *
 * Uses a Skia Path (built with useMemo) for the crosshatch lines,
 * not a drawLine loop.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { Canvas, Skia, Picture, PaintStyle } from '@shopify/react-native-skia';

export interface CardBackProps {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export function CardBack({ width, height, x = 0, y = 0 }: CardBackProps) {
  const cardRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const el = cardRef.current as unknown as HTMLElement | null;
    if (el?.style) {
      el.style.transform = 'rotateX(0.001deg)';
    }
  }, []);

  const picture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const cvs = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));

    // Background fill
    const bg = Skia.Paint();
    bg.setColor(Skia.Color('#5c2e0a'));
    cvs.drawRect(Skia.XYWHRect(0, 0, width, height), bg);

    // Build a single Path for all crosshatch lines
    const crosshatchPath = Skia.Path.Make();
    const step = 6;
    for (let i = -height; i < width + height; i += step) {
      // Diagonal \ lines
      crosshatchPath.moveTo(i, 0);
      crosshatchPath.lineTo(i + height, height);
      // Diagonal / lines
      crosshatchPath.moveTo(i, height);
      crosshatchPath.lineTo(i + height, 0);
    }

    const linePaint = Skia.Paint();
    linePaint.setColor(Skia.Color('rgba(255,255,255,0.08)'));
    linePaint.setStrokeWidth(1);
    linePaint.setStyle(PaintStyle.Stroke);
    linePaint.setAntiAlias(true);
    cvs.drawPath(crosshatchPath, linePaint);

    // Inner border rect
    const border = Skia.Paint();
    border.setColor(Skia.Color('rgba(255,255,255,0.12)'));
    border.setStyle(PaintStyle.Stroke);
    border.setStrokeWidth(1);
    border.setAntiAlias(true);
    cvs.drawRect(Skia.XYWHRect(3, 3, width - 6, height - 6), border);

    return recorder.finishRecordingAsPicture();
  }, [width, height]);

  return (
    <View
      ref={cardRef}
      style={[styles.card, { width, height, borderRadius: width * 0.06, left: x, top: y }]}
    >
      <Canvas style={{ width, height }}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
