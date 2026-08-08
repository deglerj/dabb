# @dabb/card-assets

Card display data for the Dabb Binokel card game: suit colors, suit symbols, rank display
strings, and face-card band colors. There are no image/SVG assets in this package — card faces
are drawn as styled text/shapes by `@dabb/game-canvas`, not rendered from graphics files.

## Usage

```typescript
import {
  SUIT_COLORS,
  SUIT_SYMBOLS,
  RANK_DISPLAY,
  getSuitColor,
  isRedSuit,
} from '@dabb/card-assets';

getSuitColor('herz'); // '#C41E3A'
SUIT_SYMBOLS['schippe']; // '♠'
RANK_DISPLAY['koenig']; // 'K'
isRedSuit('bollen'); // true
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
