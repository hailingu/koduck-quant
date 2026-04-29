/**
 * @file FlowNodeStatus Component
 * @description Displays execution state (idle/running/success/error, etc.) on nodes
 * using icons/colors with simple animations.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 3.3
 */

import React, { useMemo, type CSSProperties, type ReactNode } from "react";
import { useFlowEntityContext } from "../context";
import { useExecutionStateOptional } from "../hooks";
import type { ExecutionState, FlowNodeTheme } from "../types";

// =============================================================================
// Constants
// =============================================================================

/**
 * Default status indicator size in pixels
 */
const DEFAULT_STATUS_SIZE = 12;

/**
 * State-to-icon mapping using Unicode symbols
 * These can be overridden via ExecutionVisualConfig.stateIcons
 */
const DEFAULT_STATE_ICONS: Record<ExecutionState, string> = {
  idle: "●", // Solid circle
  pending: "◐", // Half circle
  running: "●", // Solid circle (with animation)
  success: "✓", // Checkmark
  error: "✕", // X mark
  skipped: "○", // Empty circle
  cancelled: "⊘", // Circle with slash
};

/**
 * State-to-label mapping for accessibility and display
 */
const STATE_LABELS: Record<ExecutionState, string> = {
  idle: "Idle",
  pending: "Pending",
  running: "Running",
  success: "Success",
  error: "Error",
  skipped: "Skipped",
  cancelled: "Cancelled",
};

/**
 * CSS animation keyframes for different states
 */
const ANIMATION_STYLES: Partial<Record<ExecutionState, CSSProperties>> = {
  running: {
    animation: "flow-node-pulse 1.5s ease-in-out infinite",
  },
  pending: {
    animation: "flow-node-pulse 2s ease-in-out infinite",
  },
  success: {
    animation: "flow-node-success-pop 0.3s ease-out forwards",
  },
  error: {
    animation: "flow-node-error-shake 0.4s ease-in-out",
  },
};

// =============================================================================
// Types
// =============================================================================

/**
 * Position options for the status indicator
 */
export type StatusPosition = "header" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

/**
 * Size options for the status indicator
 */
export type StatusSize = "small" | "medium" | "large" | number;

/**
 * Props for FlowNodeStatus component
 */
export interface FlowNodeStatusProps {
  /**
   * The entity ID to subscribe to for execution state
   */
  entityId: string;

  /**
   * Whether to show the state label text
   * @default false
   */
  showLabel?: boolean;

  /**
   * Position of the status indicator
   * @default 'header'
   */
  position?: StatusPosition;

  /**
   * Size of the status indicator
   * @default 'medium'
   */
  size?: StatusSize;

  /**
   * Whether to show progress bar for running state
   * @default true (inherits from ExecutionVisualConfig)
   */
  showProgress?: boolean;

  /**
   * Whether to enable animations
   * @default true (inherits from ExecutionVisualConfig)
   */
  enableAnimations?: boolean;

  /**
   * Custom icon renderer for different states
   */
  iconRenderer?: (state: ExecutionState, theme: FlowNodeTheme) => ReactNode;

