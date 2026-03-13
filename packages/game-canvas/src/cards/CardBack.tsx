/**
 * CardBack — dark brown card back with cached Skia diagonal hatching.
 */
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, Skia, Picture } from '@shopify/react-native-skia';

export interface CardBackProps {
  width: number;
  height: number;
}

export function CardBack({ width, height }: CardBackProps) {
  const picture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const cvs = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));

    const bg = Skia.Paint();
    bg.setColor(Skia.Color('#5c2e0a'));
    cvs.drawRect(Skia.XYWHRect(0, 0, width, height), bg);

    const line = Skia.Paint();
    line.setColor(Skia.Color('rgba(255,255,255,0.08)'));
    line.setStrokeWidth(1);
    const step = 6;
    for (let i = -height; i < width + height; i += step) {
      cvs.drawLine(i, 0, i + height, height, line);
      cvs.drawLine(i, height, i + height, 0, line);
    }

    const border = Skia.Paint();
    border.setColor(Skia.Color('rgba(255,255,255,0.12)'));
    border.setStyle(1);
    border.setStrokeWidth(1);
    cvs.drawRect(Skia.XYWHRect(3, 3, width - 6, height - 6), border);

    return recorder.finishRecordingAsPicture();
  }, [width, height]);

  return (
    <View style={[styles.card, { width, height, borderRadius: width * 0.06 }]}>
      <Canvas style={{ width, height }}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
