/**
 * Confetti celebration animation for React Native
 * Renders ~50 falling particles with rotation and drift
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { View, Animated, StyleSheet, useWindowDimensions } from 'react-native';

const COLORS = ['#ffd700', '#e94560', '#22c55e', '#14b8a6', '#ffffff'];
const PARTICLE_COUNT = 50;

type ParticleShape = 'rect' | 'circle' | 'diamond';

interface Particle {
  id: number;
  x: number;
  color: string;
  shape: ParticleShape;
  size: number;
  delay: number;
  duration: number;
  drift: number;
}

function generateParticles(screenWidth: number): Particle[] {
  const particles: Particle[] = [];
  const shapes: ParticleShape[] = ['rect', 'circle', 'diamond'];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      id: i,
      x: Math.random() * screenWidth,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      size: 10 + Math.random() * 8,
      delay: Math.random() * 2000,
      duration: 2500 + Math.random() * 1500,
      drift: (Math.random() - 0.5) * 100,
    });
  }

  return particles;
}

function ParticleView({
  shape,
  size,
  color,
}: {
  shape: ParticleShape;
  size: number;
  color: string;
}) {
  const baseStyle = { backgroundColor: color };

  switch (shape) {
    case 'rect':
      return <View style={[baseStyle, { width: size, height: size * 0.6, borderRadius: 2 }]} />;
    case 'circle':
      return <View style={[baseStyle, { width: size, height: size, borderRadius: size / 2 }]} />;
    case 'diamond':
      return (
        <View
          style={[
            baseStyle,
            {
              width: size * 0.7,
              height: size * 0.7,
              transform: [{ rotate: '45deg' }],
              borderRadius: 2,
            },
          ]}
        />
      );
  }
}

function ConfettiParticle({
  particle,
  screenHeight,
}: {
  particle: Particle;
  screenHeight: number;
}) {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.timing(animValue, {
        toValue: 1,
        duration: particle.duration,
        useNativeDriver: true,
      }).start();
    }, particle.delay);

    return () => clearTimeout(timeout);
  }, [animValue, particle.delay, particle.duration]);

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, screenHeight + 50],
  });

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, particle.drift],
  });

  const rotate = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '720deg'],
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [1, 1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: particle.x,
          transform: [{ translateY }, { translateX }, { rotate }],
          opacity,
        },
      ]}
    >
      <ParticleView shape={particle.shape} size={particle.size} color={particle.color} />
    </Animated.View>
  );
}

function Confetti() {
  const { width, height } = useWindowDimensions();
  const particles = useMemo(() => generateParticles(width), [width]);

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((particle) => (
        <ConfettiParticle key={particle.id} particle={particle} screenHeight={height} />
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
  particle: {
    position: 'absolute',
    top: 0,
  },
});

export default Confetti;
