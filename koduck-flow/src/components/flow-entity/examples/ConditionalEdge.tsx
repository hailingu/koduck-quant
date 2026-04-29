/**
 * @file ConditionalEdge - Conditional edge example
 * @description
 * Conditional edge represents a conditional branch connection in the flow diagram.
 * Displays a condition label on the edge and supports custom path styles.
 *
 * @example
 * ```tsx
 * import { createConditionalEdge } from './ConditionalEdge';
 *
 * const edgeEntity = createConditionalEdge({
 *   source: 'decision-1',
 *   sourcePort: 'true-output',
 *   target: 'action-1',
 *   targetPort: 'input',
 *   condition: 'x > 10',
 *   conditionResult: true
 * });
 * ```
 */

import { FlowEdgeEntity } from "../../../common/flow/flow-edge-entity";
import type { FlowEdgeTheme, PathType } from "../types";

// ============================================================================
// Types
// ============================================================================

/**
 * Conditional edge configuration
 */
export interface ConditionalEdgeConfig {
  /** Source node ID */
  source: string;
  /** Source port ID */
  sourcePort: string;
  /** Target node ID */
  target: string;
  /** Target port ID */
  targetPort: string;
  /** Condition expression */
  condition?: string;
  /** Condition result (true/false) */
  conditionResult?: boolean;
  /** Label */
  label?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Conditional edge theme - true branch (green)
 */
const TRUE_EDGE_THEME: Partial<FlowEdgeTheme> = {
  strokeColor: "#10B981",
  strokeWidth: 2,
  selectedColor: "#059669",
};

/**
 * Conditional edge theme - false branch (red)
 */
const FALSE_EDGE_THEME: Partial<FlowEdgeTheme> = {
  strokeColor: "#EF4444",
  strokeWidth: 2,
  selectedColor: "#DC2626",
};

/**
 * Default path type
 */
const DEFAULT_PATH_TYPE: PathType = "smoothstep";

// ============================================================================
// Entity Factory
// ============================================================================

/**
 * Create conditional edge entity
 *
 * @param config - Edge configuration
 * @returns FlowEdgeEntity instance
 *
 * @example
 * ```tsx
 * // Create true branch edge
 * const trueEdge = createConditionalEdge({
 *   source: 'decision-1',
 *   sourcePort: 'true-output',
 *   target: 'action-1',
 *   targetPort: 'input',
 *   condition: 'age >= 18',
 *   conditionResult: true
 * });
 *
 * // Create false branch edge
 * const falseEdge = createConditionalEdge({
 *   source: 'decision-1',
 *   sourcePort: 'false-output',
 *   target: 'action-2',
 *   targetPort: 'input',
 *   condition: 'age < 18',
 *   conditionResult: false
 * });
 * ```
 */
export function createConditionalEdge(config: ConditionalEdgeConfig): FlowEdgeEntity {
  const {
    source,
    sourcePort,
    target,
    targetPort,
    condition = "",
    conditionResult = true,
    label,
  } = config;

  // Select theme based on condition result
  const theme = conditionResult ? TRUE_EDGE_THEME : FALSE_EDGE_THEME;

  // Generate label
  const edgeLabel = label || (conditionResult ? "是" : "否");

  return new FlowEdgeEntity({
    edgeType: "conditional",
    label: edgeLabel,
    sourceNodeId: source,
    sourcePortId: sourcePort,
    targetNodeId: target,
    targetPortId: targetPort,
    pathType: DEFAULT_PATH_TYPE,
    theme,
    metadata: {
      condition,
      conditionResult,
    },
  });
}

export default createConditionalEdge;
