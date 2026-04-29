/**
 * @file EdgeAnimation Component
 * @description Implements animations on edges to represent data flow and success/failure states.
 * Provides visual feedback during flow execution with flowing particles, success pulses, and error highlights.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 3.4
 */

import React, { useMemo, type CSSProperties } from "react";
import { useFlowEntityContext } from "../context";
import type { EdgeAnimationState, EdgeAnimationConfig, FlowEdgeTheme } from "../types";

// =============================================================================
// Constants
// =============================================================================

/**
 * Default animation configuration values
 */
const DEFAULT_CONFIG: Required<Omit<EdgeAnimationConfig, "animation">> = {
  enabled: true,
  particleSpeed: 1,
  particleSize: 4,
  particleCount: 3,
};

/**
 * Animation duration multiplier base (in seconds)
 */
const BASE_ANIMATION_DURATION = 1;

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the EdgeAnimation component
 */
export interface EdgeAnimationProps {
  /**
   * SVG path string for the edge
   */
  path: string;

  /**
   * Current animation state of the edge
   * @default 'idle'
   */
  state?: EdgeAnimationState;

  /**
   * Animation configuration
   */
  config?: EdgeAnimationConfig;

  /**
   * Stroke color (uses theme if not provided)
   */
  strokeColor?: string;

  /**
   * Stroke width in pixels
   * @default 2
   */
  strokeWidth?: number;

  /**
   * Whether animations are enabled globally
   * @default true
   */
  animationsEnabled?: boolean;

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
 * Get color for the current animation state
 * @param state The current animation state of the edge
 * @param theme The edge theme configuration
 * @param customColor Optional override color; takes precedence over theme and state colors.
 * @returns The resolved CSS color string for the given state.
 */
function getStateColor(
  state: EdgeAnimationState,
  theme: FlowEdgeTheme,
  customColor?: string
): string {
  if (customColor) {
    return customColor;
  }

  switch (state) {
    case "success":
      // Use theme's success color or fallback
      return "#10b981"; // green-500
    case "error":
      // Use theme's error color or fallback
      return "#ef4444"; // red-500
    case "highlight":
      return theme.selectedColor ?? "#3b82f6"; // blue-500
    case "flowing":
    case "idle":
    default:
      return theme.strokeColor ?? "#9ca3af"; // gray-400
  }
}

/**
 * Get CSS class names for the animation state
 * @param state The current animation state
 * @returns A space-separated CSS class string combining the base and state-specific class names.
 */
function getStateClassName(state: EdgeAnimationState): string {
  const baseClass = "flow-edge-animation";
  const stateClass = `flow-edge-animation--${state}`;

  return `${baseClass} ${stateClass}`;
}

/**
 * Calculate animation duration based on config
 * @param config The edge animation configuration
 * @returns The calculated animation duration in milliseconds
 */
function getAnimationDuration(config: EdgeAnimationConfig): number {
  const speed = config.particleSpeed ?? DEFAULT_CONFIG.particleSpeed;
  // Higher speed = shorter duration
  return BASE_ANIMATION_DURATION / Math.max(speed, 0.1);
}

/**
 * Get stroke-dasharray for flowing animation
 * @param config The edge animation configuration
 * @returns The stroke-dasharray string for the SVG path
 */
function getDashArray(config: EdgeAnimationConfig): string {
  const particleSize = config.particleSize ?? DEFAULT_CONFIG.particleSize;
  const gapSize = Math.max(particleSize, 4);
  return `${particleSize} ${gapSize}`;
}

// =============================================================================
// Component
// =============================================================================

/**
 * EdgeAnimation - Renders animated overlay for edge paths
 *
 * This component renders an SVG path with animation effects based on the current state:
 * - `idle`: No animation, uses base stroke color
 * - `flowing`: Animated dashed stroke moving along the path
 * - `success`: Brief pulse animation with green color
 * - `error`: Brief pulse animation with red color
 * - `highlight`: Glow effect with selection color
 *
 * The component is designed to be layered on top of the base edge path
 * to provide animation effects without modifying the base rendering.
 *
 * @example
 * ```tsx
 * <svg>
 *   <EdgePath source={source} target={target} ... />
 *   <EdgeAnimation
 *     path={pathD}
 *     state="flowing"
 *     config={{ particleSpeed: 2, particleSize: 6 }}
 *   />
 * </svg>
 * ```
 *
 * @example With all states
 * ```tsx
 * // Idle - no animation
 * <EdgeAnimation path={pathD} state="idle" />
 *
 * // Flowing - animated dash
 * <EdgeAnimation path={pathD} state="flowing" />
 *
 * // Success - green pulse
 * <EdgeAnimation path={pathD} state="success" />
 *
 * // Error - red pulse
 * <EdgeAnimation path={pathD} state="error" />
 *
 * // Highlight - glow effect
 * <EdgeAnimation path={pathD} state="highlight" />
 * ```
 */
export const EdgeAnimation: React.FC<EdgeAnimationProps> = React.memo(function EdgeAnimation({
  path,
  state = "idle",
  config,
  strokeColor,
  strokeWidth = 2,
  animationsEnabled = true,
  className,
  style,
  "data-testid": testId,
}) {
  // Get theme from context
  const { theme } = useFlowEntityContext();
  const edgeTheme = theme.edge;

  // Merge config with defaults
  const effectiveConfig = useMemo<EdgeAnimationConfig>(
    () => ({
      ...DEFAULT_CONFIG,
      ...config,
    }),
    [config]
  );

  // Check if animation is enabled
  const isAnimationEnabled = animationsEnabled && (effectiveConfig.enabled ?? true);

  // Determine stroke color based on state
  const effectiveStrokeColor = useMemo(
    () => getStateColor(state, edgeTheme, strokeColor),
    [state, edgeTheme, strokeColor]
  );

  // Calculate animation duration
  const animationDuration = useMemo(() => getAnimationDuration(effectiveConfig), [effectiveConfig]);

  // Calculate dash array for flowing state
  const dashArray = useMemo(() => getDashArray(effectiveConfig), [effectiveConfig]);

  // Build path styles based on state
  const pathStyle = useMemo<CSSProperties>(() => {
    const baseStyle: CSSProperties = {
      fill: "none",
      stroke: effectiveStrokeColor,
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      pointerEvents: "none",
      ...style,
    };

    // Skip animations if disabled
    if (!isAnimationEnabled || state === "idle") {
      return baseStyle;
    }

    switch (state) {
      case "flowing":
        return {
          ...baseStyle,
          strokeDasharray: dashArray,
          animation: `flow-edge-dash ${animationDuration}s linear infinite`,
        };

      case "success":
        return {
          ...baseStyle,
          animation: `flow-edge-success-pulse 0.6s ease-out`,
        };

      case "error":
        return {
          ...baseStyle,
          animation: `flow-edge-error-pulse 0.6s ease-out`,
        };

      case "highlight":
        return {
          ...baseStyle,
          filter: `drop-shadow(0 0 4px ${effectiveStrokeColor})`,
          animation: `flow-edge-glow 1s ease-in-out infinite alternate`,
        };

      default:
        return baseStyle;
    }
  }, [
    state,
    effectiveStrokeColor,
    strokeWidth,
    isAnimationEnabled,
    dashArray,
    animationDuration,
    style,
  ]);

  // Build class name
  const combinedClassName = useMemo(() => {
    const stateClassName = getStateClassName(state);
    const animatingClass =
      isAnimationEnabled && state !== "idle" ? "flow-edge-animation--animating" : "";
    return [stateClassName, animatingClass, className].filter(Boolean).join(" ");
  }, [state, isAnimationEnabled, className]);

  // Don't render anything for idle state without specific requirement
  // Idle state can still render for consistent layering
  return (
    <path
      d={path}
      className={combinedClassName}
      style={pathStyle}
      data-testid={testId ?? `flow-edge-animation-${state}`}
      data-state={state}
      data-animations-enabled={isAnimationEnabled}
    />
  );
});

// Default export for convenience
export default EdgeAnimation;

// =============================================================================
// Compound Components
// =============================================================================

/**
 * Props for EdgeAnimationParticles component
 */
export interface EdgeAnimationParticlesProps {
  /**
   * SVG path string for the edge
   */
  path: string;

