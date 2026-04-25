/**
 * @file Flow Node Themes - 共享主题配置
 * @description
 * 定义 Flow 节点（Start, Action, Decision, End）的主题样式，
 * 供 TSX 组件和 Canvas 渲染两种模式共享使用。
 *
 * @see docs/design/flow-node-canvas-integration-plan.md
 */

// ============================================================================
// Types
// ============================================================================

/**
 * 节点形状类型
 */
export type FlowNodeShape = "circle" | "rectangle" | "diamond";

/**
 * 单个节点的主题配置
 */
export interface FlowNodeThemeConfig {
  /** 背景色 */
  backgroundColor: string;
  /** 边框色 */
  borderColor: string;
  /** 标题栏颜色 */
  headerColor: string;
  /** 文字颜色 */
  textColor: string;
  /** 边框圆角 */
  borderRadius: number;
  /** 节点形状 */
  shape: FlowNodeShape;
  /** 默认宽度 */
  defaultWidth: number;
  /** 默认高度 */
  defaultHeight: number;
}

// ============================================================================
// Theme Definitions
// ============================================================================

/**
 * Flow 节点主题配置
 *
 * @example
 * ```typescript
 * import { FLOW_NODE_THEMES } from './flow-node-themes';
 *
 * const startTheme = FLOW_NODE_THEMES.start;
 * console.log(startTheme.backgroundColor); // "#D1FAE5"
 * ```
 */
export const FLOW_NODE_THEMES = {
  /**
   * 开始节点 - 绿色圆角矩形卡片
   * 包含表单内容，可直接交互
   */
  start: {
    backgroundColor: "#ffffff",
    borderColor: "#10B981",
    headerColor: "#10B981",
    textColor: "#065F46",
    borderRadius: 12,
    shape: "rectangle" as const,
    defaultWidth: 280,
    defaultHeight: 220,
  },

  /**
   * 操作节点 - 蓝色圆角矩形
   */
  action: {
    backgroundColor: "#DBEAFE",
    borderColor: "#3B82F6",
    headerColor: "#3B82F6",
    textColor: "#1E40AF",
    borderRadius: 8,
    shape: "rectangle" as const,
    defaultWidth: 220,
    defaultHeight: 180,
  },

  /**
   * 判断节点 - 黄色菱形
   */
  decision: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    headerColor: "#F59E0B",
    textColor: "#92400E",
    borderRadius: 0,
    shape: "diamond" as const,
    defaultWidth: 100,
    defaultHeight: 100,
  },

  /**
   * 结束节点 - 红色双圆环
   */
  end: {
    backgroundColor: "#FEE2E2",
    borderColor: "#EF4444",
    headerColor: "#EF4444",
    textColor: "#991B1B",
    borderRadius: 50,
    shape: "circle" as const,
    defaultWidth: 80,
    defaultHeight: 80,
  },
} as const satisfies Record<string, FlowNodeThemeConfig>;

/**
 * Flow 节点类型
 */
export type FlowNodeType = keyof typeof FLOW_NODE_THEMES;

/**
 * 获取节点主题配置
 * @param type - 节点类型
 * @returns 主题配置
 */
export function getFlowNodeTheme(type: FlowNodeType): FlowNodeThemeConfig {
  return FLOW_NODE_THEMES[type];
}

/**
 * 所有节点类型列表
 */
export const FLOW_NODE_TYPES: readonly FlowNodeType[] = [
  "start",
  "action",
  "decision",
  "end",
] as const;
