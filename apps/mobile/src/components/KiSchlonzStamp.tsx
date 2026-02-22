import React from 'react';
import Svg, { Circle, G, Line, Path, Text as SvgText, TextPath } from 'react-native-svg';

interface KiSchlonzStampProps {
  size?: number;
}

export default function KiSchlonzStamp({ size = 120 }: KiSchlonzStampProps) {
  const color = '#b91c1c';
  const opacity = 0.85;

  return (
    <Svg width={size} height={size} viewBox="0 0 300 300">
      {/* Outer circle border */}
      <Circle
        cx={150}
        cy={150}
        r={135}
        fill="none"
        stroke={color}
        strokeWidth={8}
        opacity={opacity}
      />
      <Circle
        cx={150}
        cy={150}
        r={120}
        fill="none"
        stroke={color}
        strokeWidth={4}
        opacity={opacity}
      />

      {/* Stars */}
      <G fill={color} opacity={opacity}>
        <SvgText
          x={70}
          y={48}
          fontFamily="serif"
          fontSize={18}
          textAnchor="middle"
          alignmentBaseline="middle"
        >
          ★
        </SvgText>
        <SvgText
          x={230}
          y={48}
          fontFamily="serif"
          fontSize={18}
          textAnchor="middle"
          alignmentBaseline="middle"
        >
          ★
        </SvgText>
        <SvgText
          x={70}
          y={258}
          fontFamily="serif"
          fontSize={18}
          textAnchor="middle"
          alignmentBaseline="middle"
        >
          ★
        </SvgText>
        <SvgText
          x={230}
          y={258}
          fontFamily="serif"
          fontSize={18}
          textAnchor="middle"
          alignmentBaseline="middle"
        >
          ★
        </SvgText>
      </G>

      {/* Top curved text */}
      <Path id="topArc" d="M 55,150 A 95,95 0 0,1 245,150" fill="none" />
      <SvgText
        fontFamily="serif"
        fontSize={16}
        fill={color}
        fontWeight="bold"
        letterSpacing={4}
        opacity={opacity}
      >
        <TextPath href="#topArc" startOffset="50%" textAnchor="middle">
          ZERTIFIZIERT
        </TextPath>
      </SvgText>

      {/* Main text */}
      <SvgText
        x={150}
        y={145}
        fontFamily="serif"
        fontSize={58}
        fontWeight="bold"
        fill={color}
        textAnchor="middle"
        alignmentBaseline="middle"
        opacity={opacity}
      >
        100%
      </SvgText>
      <SvgText
        x={150}
        y={185}
        fontFamily="serif"
        fontSize={36}
        fontWeight="bold"
        fill={color}
        textAnchor="middle"
        alignmentBaseline="middle"
        opacity={opacity}
      >
        KI-Schlonz
      </SvgText>

      {/* Decorative lines */}
      <Line x1={90} y1={115} x2={210} y2={115} stroke={color} strokeWidth={2} opacity={opacity} />
      <Line x1={90} y1={205} x2={210} y2={205} stroke={color} strokeWidth={2} opacity={opacity} />
    </Svg>
  );
}
