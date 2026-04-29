/**
 * @file BaseFlowEdge Component
 * @description Base skeleton component for rendering flow edges.
 * Provides SVG path rendering with theme integration, selection state, and custom rendering support.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 1.10
 */

import React, { useCallback, useMemo, type CSSProperties, type ReactNode } from "react";
import { useFlowEntityContext } from "../context";
import type { Position, PathType, PathConfig, FlowEdgeTheme } from "../types";
import type { FlowEdgeEntity } from "../../../common/flow/flow-edge-entity";
import { EdgePath, calculatePath, type EdgePathProps } from "./EdgePath";
import { EdgeAnimation, getEdgeAnimationClassName } from "./EdgeAnimation";

// =============================================================================
// Constants
// =============================================================================

/**
 * Default arrow marker ID
 */
const DEFAULT_ARROW_MARKER_ID = "flow-edge-arrow";

/**
 * Default arrow marker size
 */
const DEFAULT_ARROW_SIZE = 10;

// =============================================================================
// Types
// =============================================================================

/**
 * Props for custom path renderer
 */
export interface PathRendererProps {
  /** Calculated SVG path string */
  path: string;
  /** Source position */
  source: Position;
  /** Target position */
  target: Position;
  /** Whether the edge is selected */
  selected: boolean;
  /** Current theme */
  theme: FlowEdgeTheme;
}

/**
 * Base props for the BaseFlowEdge component
 */
export interface BaseFlowEdgeProps {
  /**
   * The flow edge entity to render
   */
  entity: FlowEdgeEntity;

  /**
   * Source port position (absolute coordinates)
   */
  sourcePosition: Position;

  /**
   * Target port position (absolute coordinates)
   */
  targetPosition: Position;

  /**
   * Whether the edge is currently selected
   * @default false
   */
  selected?: boolean;

  /**
   * Callback when the edge is selected/clicked
   */
  onSelect?: (entity: FlowEdgeEntity) => void;

  /**
   * Callback when the edge is clicked (with event)
   */
  onClick?: (entity: FlowEdgeEntity, event: React.MouseEvent) => void;

  /**
   * Custom path renderer
   * If provided, overrides default path rendering
   */
  pathRenderer?: (props: PathRendererProps) => ReactNode;

  /**
   * Whether animations are enabled
   * @default true
   */
  animationEnabled?: boolean;

  /**
   * Whether to show the arrow marker
   * @default true
   */
  showArrow?: boolean;

  /**
   * Path type override (uses entity data if not provided)
   */
  pathType?: PathType;

  /**
   * Path config override (uses entity data if not provided)
   */
  pathConfig?: PathConfig;

  /**
   * Additional CSS class name
   */
  className?: string;

  /**
   * Additional inline styles for the SVG group
   */
  style?: CSSProperties;

  /**
   * Test ID for testing
   */
  "data-testid"?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * BaseFlowEdge - Skeleton component for flow edge rendering
 *
 * Renders an SVG path connecting two positions with:
 * - Theme-based styling (color, width, dash pattern)
 * - Selection state with visual feedback
 * - Custom path rendering support
 * - Arrow marker at the target end
 * - Click/select interaction handling
 *
 * This component is designed to be used within an SVG container.
 * It renders a `<g>` group element containing the edge path.
 *
 * @example
 * ```tsx
 * <svg>
 *   <BaseFlowEdge
 *     entity={edgeEntity}
 *     sourcePosition={{ x: 100, y: 50 }}
 *     targetPosition={{ x: 300, y: 150 }}
 *     selected={selectedEdgeId === edgeEntity.id}
 *     onSelect={(entity) => setSelectedEdgeId(entity.id)}
 *   />
 * </svg>
 * ```
 *
 * @example With custom path renderer
 * ```tsx
 * <BaseFlowEdge
 *   entity={edgeEntity}
 *   sourcePosition={sourcePos}
 *   targetPosition={targetPos}
 *   pathRenderer={({ path, selected, theme }) => (
 *     <path
 *       d={path}
 *       stroke={selected ? 'blue' : theme.strokeColor}
 *       strokeWidth={3}
 *       fill="none"
 *     />
 *   )}
 * />
 * ```
 */
export const BaseFlowEdge: React.FC<BaseFlowEdgeProps> = React.memo(function BaseFlowEdge({
  entity,
  sourcePosition,
  targetPosition,
  selected = false,
  onSelect,
  onClick,
  pathRenderer,
  animationEnabled = true,
  showArrow = true,
  pathType,
  pathConfig,
  className,
  style,
  "data-testid": testId,
}) {
  // Get theme from context
  const { theme } = useFlowEntityContext();
  const edgeTheme = theme.edge;

  // Extract entity data
  const data = entity.data!;
  const { disabled, label, animationState = "idle", animationConfig } = data;

  // Determine path type (prop override > entity data > default)
  const effectivePathType: PathType = pathType ?? data.pathType ?? "bezier";
  const effectivePathConfig: PathConfig | undefined = pathConfig ?? data.pathConfig;

  // Calculate path string
  const pathD = useMemo(
    () => calculatePath(sourcePosition, targetPosition, effectivePathType, effectivePathConfig),
    [sourcePosition, targetPosition, effectivePathType, effectivePathConfig]
  );

  // Determine colors
  const strokeColor = data.theme?.strokeColor ?? edgeTheme.strokeColor;
  const strokeWidth = data.theme?.strokeWidth ?? edgeTheme.strokeWidth ?? 2;
  const selectedColor = data.theme?.selectedColor ?? edgeTheme.selectedColor ?? "#3b82f6";
  const strokeDasharray = data.theme?.strokeDasharray ?? edgeTheme.strokeDasharray;
  const opacity = data.theme?.opacity ?? edgeTheme.opacity ?? 1;

  // Get animation class based on state
  const animationClassName = useMemo(
    () => getEdgeAnimationClassName(animationState, animationEnabled),
    [animationState, animationEnabled]
  );

  // Group styles
  const groupStyle = useMemo<CSSProperties>(
    () => ({
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      ...style,
    }),
    [disabled, style]
  );

  // Click handler
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (!disabled) {
        onSelect?.(entity);
        onClick?.(entity, event);
      }
    },
    [entity, disabled, onSelect, onClick]
  );

