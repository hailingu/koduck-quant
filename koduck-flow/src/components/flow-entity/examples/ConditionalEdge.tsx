/**
 * @file ConditionalEdge - 条件边示例
 * @description
 * 条件边用于表示流程图中的条件分支连接。
 * 边上显示条件标签，支持自定义路径样式。
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
 * 条件边配置
 */
export interface ConditionalEdgeConfig {
  /** 源节点ID */
  source: string;
  /** 源端口ID */
  sourcePort: string;
  /** 目标节点ID */
  target: string;
  /** 目标端口ID */
  targetPort: string;
  /** 条件表达式 */
  condition?: string;
  /** 条件结果（true/false） */
  conditionResult?: boolean;
  /** 标签 */
  label?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * 条件边主题 - 真值分支（绿色）
 */
const TRUE_EDGE_THEME: Partial<FlowEdgeTheme> = {
  strokeColor: "#10B981",
  strokeWidth: 2,
  selectedColor: "#059669",
};

/**
 * 条件边主题 - 假值分支（红色）
 */
const FALSE_EDGE_THEME: Partial<FlowEdgeTheme> = {
  strokeColor: "#EF4444",
  strokeWidth: 2,
  selectedColor: "#DC2626",
};

/**
 * 默认路径类型
 */
const DEFAULT_PATH_TYPE: PathType = "smoothstep";

// ============================================================================
// Entity Factory
// ============================================================================

/**
 * 创建条件边实体
 *
 * @param config - 边配置
 * @returns FlowEdgeEntity 实例
 *
 * @example
 * ```tsx
 * // 创建真值分支边
 * const trueEdge = createConditionalEdge({
 *   source: 'decision-1',
 *   sourcePort: 'true-output',
 *   target: 'action-1',
 *   targetPort: 'input',
 *   condition: 'age >= 18',
 *   conditionResult: true
 * });
 *
 * // 创建假值分支边
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

  // 根据条件结果选择主题
  const theme = conditionResult ? TRUE_EDGE_THEME : FALSE_EDGE_THEME;

  // 生成标签
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
