/**
 * Fireworks celebration animation
 * Renders continuous bursts of sparks at random positions
 */

import { useState, useEffect, useCallback } from 'react';

const COLORS = ['#ffd700', '#e94560', '#22c55e', '#14b8a6', '#ff6b6b', '#ffffff'];
const SPARKS_PER_BURST = 12;

interface Spark {
  id: number;
  angle: number;
  distance: number;
  color: string;
}

interface Burst {
  id: number;
  x: number;
  y: number;
  color: string;
  sparks: Spark[];
  delay: number;
}

function generateSparks(color: string): Spark[] {
  const sparks: Spark[] = [];
  for (let i = 0; i < SPARKS_PER_BURST; i++) {
    const angle = (i / SPARKS_PER_BURST) * Math.PI * 2;
    sparks.push({
      id: i,
      angle,
      distance: 60 + Math.random() * 40,
      color,
    });
  }
  return sparks;
}

function generateBursts(count: number, baseId: number): Burst[] {
  const bursts: Burst[] = [];
  for (let i = 0; i < count; i++) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    bursts.push({
      id: baseId + i,
      x: 15 + Math.random() * 70,
      y: 15 + Math.random() * 50,
      color,
      sparks: generateSparks(color),
      delay: i * 0.4,
    });
  }
  return bursts;
}

function BurstComponent({ burst }: { burst: Burst }) {
  return (
    <div
      className="firework-container"
      style={
        {
          left: `${burst.x}%`,
          top: `${burst.y}%`,
          '--delay': `${burst.delay}s`,
        } as React.CSSProperties
      }
    >
      {/* Trail going up */}
      <div
        className="firework-trail"
        style={
          {
            '--color': burst.color,
            '--delay': `${burst.delay}s`,
            '--rise-y': `${burst.y}vh`,
          } as React.CSSProperties
        }
      />
      {/* Sparks bursting out */}
      {burst.sparks.map((spark) => {
        const burstX = Math.cos(spark.angle) * spark.distance;
        const burstY = Math.sin(spark.angle) * spark.distance;
        return (
          <div
            key={spark.id}
            className="firework-spark"
            style={
              {
                '--color': spark.color,
                '--delay': `${burst.delay}s`,
                '--burst-x': `${burstX}px`,
                '--burst-y': `${burstY}px`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

function Fireworks() {
  const [bursts, setBursts] = useState<Burst[]>(() => generateBursts(4, 0));
  const [burstCounter, setBurstCounter] = useState(4);

  const addMoreBursts = useCallback(() => {
    setBursts((prev) => {
      // Remove old bursts, keep only recent ones
      const recentBursts = prev.slice(-8);
      const newBursts = generateBursts(3 + Math.floor(Math.random() * 2), burstCounter);
      return [...recentBursts, ...newBursts];
    });
    setBurstCounter((c) => c + 4);
  }, [burstCounter]);

  useEffect(() => {
    // Add more bursts periodically for endless animation
    const interval = setInterval(addMoreBursts, 2000);
    return () => clearInterval(interval);
  }, [addMoreBursts]);

  return (
    <div className="celebration-overlay">
      {bursts.map((burst) => (
        <BurstComponent key={burst.id} burst={burst} />
      ))}
    </div>
  );
}

export default Fireworks;
