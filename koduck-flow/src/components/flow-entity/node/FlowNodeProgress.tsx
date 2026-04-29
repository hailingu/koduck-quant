/**
 * @file FlowNodeProgress Component
 * @description Node progress indicator component that shows execution progress (0-100%)
 * with configurable position (top, bottom, overlay) within or around nodes.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 3.5
 */

import React, { useMemo, type CSSProperties } from "react";
import { useFlowEntityContext } from "../context";
import { useExecutionStateOptional } from "../hooks";
import type { ExecutionState, FlowNodeTheme, ProgressPosition } from "../types";

// =============================================================================
// Constants
// =============================================================================

/**
 * Default progress bar height in pixels
 */
const DEFAULT_PROGRESS_HEIGHT = 4;

/**
 * Default progress position
 */
const DEFAULT_PROGRESS_POSITION: ProgressPosition = "bottom";

/**
 * States that should show progress indicator
 */
const PROGRESS_SHOWING_STATES: Set<ExecutionState> = new Set(["running", "pending"]);

/**
 * Default colors for progress states
 */
const DEFAULT_PROGRESS_COLORS: Record<ExecutionState, string> = {
  idle: "#9ca3af", // Gray
  pending: "#f59e0b", // Amber
  running: "#3b82f6", // Blue
  success: "#10b981", // Green
  error: "#ef4444", // Red
  skipped: "#6b7280", // Gray-500
  cancelled: "#f97316", // Orange
};

// =============================================================================
// Types
// =============================================================================

/**
 * Props for FlowNodeProgress component
 */
export interface FlowNodeProgressProps {
  /**
   * The entity ID to subscribe to for execution state and progress
   */
  entityId: string;

  /**
   * Position of the progress bar
   * - 'top': Progress bar at the top of the node
   * - 'bottom': Progress bar at the bottom of the node
   * - 'overlay': Progress bar overlays the entire node
   * @default inherits from ExecutionVisualConfig.progressPosition or 'bottom'
   */
  position?: ProgressPosition;

  /**
   * Height of the progress bar in pixels
   * @default inherits from ExecutionVisualConfig.progressHeight or 4
   */
  height?: number;

  /**
   * Whether to show progress even when progress is 0 or undefined
   * @default false
   */
  showWhenZero?: boolean;

  /**
   * Whether to show indeterminate progress (animation) when progress is undefined
   * @default true
   */
  showIndeterminate?: boolean;

  /**
   * Whether to enable animations
   * @default true (inherits from ExecutionVisualConfig)
   */
  enableAnimations?: boolean;

  /**
   * Custom color for the progress bar
   * If not provided, uses theme colors based on execution state
   */
  color?: string;

  /**
   * Custom background color for the progress track
   * If not provided, uses a lighter version of the progress color
   */
  trackColor?: string;

  /**
   * Additional CSS class name
   */
  className?: string;

  /**
   * Additional inline styles
   */
  style?: CSSProperties;

  /**
   * Test ID for testing
   */
  "data-testid"?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Gets the progress color from theme or default
 * @param state Current execution state
 * @param theme Node theme configuration
 * @returns Color string for the progress bar
 */
function getProgressColor(state: ExecutionState, theme: FlowNodeTheme): string {
  return theme.executionStateColors?.[state] ?? DEFAULT_PROGRESS_COLORS[state];
}

/**
 * Generates container styles based on position
 * @param position Progress bar position
 * @param height Progress bar height
 * @returns Container CSS styles
 */
function getContainerStyles(position: ProgressPosition, height: number): CSSProperties {
  const baseStyles: CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    height,
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: 10,
  };

  switch (position) {
    case "top":
      return {
        ...baseStyles,
        top: 0,
        borderTopLeftRadius: "inherit",
        borderTopRightRadius: "inherit",
      };
    case "bottom":
      return {
        ...baseStyles,
        bottom: 0,
        borderBottomLeftRadius: "inherit",
        borderBottomRightRadius: "inherit",
      };
    case "overlay":
      return {
        ...baseStyles,
        top: 0,
        bottom: 0,
        height: "100%",
        opacity: 0.3,
        borderRadius: "inherit",
      };
    default:
      return baseStyles;
  }
}

