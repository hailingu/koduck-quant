/**
 * @file EdgePath Component
 * @description Sub-component for calculating and rendering SVG path for flow edges.
 * Supports multiple path types: straight, bezier, step, and smoothstep.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 1.10
 */

import React, { useMemo, type CSSProperties } from "react";
import type { Position, PathType, PathConfig } from "../types";

// =============================================================================
// Types
// =============================================================================

/**
 * Props for EdgePath component
 */
export interface EdgePathProps {
  /**
   * Source position (start point of the edge)
   */
  source: Position;

  /**
   * Target position (end point of the edge)
   */
  target: Position;

  /**
   * Path calculation type
   * @default 'bezier'
   */
  pathType?: PathType;

  /**
   * Path configuration for fine-tuning
   */
  pathConfig?: PathConfig;

  /**
   * Edge stroke color
   * @default '#6b7280'
   */
  strokeColor?: string;

  /**
   * Edge stroke width in pixels
   * @default 2
   */
  strokeWidth?: number;

  /**
   * Stroke dash array pattern (e.g., '5,5' for dashed)
   */
  strokeDasharray?: string;

  /**
   * Whether the edge is selected
   * @default false
   */
  selected?: boolean;

  /**
   * Selected edge color
   * @default '#3b82f6'
   */
  selectedColor?: string;

  /**
   * Edge opacity
   * @default 1
   */
  opacity?: number;

  /**
   * Whether to show an arrow marker at the end
   * @default true
   */
  showArrow?: boolean;

  /**
   * Arrow marker ID to use
   */
  markerEnd?: string;

  /**
   * Additional CSS class name for the path
   */
  className?: string;

  /**
   * Additional inline styles for the path
   */
  style?: CSSProperties;

  /**
   * Test ID for testing
   */
  "data-testid"?: string;
}

// =============================================================================
// Path Calculation Functions
// =============================================================================

/**
 * Calculates a straight line path
 * @param source Source position
 * @param target Target position
 * @returns SVG path string for a straight line
 */
function calculateStraightPath(source: Position, target: Position): string {
  return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
}

/**
 * Calculates a bezier curve path
 * Uses horizontal control points for smooth curves
 * @param source Source position
 * @param target Target position
 * @param curvature Curvature factor (0 to 1)
 * @returns SVG path string for a bezier curve
 */
function calculateBezierPath(source: Position, target: Position, curvature: number = 0.5): string {
  const dx = target.x - source.x;
  const controlPointOffset = Math.abs(dx) * curvature;

  // Control points extend horizontally from source and target
  const cp1x = source.x + controlPointOffset;
  const cp1y = source.y;
  const cp2x = target.x - controlPointOffset;
  const cp2y = target.y;

  return `M ${source.x} ${source.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${target.x} ${target.y}`;
}

/**
 * Calculates a step path (rectangular path with 90-degree angles)
 * @param source Source position
 * @param target Target position
 * @returns SVG path string for a step path
 */
function calculateStepPath(source: Position, target: Position): string {
  const midX = (source.x + target.x) / 2;

  return `M ${source.x} ${source.y} L ${midX} ${source.y} L ${midX} ${target.y} L ${target.x} ${target.y}`;
}

/**
 * Calculates a smooth step path (step path with rounded corners)
 * @param source Source position
 * @param target Target position
 * @param borderRadius Border radius for rounded corners
 * @returns SVG path string for a smooth step path
 */
