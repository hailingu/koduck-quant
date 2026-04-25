/**
 * @file Flow Entity React Context
 * @description Provides shared configuration for Flow Entity rendering including
 * themes, runtime references, and interaction configuration.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 1.7
 */

import React, { createContext, useContext, useMemo, type ReactNode } from "react";
import type {
  FlowTheme,
  FlowNodeTheme,
  FlowEdgeTheme,
  PortSystemConfig,
  ExecutionVisualConfig,
  EdgeAnimationConfig,
} from "./types";

// =============================================================================
// Default Theme Configuration
// =============================================================================

/**
 * Default theme for flow nodes
 */
export const DEFAULT_NODE_THEME: FlowNodeTheme = {
  backgroundColor: "#ffffff",
  borderColor: "#e5e7eb",
  borderWidth: 1,
  borderRadius: 8,
  headerColor: "#f9fafb",
  textColor: "#111827",
  secondaryTextColor: "#6b7280",
  shadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
  portColors: {
    default: "#9ca3af",
    connected: "#3b82f6",
    highlighted: "#10b981",
    error: "#ef4444",
  },
  executionStateColors: {
    idle: "#9ca3af",
    pending: "#f59e0b",
    running: "#3b82f6",
    success: "#10b981",
    error: "#ef4444",
    skipped: "#6b7280",
    cancelled: "#f97316",
  },
};

/**
 * Default theme for flow edges
 */
export const DEFAULT_EDGE_THEME: FlowEdgeTheme = {
  strokeColor: "#9ca3af",
  strokeWidth: 2,
  arrowColor: "#9ca3af",
  arrowSize: 10,
  opacity: 1,
  selectedColor: "#3b82f6",
  hoverColor: "#6b7280",
  animationStateColors: {
    idle: "#9ca3af",
    flowing: "#3b82f6",
    success: "#10b981",
    error: "#ef4444",
    highlight: "#f59e0b",
  },
};

/**
 * Default complete theme
 */
export const DEFAULT_FLOW_THEME: FlowTheme = {
  node: DEFAULT_NODE_THEME,
  edge: DEFAULT_EDGE_THEME,
  canvasBackground: "#f9fafb",
  gridColor: "#e5e7eb",
  selectionColor: "rgba(59, 130, 246, 0.2)",
};

/**
 * Default port system configuration
 */
export const DEFAULT_PORT_CONFIG: PortSystemConfig = {
  enableTypeChecking: true,
  showLabels: true,
  portSize: 10,
  portSpacing: 16,
  allowIncompatibleConnections: false,
};

/**
 * Default execution visual configuration
 */
export const DEFAULT_EXECUTION_VISUALS: ExecutionVisualConfig = {
  showProgress: true,
  enablePulse: true,
  showExecutionTime: true,
  progressPosition: "bottom",
  progressHeight: 4,
};

/**
 * Default edge animation configuration
 */
export const DEFAULT_EDGE_ANIMATION: EdgeAnimationConfig = {
  enabled: true,
  particleSpeed: 1,
  particleSize: 4,
  particleCount: 3,
};

// =============================================================================
// Context Value Interface
// =============================================================================

/**
 * Value provided by FlowEntityContext.
 * Contains shared configuration for Flow Entity rendering.
 */
export interface FlowEntityContextValue {
  /** Complete theme configuration */
  theme: FlowTheme;

  /** Port system configuration */
  portConfig: PortSystemConfig;

  /** Execution state visual configuration */
  executionVisuals: ExecutionVisualConfig;

  /** Edge animation configuration */
  edgeAnimation: EdgeAnimationConfig;

  /**
   * Optional runtime reference for engine integration.
   * Can be used to subscribe to execution events.
   */
  runtime?: unknown;

  /**
   * Whether the flow is currently in read-only mode.
   * When true, editing operations are disabled.
   */
  readOnly: boolean;

  /**
   * Whether to show debug information.
   * Useful during development.
   */
  debug: boolean;
}

// =============================================================================
// React Context
// =============================================================================

/**
 * React Context for Flow Entity configuration.
 * Undefined when used outside of FlowEntityProvider.
 */
const FlowEntityContext = createContext<FlowEntityContextValue | undefined>(undefined);

FlowEntityContext.displayName = "FlowEntityContext";

// =============================================================================
// Provider Props
// =============================================================================

/**
 * Props for FlowEntityProvider component
 */
export interface FlowEntityProviderProps {
  /** Child components to wrap */
  children: ReactNode;

  /** Theme configuration (partial, will be merged with defaults) */
  theme?: Partial<FlowTheme> & {
    node?: Partial<FlowNodeTheme>;
    edge?: Partial<FlowEdgeTheme>;
  };

  /** Port system configuration (partial) */
  portConfig?: Partial<PortSystemConfig>;

  /** Execution visual configuration (partial) */
  executionVisuals?: Partial<ExecutionVisualConfig>;

  /** Edge animation configuration (partial) */
  edgeAnimation?: Partial<EdgeAnimationConfig>;

  /** Runtime reference for engine integration */
  runtime?: unknown;

  /** Whether the flow is read-only */
  readOnly?: boolean;

  /** Whether to show debug information */
  debug?: boolean;
}