/**
 * Generates track (background) styles
 * @param trackColor Background color for the track
 * @returns Track CSS styles
 */
function getTrackStyles(trackColor: string): CSSProperties {
  return {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: trackColor,
  };
}

/**
 * Generates progress bar styles
 * @param progress Progress value (0-100)
 * @param color Progress bar color
 * @param enableAnimations Whether to enable animations
 * @param isIndeterminate Whether progress is indeterminate
 * @returns Progress bar CSS styles
 */
function getProgressStyles(
  progress: number,
  color: string,
  enableAnimations: boolean,
  isIndeterminate: boolean
): CSSProperties {
  const baseStyles: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    backgroundColor: color,
    transition: enableAnimations ? "width 0.3s ease-out" : "none",
  };

  if (isIndeterminate) {
    return {
      ...baseStyles,
      width: "30%",
      animation: enableAnimations
        ? "flow-progress-indeterminate 1.5s ease-in-out infinite"
        : "none",
    };
  }

  return {
    ...baseStyles,
    width: `${Math.min(100, Math.max(0, progress))}%`,
  };
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * FlowNodeProgress - Node progress indicator component
 *
 * Shows execution progress (0-100%) within or around nodes with configurable
 * positioning (top, bottom, overlay).
 *
 * @example Basic usage
 * ```tsx
 * <FlowNodeProgress entityId={node.id} />
 * ```
 *
 * @example With custom position and height
 * ```tsx
 * <FlowNodeProgress
 *   entityId={node.id}
 *   position="top"
 *   height={6}
 * />
 * ```
 *
 * @example With custom colors
 * ```tsx
 * <FlowNodeProgress
 *   entityId={node.id}
 *   color="#22c55e"
 *   trackColor="#dcfce7"
 * />
 * ```
 *
 * @returns The rendered progress indicator element, or null if not connected
 */