  // Render custom path if renderer provided
  const renderPath = (): ReactNode => {
    if (pathRenderer) {
      return pathRenderer({
        path: pathD,
        source: sourcePosition,
        target: targetPosition,
        selected,
        theme: edgeTheme,
      });
    }

    const edgePathProps: EdgePathProps = {
      source: sourcePosition,
      target: targetPosition,
      pathType: effectivePathType,
      strokeColor,
      strokeWidth,
      selected,
      selectedColor,
      opacity,
      showArrow,
    };
    if (effectivePathConfig !== undefined) {
      edgePathProps.pathConfig = effectivePathConfig;
    }
    if (strokeDasharray !== undefined) {
      edgePathProps.strokeDasharray = strokeDasharray;
    }
    if (showArrow) {
      edgePathProps.markerEnd = DEFAULT_ARROW_MARKER_ID;
    }

    return <EdgePath {...edgePathProps} />;
  };

  // Calculate label position (midpoint of the edge)
  const labelPosition = useMemo<Position>(
    () => ({
      x: (sourcePosition.x + targetPosition.x) / 2,
      y: (sourcePosition.y + targetPosition.y) / 2,
    }),
    [sourcePosition, targetPosition]
  );

  return (
    <g
      className={`flow-edge ${selected ? "flow-edge--selected" : ""} ${disabled ? "flow-edge--disabled" : ""} ${animationClassName} ${className ?? ""}`.trim()}
      style={groupStyle}
      onClick={handleClick}
      data-testid={testId ?? `flow-edge-${entity.id}`}
      data-edge-id={entity.id}
      data-edge-type={data.edgeType}
      data-source-node={data.sourceNodeId}
      data-target-node={data.targetNodeId}
      data-selected={selected}
      data-disabled={disabled}
      data-animation-state={animationState}
      role="button"
      aria-label={`Edge from ${data.sourceNodeId} to ${data.targetNodeId}${label ? `: ${label}` : ""}`}
      tabIndex={disabled ? -1 : 0}
    >
      {/* Invisible wider path for easier clicking */}
      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(strokeWidth * 4, 16)}
        className="flow-edge-hit-area"
        data-testid={`flow-edge-hit-area-${entity.id}`}
      />

      {/* Visible edge path */}
      {renderPath()}

      {/* Animation overlay (when animationEnabled and not idle) */}
      {animationEnabled && animationState !== "idle" && (
        <EdgeAnimation
          path={pathD}
          state={animationState}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          animationsEnabled={animationEnabled}
          data-testid={`flow-edge-animation-${entity.id}`}
          {...(animationConfig === undefined ? {} : { config: animationConfig })}
        />
      )}

      {/* Label (if present) */}
      {label && (
        <text
          x={labelPosition.x}
          y={labelPosition.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="flow-edge-label"
          data-testid={`flow-edge-label-${entity.id}`}
          fill={edgeTheme.strokeColor}
          fontSize={12}
          style={{ pointerEvents: "none" }}
        >
          {label}
        </text>
      )}
    </g>
  );
});

// Default export for convenience
export default BaseFlowEdge;

// =============================================================================
// Arrow Marker Definition Component
// =============================================================================

/**
 * Props for EdgeArrowMarker component
 */
export interface EdgeArrowMarkerProps {
  /**
   * Marker ID for referencing in path markerEnd
   * @default 'flow-edge-arrow'
   */
  id?: string;

  /**
   * Arrow size in pixels
   * @default 10
   */
  size?: number;

  /**
   * Arrow color
   * @default '#6b7280'
   */
  color?: string;
}

/**
 * EdgeArrowMarker - SVG marker definition for edge arrows
 *
 * This component should be included in a `<defs>` section of the SVG container.
 *
 * @example
 * ```tsx
 * <svg>
 *   <defs>
 *     <EdgeArrowMarker id="flow-edge-arrow" color="#6b7280" />
 *   </defs>
 *   <BaseFlowEdge entity={edge} ... />
 * </svg>
 * ```
 */
export const EdgeArrowMarker: React.FC<EdgeArrowMarkerProps> = React.memo(function EdgeArrowMarker({
  id = DEFAULT_ARROW_MARKER_ID,
  size = DEFAULT_ARROW_SIZE,
  color = "#6b7280",
}) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX={9}
      refY={5}
      markerWidth={size}
      markerHeight={size}
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
    </marker>
  );
});