  /**
   * Callback when status is clicked
   */
  onClick?: (state: ExecutionState) => void;

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

/**
 * Internal props for the status indicator element
 */
interface StatusIndicatorProps {
  state: ExecutionState;
  color: string;
  size: number;
  icon: string;
  enableAnimations: boolean;
  style?: CSSProperties;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Converts StatusSize to pixel value
 * @param size Size token (small/medium/large) or pixel value
 * @returns Size in pixels for the status indicator
 */
function getSizeInPixels(size: StatusSize): number {
  if (typeof size === "number") return size;
  switch (size) {
    case "small":
      return 8;
    case "medium":
      return 12;
    case "large":
      return 16;
    default:
      return DEFAULT_STATUS_SIZE;
  }
}

/**
 * Gets position styles based on StatusPosition
 * @param position Placement of the status indicator on the node
 * @returns CSS positioning styles for the status container
 */
function getPositionStyles(position: StatusPosition): CSSProperties {
  const baseStyles: CSSProperties = {
    position: "absolute",
  };

  switch (position) {
    case "top-left":
      return { ...baseStyles, top: 4, left: 4 };
    case "top-right":
      return { ...baseStyles, top: 4, right: 4 };
    case "bottom-left":
      return { ...baseStyles, bottom: 4, left: 4 };
    case "bottom-right":
      return { ...baseStyles, bottom: 4, right: 4 };
    case "header":
    default:
      return {}; // No absolute positioning for header
  }
}

/**
 * Gets the color for a given execution state from theme
 * @param state Current execution state of the node
 * @param theme Flow node theme containing state color mappings
 * @returns Theme color mapped to the execution state
 */
function getStateColor(state: ExecutionState, theme: FlowNodeTheme): string {
  return theme.executionStateColors?.[state] ?? getDefaultStateColor(state);
}

/**
 * Default colors for execution states
 * @param state Execution state to get the fallback color for
 * @returns Fallback color value for the provided execution state
 */
function getDefaultStateColor(state: ExecutionState): string {
  switch (state) {
    case "idle":
      return "#9ca3af"; // Gray
    case "pending":
      return "#f59e0b"; // Amber
    case "running":
      return "#3b82f6"; // Blue
    case "success":
      return "#10b981"; // Green
    case "error":
      return "#ef4444"; // Red
    case "skipped":
      return "#6b7280"; // Gray-500
    case "cancelled":
      return "#f97316"; // Orange
    default:
      return "#9ca3af";
  }
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Status indicator element (the dot/icon)
 * @returns Visual indicator element for the current execution state
 */
const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  state,
  color,
  size,
  icon,
  enableAnimations,
  style,
}) => {
  const indicatorStyle = useMemo<CSSProperties>(() => {
    const baseStyle: CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      minWidth: size,
      minHeight: size,
      borderRadius: "50%",
      backgroundColor: color,
      color: "#ffffff",
      fontSize: size * 0.7,
      fontWeight: "bold",
      lineHeight: 1,
      transition: "background-color 0.2s ease, transform 0.2s ease",
      ...style,
    };

    // Add animation styles if enabled
    if (enableAnimations && ANIMATION_STYLES[state]) {
      return { ...baseStyle, ...ANIMATION_STYLES[state] };
    }

    return baseStyle;
  }, [state, color, size, enableAnimations, style]);

  // For simple dot states, don't show icon inside
  const showIcon = ["success", "error", "skipped", "cancelled"].includes(state);

  return (
    <span style={indicatorStyle} aria-hidden="true">
      {showIcon ? icon : ""}
    </span>
  );
};

/**
 * Progress bar component for running state
 * @returns Progress bar element when progress is available; otherwise null
 */
const StatusProgress: React.FC<{
  progress: number | undefined;
  color: string;
  width?: number;
}> = ({ progress, color, width = 40 }) => {
  if (progress === undefined || progress < 0) return null;

  const progressPercentage = Math.min(100, Math.max(0, progress));

  const containerStyle: CSSProperties = {
    width,
    height: 3,
    backgroundColor: `${color}30`,
    borderRadius: 2,
    overflow: "hidden",
    marginLeft: 8,
  };

  return (
    <progress
      style={containerStyle}
      value={progressPercentage}
      max={100}
      aria-label="Execution progress"
    >
      {progressPercentage}%
    </progress>
  );
};

// =============================================================================
// Main Component
// =============================================================================

/**
 * FlowNodeStatus - Displays execution state on flow nodes
 *
 * Shows the current execution state of a node using color-coded indicators
 * with optional animations and progress display.
 *
 * @returns Execution status UI for a flow node, or null if state context is unavailable
 * @example Basic usage
 * ```tsx
 * <FlowNodeStatus entityId={node.id} />
 * ```
 *
 * @example With label and position
 * ```tsx
 * <FlowNodeStatus
 *   entityId={node.id}
 *   showLabel
 *   position="top-right"
 *   size="large"
 * />
 * ```
 *
 * @example With custom icon renderer
 * ```tsx
 * <FlowNodeStatus
 *   entityId={node.id}
 *   iconRenderer={(state) => <CustomIcon state={state} />}
 * />
 * ```
 */
