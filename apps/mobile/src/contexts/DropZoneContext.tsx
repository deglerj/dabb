/**
 * Context for sharing drop zone bounds between TrickArea and DraggableCard.
 * Uses Reanimated SharedValues so hit-testing runs on the UI thread.
 */

import React, { createContext, useContext, useCallback } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

export interface DropZoneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DropZoneContextValue {
  /** Shared value of the drop zone bounds (for worklet-thread access) */
  bounds: SharedValue<DropZoneBounds | null>;
  /** Register drop zone bounds from TrickArea's measureInWindow */
  registerBounds: (bounds: DropZoneBounds) => void;
  /** Whether a card is currently being dragged */
  isDragActive: SharedValue<boolean>;
}

const DropZoneContext = createContext<DropZoneContextValue | null>(null);

export function DropZoneProvider({ children }: { children: React.ReactNode }) {
  const bounds = useSharedValue<DropZoneBounds | null>(null);
  const isDragActive = useSharedValue(false);

  const registerBounds = useCallback(
    (newBounds: DropZoneBounds) => {
      bounds.value = newBounds;
    },
    [bounds]
  );

  return (
    <DropZoneContext.Provider value={{ bounds, registerBounds, isDragActive }}>
      {children}
    </DropZoneContext.Provider>
  );
}

export function useDropZone() {
  const context = useContext(DropZoneContext);
  if (!context) {
    throw new Error('useDropZone must be used within a DropZoneProvider');
  }
  return context;
}