  /**
   * Number of particles to render
   * @default 3
   */
  count?: number;

  /**
   * Particle size in pixels
   * @default 4
   */
  size?: number;

  /**
   * Animation duration in seconds
   * @default 2
   */
  duration?: number;

  /**
   * Particle color
   * @default '#3b82f6'
   */
  color?: string;

  /**
   * Whether particles are visible/animated
   * @default true
   */
  visible?: boolean;

  /**
   * Test ID for testing
   */
  "data-testid"?: string;
}

/**
 * EdgeAnimationParticles - Renders animated particles along an edge path
 *
 * This component creates multiple circles that animate along the edge path
 * to visualize data flow direction. Each particle is offset in time to
 * create a continuous stream effect.
 *
 * @example
 * ```tsx
 * <svg>
 *   <EdgePath source={source} target={target} ... />
 *   <EdgeAnimationParticles
 *     path={pathD}
 *     count={3}
 *     size={6}
 *     color="#3b82f6"
 *   />
 * </svg>
 * ```
 */
export const EdgeAnimationParticles: React.FC<EdgeAnimationParticlesProps> = React.memo(
  function EdgeAnimationParticles({
    path,
    count = 3,
    size = 4,
    duration = 2,
    color = "#3b82f6",
    visible = true,
    "data-testid": testId,
  }) {
    // Generate particle elements
    const particles = useMemo(() => {
      if (!visible) {
        return null;
      }

      return Array.from({ length: count }, (_, index) => {
        // Calculate delay for each particle (evenly distributed)
        const delay = (duration / count) * index;

        return (
          <circle
            key={index}
            r={size / 2}
            fill={color}
            className="flow-edge-particle"
            data-testid={testId ? `${testId}-particle-${index}` : undefined}
            style={{
              animation: `flow-particle ${duration}s linear infinite`,
              animationDelay: `-${delay}s`,
              offsetPath: `path('${path}')`,
              offsetRotate: "0deg",
            }}
          />
        );
      });
    }, [path, count, size, duration, color, visible, testId]);

    if (!visible) {
      return null;
    }

    return (
      <g
        className="flow-edge-particles"
        data-testid={testId ?? "flow-edge-particles"}
        data-particle-count={count}
      >
        {particles}
      </g>
    );
  }
);

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get animation class name for an edge based on its animation state
 *
 * @param state - The current animation state
 * @param animationsEnabled - Whether animations are enabled
 * @returns CSS class name string
 */
export function getEdgeAnimationClassName(
  state: EdgeAnimationState,
  animationsEnabled = true
): string {
  if (!animationsEnabled || state === "idle") {
    return "";
  }

  return `flow-edge--${state}`;
}

/**
 * Check if an edge should be animating based on its state
 *
 * @param state - The current animation state
 * @returns Whether the edge should be animating
 */
export function isEdgeAnimating(state: EdgeAnimationState): boolean {
  return state !== "idle";
}

/**
 * Get the appropriate color for an edge based on its animation state
 *
 * @param state - The current animation state
 * @param theme - The edge theme configuration
 * @returns Color string
 */
export function getEdgeStateColor(state: EdgeAnimationState, theme: FlowEdgeTheme): string {
  return getStateColor(state, theme);
}