export const FlowNodeStatus: React.FC<FlowNodeStatusProps> = ({
  entityId,
  showLabel = false,
  position = "header",
  size = "medium",
  showProgress: showProgressProp,
  enableAnimations: enableAnimationsProp,
  iconRenderer,
  onClick,
  className,
  style,
  "data-testid": testId,
}) => {
  // Get context for theme and visual config
  const { theme, executionVisuals } = useFlowEntityContext();

  // Subscribe to execution state (optional - works without ExecutionStateProvider)
  const { state, progress, isExecuting, isConnected } = useExecutionStateOptional({ entityId });

  // If not connected to ExecutionStateProvider, don't render anything
  if (!isConnected) {
    return null;
  }

  // Merge props with config defaults
  const showProgress = showProgressProp ?? executionVisuals.showProgress ?? true;
  const enableAnimations = enableAnimationsProp ?? executionVisuals.enablePulse ?? true;

  // Get state color from theme
  const stateColor = getStateColor(state, theme.node);

  // Get state icon
  const customIcons = executionVisuals.stateIcons;
  const stateIcon = customIcons?.[state] ?? DEFAULT_STATE_ICONS[state];

  // Get size in pixels
  const sizeInPx = getSizeInPixels(size);

  // Build container styles
  const positionStyles = getPositionStyles(position);
  const containerStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: onClick ? "pointer" : "default",
    ...positionStyles,
    ...style,
  };

  // Handle click
  const handleClick = () => {
    onClick?.(state);
  };

  // Build CSS class
  const cssClass = ["flow-node-status", `flow-node-status--${state}`, className]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {/* Custom icon renderer or default indicator */}
      {iconRenderer ? (
        iconRenderer(state, theme.node)
      ) : (
        <StatusIndicator
          state={state}
          color={stateColor}
          size={sizeInPx}
          icon={stateIcon}
          enableAnimations={enableAnimations}
        />
      )}

      {/* Progress bar for running state */}
      {showProgress && isExecuting && <StatusProgress progress={progress} color={stateColor} />}

      {/* Optional state label */}
      {showLabel && (
        <span
          className="flow-node-status__label"
          style={{
            fontSize: 12,
            color: theme.node.secondaryTextColor ?? "#6b7280",
          }}
        >
          {STATE_LABELS[state]}
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cssClass}
        style={containerStyle}
        onClick={handleClick}
        aria-label={`Execution state: ${STATE_LABELS[state]}`}
        data-testid={testId ?? `flow-node-status-${entityId}`}
        data-state={state}
      >
        {content}
      </button>
    );
  }

  return (
    <output
      className={cssClass}
      style={containerStyle}
      aria-label={`Execution state: ${STATE_LABELS[state]}`}
      data-testid={testId ?? `flow-node-status-${entityId}`}
      data-state={state}
    >
      {content}
    </output>
  );
};

// =============================================================================
// Convenience Components
// =============================================================================

/**
 * Compact status dot without label (for use in headers)
 * @returns Compact execution status dot component
 */
export const FlowNodeStatusDot: React.FC<{
  entityId: string;
  size?: StatusSize;
  className?: string;
  "data-testid"?: string;
}> = ({ entityId, size = "small", className, "data-testid": testId }) => (
  <FlowNodeStatus
    entityId={entityId}
    size={size}
    showLabel={false}
    showProgress={false}
    {...(className === undefined ? {} : { className })}
    {...(testId === undefined ? {} : { "data-testid": testId })}
  />
);

/**
 * Status badge with label (for detail views)
 * @returns Labeled execution status badge component
 */
export const FlowNodeStatusBadge: React.FC<{
  entityId: string;
  showProgress?: boolean;
  className?: string;
  "data-testid"?: string;
}> = ({ entityId, showProgress = true, className, "data-testid": testId }) => (
  <FlowNodeStatus
    entityId={entityId}
    showLabel
    showProgress={showProgress}
    size="medium"
    {...(className === undefined ? {} : { className })}
    {...(testId === undefined ? {} : { "data-testid": testId })}
  />
);

// Default export
export default FlowNodeStatus;
