/**
 * Fireworks celebration animation for React Native
 * Renders continuous bursts of sparks at random positions
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Animated, StyleSheet, useWindowDimensions } from 'react-native';

const COLORS = ['#ffd700', '#e94560', '#22c55e', '#14b8a6', '#ff6b6b', '#ffffff'];
const SPARKS_PER_BURST = 12;

interface Spark {
  id: number;
  angle: number;
  distance: number;
}

interface Burst {
  id: number;
  x: number;
  y: number;
  color: string;
  sparks: Spark[];
  delay: number;
}

function generateSparks(): Spark[] {
  const sparks: Spark[] = [];
  for (let i = 0; i < SPARKS_PER_BURST; i++) {
    const angle = (i / SPARKS_PER_BURST) * Math.PI * 2;
    sparks.push({
      id: i,
      angle,
      distance: 60 + Math.random() * 40,
    });
  }
  return sparks;
}

function generateBursts(
  count: number,
  baseId: number,
  screenWidth: number,
  screenHeight: number
): Burst[] {
  const bursts: Burst[] = [];
  for (let i = 0; i < count; i++) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    bursts.push({
      id: baseId + i,
      x: 0.15 * screenWidth + Math.random() * 0.7 * screenWidth,
      y: 0.15 * screenHeight + Math.random() * 0.5 * screenHeight,
      color,
      sparks: generateSparks(),
      delay: i * 400,
    });
  }
  return bursts;
}

function SparkComponent({
  spark,
  color,
  animValue,
}: {
  spark: Spark;
  color: string;
  animValue: Animated.Value;
}) {
  const burstX = Math.cos(spark.angle) * spark.distance;
  const burstY = Math.sin(spark.angle) * spark.distance;

  const translateX = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, burstX],
  });

  const translateY = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, burstY],
  });

  const scale = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1, 0.5],
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 0.4, 0.5, 0.9, 1],
    outputRange: [0, 0, 1, 1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.spark,
        {
          backgroundColor: color,
          transform: [{ translateX }, { translateY }, { scale }],
          opacity,
        },
      ]}
    />
  );
}

function TrailComponent({
  color,
  animValue,
  screenHeight,
}: {
  color: string;
  animValue: Animated.Value;
  screenHeight: number;
}) {
  const translateY = animValue.interpolate({
    inputRange: [0, 0.5],
    outputRange: [screenHeight * 0.3, 0],
    extrapolate: 'clamp',
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 0.4, 0.5],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.trail,
        {
          backgroundColor: color,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    />
  );
}

function BurstComponent({ burst, screenHeight }: { burst: Burst; screenHeight: number }) {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.timing(animValue, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }).start();
    }, burst.delay);

    return () => clearTimeout(timeout);
  }, [animValue, burst.delay]);

  return (
    <View style={[styles.burstContainer, { left: burst.x, top: burst.y }]}>
      <TrailComponent color={burst.color} animValue={animValue} screenHeight={screenHeight} />
      {burst.sparks.map((spark) => (
        <SparkComponent key={spark.id} spark={spark} color={burst.color} animValue={animValue} />
      ))}
    </View>
  );
}

function Fireworks() {
  const { width, height } = useWindowDimensions();
  const [bursts, setBursts] = useState<Burst[]>(() => generateBursts(4, 0, width, height));
  const [burstCounter, setBurstCounter] = useState(4);

  const addMoreBursts = useCallback(() => {
    setBursts((prev) => {
      const recentBursts = prev.slice(-8);
      const newBursts = generateBursts(
        3 + Math.floor(Math.random() * 2),
        burstCounter,
        width,
        height
      );
      return [...recentBursts, ...newBursts];
    });
    setBurstCounter((c) => c + 4);
  }, [burstCounter, width, height]);

  useEffect(() => {
    const interval = setInterval(addMoreBursts, 2000);
    return () => clearInterval(interval);
  }, [addMoreBursts]);

  return (
    <View style={styles.container} pointerEvents="none">
      {bursts.map((burst) => (
        <BurstComponent key={burst.id} burst={burst} screenHeight={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1100,
    elevation: 1100,
    overflow: 'hidden',
  },
  burstContainer: {
    position: 'absolute',
  },
  trail: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  spark: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default Fireworks;