function calculateSmoothStepPath(
  source: Position,
  target: Position,
  borderRadius: number = 8
): string {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const midX = (source.x + target.x) / 2;

  // Clamp border radius to prevent overlap
  const maxRadius = Math.min(Math.abs(dx) / 2, Math.abs(dy) / 2, borderRadius);
  const r = Math.max(0, maxRadius);

  if (r === 0) {
    // Fall back to step path if no room for curves
    return calculateStepPath(source, target);
  }

  const signX = dx > 0 ? 1 : -1;
  const signY = dy > 0 ? 1 : -1;

  // First horizontal segment
  const x1 = midX - r * signX;
  // First curve
  const x2 = midX;
  const y2 = source.y + r * signY;
  // Second curve start
  const y3 = target.y - r * signY;
  // Second curve
  const x4 = midX + r * signX;
  const y4 = target.y;

  return `M ${source.x} ${source.y} L ${x1} ${source.y} Q ${midX} ${source.y}, ${x2} ${y2} L ${x2} ${y3} Q ${midX} ${target.y}, ${x4} ${y4} L ${target.x} ${target.y}`;
}

/**
 * Calculates path based on path type
 * @param source Source position
 * @param target Target position
 * @param pathType Type of path to calculate (straight, bezier, step, smoothstep)
 * @param pathConfig Optional configuration for path calculation (e.g., curvature, borderRadius)
 * @returns SVG path string for the calculated path
 */
export function calculatePath(
  source: Position,
  target: Position,
  pathType: PathType = "bezier",
  pathConfig?: PathConfig
): string {
  switch (pathType) {
    case "straight":
      return calculateStraightPath(source, target);
    case "bezier":
      return calculateBezierPath(source, target, pathConfig?.curvature ?? 0.5);
    case "step":
      return calculateStepPath(source, target);
    case "smoothstep":
      return calculateSmoothStepPath(source, target, pathConfig?.borderRadius ?? 8);
    default:
      return calculateBezierPath(source, target, 0.5);
  }
}

// =============================================================================
// Component
// =============================================================================

/**
 * EdgePath - SVG path component for flow edges
 *
 * Calculates and renders an SVG path between two positions using various
 * path algorithms (straight, bezier, step, smoothstep).
 *
 * @example
 * ```tsx
 * <svg>
 *   <EdgePath
 *     source={{ x: 100, y: 50 }}
 *     target={{ x: 300, y: 150 }}
 *     pathType="bezier"
 *     strokeColor="#6b7280"
 *     strokeWidth={2}
 *   />
 * </svg>
 * ```
 *
 * @example With selection state
 * ```tsx
 * <EdgePath
 *   source={sourcePos}
 *   target={targetPos}
 *   selected={isSelected}
 *   selectedColor="#3b82f6"
 * />
 * ```
 */
export const EdgePath: React.FC<EdgePathProps> = React.memo(function EdgePath({
  source,
  target,
  pathType = "bezier",
  pathConfig,
  strokeColor = "#6b7280",
  strokeWidth = 2,
  strokeDasharray,
  selected = false,
  selectedColor = "#3b82f6",
  opacity = 1,
  showArrow = true,
  markerEnd,
  className,
  style,
  "data-testid": testId,
}) {
  // Calculate path string
  const pathD = useMemo(
    () => calculatePath(source, target, pathType, pathConfig),
    [source, target, pathType, pathConfig]
  );

  // Determine stroke color based on selection
  const currentStrokeColor = selected ? selectedColor : strokeColor;

  // Determine stroke width based on selection
  const currentStrokeWidth = selected ? strokeWidth + 1 : strokeWidth;

  // Path styles
  const pathStyle = useMemo<CSSProperties>(
    () => ({
      transition: "stroke 0.15s, stroke-width 0.15s",
      ...style,
    }),
    [style]
  );

  return (
    <path
      d={pathD}
      fill="none"
      stroke={currentStrokeColor}
      strokeWidth={currentStrokeWidth}
      strokeDasharray={strokeDasharray}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
      markerEnd={showArrow && markerEnd ? `url(#${markerEnd})` : undefined}
      className={`flow-edge-path ${selected ? "flow-edge-path--selected" : ""} ${className ?? ""}`.trim()}
      style={pathStyle}
      data-testid={testId ?? "flow-edge-path"}
      data-path-type={pathType}
      data-selected={selected}
    />
  );
});

// Default export for convenience
export default EdgePath;