export const FlowNodeProgress: React.FC<FlowNodeProgressProps> = ({
  entityId,
  position: positionProp,
  height: heightProp,
  showWhenZero = false,
  showIndeterminate = true,
  enableAnimations: enableAnimationsProp,
  color: colorProp,
  trackColor: trackColorProp,
  className,
  style,
  "data-testid": testId,
}) => {
  // Get context for theme and visual config
  const { theme, executionVisuals } = useFlowEntityContext();

  // Subscribe to execution state (optional - works without ExecutionStateProvider)
  const { state, progress, isExecuting, isConnected } = useExecutionStateOptional({ entityId });

  // Merge props with config defaults
  const position = positionProp ?? executionVisuals.progressPosition ?? DEFAULT_PROGRESS_POSITION;
  const height = heightProp ?? executionVisuals.progressHeight ?? DEFAULT_PROGRESS_HEIGHT;
  const enableAnimations = enableAnimationsProp ?? executionVisuals.enablePulse ?? true;

  // Get progress color from theme or prop
  const progressColor = useMemo(
    () => colorProp ?? getProgressColor(state, theme.node),
    [colorProp, state, theme.node]
  );

  // Derive track color from progress color if not provided
  const trackColor = useMemo(
    () => trackColorProp ?? `${progressColor}30`, // 30 = ~19% opacity in hex
    [trackColorProp, progressColor]
  );

  // Determine if progress should be shown
  const shouldShowProgress = useMemo(() => {
    // Not connected - don't show
    if (!isConnected) return false;
    // Always show during executing states
    if (PROGRESS_SHOWING_STATES.has(state)) {
      return true;
    }
    // Show if explicitly requested with showWhenZero
    if (showWhenZero && progress !== undefined) {
      return true;
    }
    return false;
  }, [isConnected, state, progress, showWhenZero]);

  // Determine if progress is indeterminate
  const isIndeterminate = useMemo(() => {
    return showIndeterminate && isExecuting && (progress === undefined || progress < 0);
  }, [showIndeterminate, isExecuting, progress]);

  // Calculate effective progress
  const effectiveProgress = useMemo(() => {
    if (isIndeterminate) return 0;
    if (progress === undefined || progress < 0) return 0;
    return Math.min(100, Math.max(0, progress));
  }, [progress, isIndeterminate]);

  // Build container styles
  const containerStyles = useMemo<CSSProperties>(() => {
    return {
      ...getContainerStyles(position, height),
      ...style,
    };
  }, [position, height, style]);

  // Build track styles
  const trackStyles = useMemo<CSSProperties>(() => {
    return getTrackStyles(trackColor);
  }, [trackColor]);

  // Build progress bar styles
  const progressStyles = useMemo<CSSProperties>(() => {
    return getProgressStyles(effectiveProgress, progressColor, enableAnimations, isIndeterminate);
  }, [effectiveProgress, progressColor, enableAnimations, isIndeterminate]);

  // Build CSS class
  const cssClass = useMemo(() => {
    return [
      "flow-node-progress",
      `flow-node-progress--${position}`,
      isIndeterminate && "flow-node-progress--indeterminate",
      className,
    ]
      .filter(Boolean)
      .join(" ");
  }, [position, isIndeterminate, className]);

  // Don't render if not connected or progress shouldn't be shown
  if (!shouldShowProgress) {
    return null;
  }

  const ariaLabel = isIndeterminate
    ? "Execution progress: loading"
    : `Execution progress: ${effectiveProgress}%`;

  return (
    <div
      className={cssClass}
      style={containerStyles}
      data-testid={testId ?? `flow-node-progress-${entityId}`}
      data-position={position}
      data-indeterminate={isIndeterminate || undefined}
    >
      {/* Native progress element for accessibility */}
      <progress
        value={isIndeterminate ? undefined : effectiveProgress}
        max={100}
        aria-label={ariaLabel}
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0, border: 0, padding: 0, margin: "-1px" }}
      />

      {/* Track (background) */}
      <div
        className="flow-node-progress__track"
        style={trackStyles}
        data-testid={testId ? `${testId}-track` : `flow-node-progress-${entityId}-track`}
      />

      {/* Progress bar */}
      <div
        className="flow-node-progress__bar"
        style={progressStyles}
        data-testid={testId ? `${testId}-bar` : `flow-node-progress-${entityId}-bar`}
      />
    </div>
  );
};

// =============================================================================
// Convenience Components
// =============================================================================

/**
 * Preset: Top position progress bar
 * @param props - Component props (same as FlowNodeProgressProps without position)
 * @returns Progress bar fixed to the top of the node
 */
export const FlowNodeProgressTop: React.FC<Omit<FlowNodeProgressProps, "position">> = (props) => (
  <FlowNodeProgress {...props} position="top" />
);

/**
 * Preset: Bottom position progress bar
 * @param props - Component props (same as FlowNodeProgressProps without position)
 * @returns Progress bar fixed to the bottom of the node
 */
export const FlowNodeProgressBottom: React.FC<Omit<FlowNodeProgressProps, "position">> = (
  props
) => <FlowNodeProgress {...props} position="bottom" />;

/**
 * Preset: Overlay position progress bar
 * @param props - Component props (same as FlowNodeProgressProps without position)
 * @returns Progress bar overlaid across the full node
 */
export const FlowNodeProgressOverlay: React.FC<Omit<FlowNodeProgressProps, "position">> = (
  props
) => <FlowNodeProgress {...props} position="overlay" />;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Gets the CSS class name for a progress indicator with the given position
 * @param position Progress bar position
 * @param isIndeterminate Whether progress is indeterminate
 * @returns CSS class name string
 */
export function getProgressClassName(position: ProgressPosition, isIndeterminate = false): string {
  const classes = ["flow-node-progress", `flow-node-progress--${position}`];
  if (isIndeterminate) {
    classes.push("flow-node-progress--indeterminate");
  }
  return classes.join(" ");
}

/**
 * Checks if the given state should show a progress indicator
 * @param state Execution state
 * @returns Whether progress should be shown
 */
export function shouldShowProgressForState(state: ExecutionState): boolean {
  return PROGRESS_SHOWING_STATES.has(state);
}

// Default export
export default FlowNodeProgress;