// =============================================================================
// Provider Component
// =============================================================================

/**
 * Provider component for Flow Entity context.
 * Wraps child components and provides shared configuration.
 *
 * @example
 * ```tsx
 * <FlowEntityProvider
 *   theme={{ node: { backgroundColor: '#f0f0f0' } }}
 *   readOnly={false}
 * >
 *   <FlowCanvas>
 *     <BaseFlowNode entity={nodeEntity} />
 *   </FlowCanvas>
 * </FlowEntityProvider>
 * ```
 */
export function FlowEntityProvider({
  children,
  theme,
  portConfig,
  executionVisuals,
  edgeAnimation,
  runtime,
  readOnly = false,
  debug = false,
}: FlowEntityProviderProps): React.JSX.Element {
  // Merge theme with defaults
  const mergedTheme = useMemo<FlowTheme>(() => {
    const nodeTheme: FlowNodeTheme = {
      ...DEFAULT_NODE_THEME,
      ...theme?.node,
      portColors: {
        ...DEFAULT_NODE_THEME.portColors,
        ...theme?.node?.portColors,
      },
      executionStateColors: {
        ...DEFAULT_NODE_THEME.executionStateColors,
        ...theme?.node?.executionStateColors,
      },
    };

    const edgeTheme: FlowEdgeTheme = {
      ...DEFAULT_EDGE_THEME,
      ...theme?.edge,
      animationStateColors: {
        ...DEFAULT_EDGE_THEME.animationStateColors,
        ...theme?.edge?.animationStateColors,
      },
    };

    return {
      node: nodeTheme,
      edge: edgeTheme,
      canvasBackground: theme?.canvasBackground ?? DEFAULT_FLOW_THEME.canvasBackground,
      gridColor: theme?.gridColor ?? DEFAULT_FLOW_THEME.gridColor,
      selectionColor: theme?.selectionColor ?? DEFAULT_FLOW_THEME.selectionColor,
      minimap: theme?.minimap,
    };
  }, [theme]);

  // Merge other configs with defaults
  const mergedPortConfig = useMemo<PortSystemConfig>(
    () => ({
      ...DEFAULT_PORT_CONFIG,
      ...portConfig,
    }),
    [portConfig]
  );

  const mergedExecutionVisuals = useMemo<ExecutionVisualConfig>(
    () => ({
      ...DEFAULT_EXECUTION_VISUALS,
      ...executionVisuals,
    }),
    [executionVisuals]
  );

  const mergedEdgeAnimation = useMemo<EdgeAnimationConfig>(
    () => ({
      ...DEFAULT_EDGE_ANIMATION,
      ...edgeAnimation,
    }),
    [edgeAnimation]
  );

  // Build context value
  const contextValue = useMemo<FlowEntityContextValue>(
    () => ({
      theme: mergedTheme,
      portConfig: mergedPortConfig,
      executionVisuals: mergedExecutionVisuals,
      edgeAnimation: mergedEdgeAnimation,
      runtime,
      readOnly,
      debug,
    }),
    [
      mergedTheme,
      mergedPortConfig,
      mergedExecutionVisuals,
      mergedEdgeAnimation,
      runtime,
      readOnly,
      debug,
    ]
  );

  return <FlowEntityContext.Provider value={contextValue}>{children}</FlowEntityContext.Provider>;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access Flow Entity context.
 * Must be used within a FlowEntityProvider.
 *
 * @throws Error if used outside of FlowEntityProvider
 *
 * @example
 * ```tsx
 * function MyFlowNode() {
 *   const { theme, portConfig, readOnly } = useFlowEntityContext();
 *   return <div style={{ backgroundColor: theme.node.backgroundColor }}>...</div>;
 * }
 * ```
 */
export function useFlowEntityContext(): FlowEntityContextValue {
  const context = useContext(FlowEntityContext);

  if (context === undefined) {
    throw new Error(
      "useFlowEntityContext must be used within a FlowEntityProvider. " +
        "Make sure to wrap your component tree with <FlowEntityProvider>."
    );
  }

  return context;
}

/**
 * Hook to optionally access Flow Entity context.
 * Returns undefined if used outside of FlowEntityProvider.
 * Useful for components that can work with or without the context.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const context = useOptionalFlowEntityContext();
 *   const theme = context?.theme ?? DEFAULT_FLOW_THEME;
 *   return <div>...</div>;
 * }
 * ```
 */
export function useOptionalFlowEntityContext(): FlowEntityContextValue | undefined {
  return useContext(FlowEntityContext);
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Hook to access only the theme configuration.
 * Convenience wrapper around useFlowEntityContext.
 */
export function useFlowTheme(): FlowTheme {
  const { theme } = useFlowEntityContext();
  return theme;
}

/**
 * Hook to access only the port configuration.
 * Convenience wrapper around useFlowEntityContext.
 */
export function usePortConfig(): PortSystemConfig {
  const { portConfig } = useFlowEntityContext();
  return portConfig;
}

/**
 * Hook to check if the flow is in read-only mode.
 */
export function useFlowReadOnly(): boolean {
  const { readOnly } = useFlowEntityContext();
  return readOnly;
}
