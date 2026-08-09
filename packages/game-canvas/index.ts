// Table
export { GameTable } from './src/table/GameTable.js';
export type { GameTableProps } from './src/table/GameTable.js';
export { useTableEffects } from './src/table/useTableEffects.js';
export {
  getFeltBounds,
  isWithinFeltBounds,
  DEFAULT_SURROUND_FRACTION,
} from './src/table/feltBounds.js';
export type { FeltBounds } from './src/table/feltBounds.js';
export { computeCanvasBackingSize } from './src/table/canvasSizing.js';
export type { CanvasBackingSize } from './src/table/canvasSizing.js';
export type { TableEffects } from './src/table/useTableEffects.js';

// Cards
export { CardView } from './src/cards/CardView.js';
export type { CardViewProps } from './src/cards/CardView.js';
export { CardBackView } from './src/cards/CardBackView.js';
export type { CardBackViewProps } from './src/cards/CardBackView.js';
export { deriveCardPositions, edgeFraction, getTableScale } from './src/cards/cardPositions.js';
export type {
  CardPositionsInput,
  CardPositionsOutput,
  CardPosition,
  LayoutDimensions,
} from './src/cards/cardPositions.js';

// Overlays
export { PhaseOverlay } from './src/overlays/PhaseOverlay.js';
export type { PhaseOverlayProps } from './src/overlays/PhaseOverlay.js';
export { BiddingOverlay } from './src/overlays/BiddingOverlay.js';
export type { BiddingOverlayProps } from './src/overlays/BiddingOverlay.js';
export { DabbOverlay } from './src/overlays/DabbOverlay.js';
export type { DabbOverlayProps } from './src/overlays/DabbOverlay.js';
export { DiscardOverlay } from './src/overlays/DiscardOverlay.js';
export type { DiscardOverlayProps } from './src/overlays/DiscardOverlay.js';
export { TrumpOverlay } from './src/overlays/TrumpOverlay.js';
export type { TrumpOverlayProps } from './src/overlays/TrumpOverlay.js';
export { MeldingOverlay } from './src/overlays/MeldingOverlay.js';
export type { MeldingOverlayProps } from './src/overlays/MeldingOverlay.js';
