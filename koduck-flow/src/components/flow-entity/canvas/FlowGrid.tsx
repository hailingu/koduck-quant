/**
 * @file FlowGrid Component
 * @description Background grid for the flow canvas that tiles according to zoom and offset.
 * Uses CSS patterns for efficient rendering.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 2.6
 */

import React, { useMemo } from "react";
import { useOptionalFlowEntityContext } from "../context";

// =============================================================================
// Types
// =============================================================================

/**
 * Grid pattern configuration
 */
export interface GridPattern {
  /** Size of the primary grid cells in pixels */
  cellSize: number;
  /** Size of the secondary (larger) grid cells in pixels */
  secondaryCellSize: number;
  /** Primary grid line color */
  lineColor: string;
  /** Secondary grid line color */
  secondaryLineColor: string;
  /** Primary grid line width */
  lineWidth: number;
  /** Secondary grid line width */
  secondaryLineWidth: number;
}

/**
 * Props for FlowGrid component
 */
export interface FlowGridProps {
  /** Current viewport translate X */
  translateX?: number;
  /** Current viewport translate Y */
  translateY?: number;
  /** Current viewport scale/zoom */
  scale?: number;
  /** Grid pattern configuration */
  pattern?: Partial<GridPattern>;
  /** Whether to show the grid */
  visible?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default grid pattern
 */
export const DEFAULT_GRID_PATTERN: GridPattern = {
  cellSize: 20,
  secondaryCellSize: 100,
  lineColor: "#e5e7eb",
  secondaryLineColor: "#d1d5db",
  lineWidth: 1,
  secondaryLineWidth: 1,
};

// =============================================================================
// Component
// =============================================================================

/**
 * FlowGrid renders a background grid pattern for the canvas.
 * The grid pattern adjusts based on viewport position and zoom level.
 *
 * @example
 * ```tsx
 * <FlowGrid
 *   translateX={100}
 *   translateY={50}
 *   scale={1.5}
 *   pattern={{ cellSize: 25 }}
 * />
 * ```
 */
export const FlowGrid: React.FC<FlowGridProps> = ({
  translateX = 0,
  translateY = 0,
  scale = 1,
  pattern: patternOverrides,
  visible = true,
  className,
  style,
}) => {
  // Get theme from context (optional, for grid color fallback)
  const contextValue = useOptionalFlowEntityContext();
  const gridColor = contextValue?.theme?.gridColor ?? DEFAULT_GRID_PATTERN.lineColor;

  // Merge pattern with defaults
  const pattern: GridPattern = useMemo(() => {
    const base = {
      ...DEFAULT_GRID_PATTERN,
      lineColor: gridColor,
    };
    return patternOverrides ? { ...base, ...patternOverrides } : base;
  }, [patternOverrides, gridColor]);

  // Calculate background position based on viewport transform
  // The grid should appear to move with the content as the viewport pans
  const backgroundPosition = useMemo(() => {
    const offsetX = translateX % (pattern.cellSize * scale);
    const offsetY = translateY % (pattern.cellSize * scale);
    return `${offsetX}px ${offsetY}px`;
  }, [translateX, translateY, pattern.cellSize, scale]);

  // Calculate secondary grid position
  const secondaryBackgroundPosition = useMemo(() => {
    const offsetX = translateX % (pattern.secondaryCellSize * scale);
    const offsetY = translateY % (pattern.secondaryCellSize * scale);
    return `${offsetX}px ${offsetY}px`;
  }, [translateX, translateY, pattern.secondaryCellSize, scale]);

  // Calculate grid sizes based on zoom
  const primaryGridSize = pattern.cellSize * scale;
  const secondaryGridSize = pattern.secondaryCellSize * scale;

  // Generate CSS background for grid lines
  // Using linear-gradient for cross-browser compatibility
  const backgroundImage = useMemo(() => {
    const primaryColor = pattern.lineColor;
    const secondaryColor = pattern.secondaryLineColor;
    const primaryWidth = pattern.lineWidth;
    const secondaryWidth = pattern.secondaryLineWidth;

    // Primary vertical lines
    const primaryVertical = `linear-gradient(to right, ${primaryColor} ${primaryWidth}px, transparent ${primaryWidth}px)`;
    // Primary horizontal lines
    const primaryHorizontal = `linear-gradient(to bottom, ${primaryColor} ${primaryWidth}px, transparent ${primaryWidth}px)`;
    // Secondary vertical lines
    const secondaryVertical = `linear-gradient(to right, ${secondaryColor} ${secondaryWidth}px, transparent ${secondaryWidth}px)`;
    // Secondary horizontal lines
    const secondaryHorizontal = `linear-gradient(to bottom, ${secondaryColor} ${secondaryWidth}px, transparent ${secondaryWidth}px)`;

    return `${secondaryVertical}, ${secondaryHorizontal}, ${primaryVertical}, ${primaryHorizontal}`;
  }, [
    pattern.lineColor,
    pattern.secondaryLineColor,
    pattern.lineWidth,
    pattern.secondaryLineWidth,
  ]);

  // Generate CSS background-size for grid
  const backgroundSize = useMemo(() => {
    return [
      `${secondaryGridSize}px ${secondaryGridSize}px`,
      `${secondaryGridSize}px ${secondaryGridSize}px`,
      `${primaryGridSize}px ${primaryGridSize}px`,
      `${primaryGridSize}px ${primaryGridSize}px`,
    ].join(", ");
  }, [primaryGridSize, secondaryGridSize]);

  // Generate background position for all layers
  const combinedBackgroundPosition = useMemo(() => {
    return [
      secondaryBackgroundPosition,
      secondaryBackgroundPosition,
      backgroundPosition,
      backgroundPosition,
    ].join(", ");
  }, [backgroundPosition, secondaryBackgroundPosition]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={className}
      data-testid="flow-grid"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none",
        backgroundImage,
        backgroundSize,
        backgroundPosition: combinedBackgroundPosition,
        zIndex: 0,
        ...style,
      }}
      aria-hidden="true"
    />
  );
};

FlowGrid.displayName = "FlowGrid";

export default FlowGrid;
