/**
 * Confetti celebration animation
 * Renders ~50 falling particles with rotation and drift
 */

import { useMemo } from 'react';

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

function generateParticles(): Particle[] {
  const particles: Particle[] = [];
  const shapes: ParticleShape[] = ['rect', 'circle', 'diamond'];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      id: i,
      x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      size: 8 + Math.random() * 8,
      delay: Math.random() * 2,
      duration: 2.5 + Math.random() * 1.5,
      drift: (Math.random() - 0.5) * 100,
    });
  }

  return particles;
}

function ParticleShape({
  shape,
  size,
  color,
}: {
  shape: ParticleShape;
  size: number;
  color: string;
}) {
  switch (shape) {
    case 'rect':
      return (
        <svg width={size} height={size * 0.6} viewBox="0 0 10 6">
          <rect width="10" height="6" fill={color} />
        </svg>
      );
    case 'circle':
      return (
        <svg width={size} height={size} viewBox="0 0 10 10">
          <circle cx="5" cy="5" r="5" fill={color} />
        </svg>
      );
    case 'diamond':
      return (
        <svg width={size} height={size} viewBox="0 0 10 10">
          <polygon points="5,0 10,5 5,10 0,5" fill={color} />
        </svg>
      );
  }
}

function Confetti() {
  const particles = useMemo(() => generateParticles(), []);

  return (
    <div className="celebration-overlay">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="confetti-particle"
          style={
            {
              left: `${particle.x}%`,
              '--delay': `${particle.delay}s`,
              '--duration': `${particle.duration}s`,
              '--drift': `${particle.drift}px`,
            } as React.CSSProperties
          }
        >
          <ParticleShape shape={particle.shape} size={particle.size} color={particle.color} />
        </div>
      ))}
    </div>
  );
}

export default Confetti;
