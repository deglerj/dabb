# @dabb/card-assets

SVG card graphics for the Dabb Binokel card game. Contains all 48 card images in the traditional German/Swabian style.

## Installation

```bash
pnpm add @dabb/card-assets
```

## Contents

### Card Images

All cards are SVG files organized by suit:

```
src/
├── kreuz/     # Clubs (♣)
├── schippe/   # Spades (♠)
├── herz/      # Hearts (♥)
└── bollen/    # Diamonds (♦)
```

Each suit contains 6 ranks:

- `ass.svg` - Ace (11 points)
- `zehn.svg` - Ten (10 points)
- `koenig.svg` - King (4 points)
- `ober.svg` - Ober (3 points)
- `buabe.svg` - Buabe/Unter (2 points)
- `neun.svg` - Nine (0 points)

### Card Back

- `src/back.svg` - Card back design

## Usage

### React Native (Expo)

```typescript
import { Image } from 'react-native';

// Import card image
const kreuzAss = require('@dabb/card-assets/src/kreuz/ass.svg');

<Image source={kreuzAss} style={{ width: 60, height: 90 }} />;
```

### React Web

```typescript
import kreuzAss from '@dabb/card-assets/src/kreuz/ass.svg';

<img src={kreuzAss} alt="Kreuz Ass" />;
```

### Dynamic Import

```typescript
function getCardImage(suit: string, rank: string) {
  return require(`@dabb/card-assets/src/${suit}/${rank}.svg`);
}

const card = getCardImage('herz', 'koenig');
```

## Swabian Card Names

| German     | Swabian | English  |
| ---------- | ------- | -------- |
| Kreuz      | Kreuz   | Clubs    |
| Pik        | Schippe | Spades   |
| Herz       | Herz    | Hearts   |
| Karo       | Bollen  | Diamonds |
| Unter/Bube | Buabe   | Jack     |
| Ober/Dame  | Ober    | Queen    |
| König      | König   | King     |
| Ass        | Ass     | Ace      |
| Zehn       | Zehn    | Ten      |
| Neun       | Neun    | Nine     |
