// Table
export { GameTable } from './table/GameTable.js';
export type { GameTableProps } from './table/GameTable.js';
export { useTableEffects } from './table/useTableEffects.js';
export {
  getFeltBounds,
  isWithinFeltBounds,
  isWithinDropZone,
  DEFAULT_SURROUND_FRACTION,
} from './table/feltBounds.js';
export type { FeltBounds } from './table/feltBounds.js';
export { computeCanvasBackingSize } from './table/canvasSizing.js';
export type { CanvasBackingSize } from './table/canvasSizing.js';
export type { TableEffects } from './table/useTableEffects.js';

// Cards
export { CardView } from './cards/CardView.js';
export type { CardViewProps } from './cards/CardView.js';
export { CardBackView } from './cards/CardBackView.js';
export type { CardBackViewProps } from './cards/CardBackView.js';
export { deriveCardPositions, edgeFraction, getTableScale } from './cards/cardPositions.js';
export type {
  CardPositionsInput,
  CardPositionsOutput,
  CardPosition,
  LayoutDimensions,
} from './cards/cardPositions.js';

// Overlays
export { PhaseOverlay } from './overlays/PhaseOverlay.js';
export type { PhaseOverlayProps } from './overlays/PhaseOverlay.js';
export { BiddingOverlay } from './overlays/BiddingOverlay.js';
export type { BiddingOverlayProps } from './overlays/BiddingOverlay.js';
export { DabbOverlay } from './overlays/DabbOverlay.js';
export type { DabbOverlayProps } from './overlays/DabbOverlay.js';
export { DiscardOverlay } from './overlays/DiscardOverlay.js';
export type { DiscardOverlayProps } from './overlays/DiscardOverlay.js';
export { TrumpOverlay } from './overlays/TrumpOverlay.js';
export type { TrumpOverlayProps } from './overlays/TrumpOverlay.js';
export { MeldingOverlay } from './overlays/MeldingOverlay.js';
export type { MeldingOverlayProps } from './overlays/MeldingOverlay.js';
