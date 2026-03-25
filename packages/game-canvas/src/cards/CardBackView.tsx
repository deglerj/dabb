/**
 * CardBackView — wraps CardBack in a sized View so it participates in
 * flex/flow layouts (CardBack uses position:absolute internally).
 */
import React from 'react';
import { View } from 'react-native';
import { CardBack } from './CardBack.js';

export interface CardBackViewProps {
  width: number;
  height: number;
}

export function CardBackView({ width, height }: CardBackViewProps) {
  return (
    <View style={{ width, height }}>
      <CardBack width={width} height={height} />
    </View>
  );
}
