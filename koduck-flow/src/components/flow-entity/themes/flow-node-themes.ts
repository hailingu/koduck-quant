/**
 * @file Flow Node Themes - Shared theme configuration
 * @description
 * Defines theme styles for Flow nodes (Start, Action, Decision, End),
 * Shared between TSX components and Canvas rendering modes.
 *
 * @see docs/design/flow-node-canvas-integration-plan.md
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Node shape type
 */
export type FlowNodeShape = "circle" | "rectangle" | "diamond";

/**
 * Theme configuration for a single node
 */
export interface FlowNodeThemeConfig {
  /** Background color */
  backgroundColor: string;
  /** Border color */
  borderColor: string;
  /** Header color */
  headerColor: string;
  /** Text color */
  textColor: string;
  /** Border radius */
  borderRadius: number;
  /** Node shape */
  shape: FlowNodeShape;
  /** Default width */
  defaultWidth: number;
  /** Default height */
  defaultHeight: number;
}

// ============================================================================
// Theme Definitions
// ============================================================================

/**
 * Flow node theme configuration
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
   * Start node - green rounded rectangle card
   * Contains form content, directly interactive
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
   * Action node - blue rounded rectangle
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
   * Decision node - yellow diamond
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
   * End node - red double circle
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
 * Flow node type
 */
export type FlowNodeType = keyof typeof FLOW_NODE_THEMES;

/**
 * Get node theme configuration
 * @param type - Node type
 * @returns Theme configuration
 */
export function getFlowNodeTheme(type: FlowNodeType): FlowNodeThemeConfig {
  return FLOW_NODE_THEMES[type];
}

/**
 * List of all node types
 */
export const FLOW_NODE_TYPES: readonly FlowNodeType[] = [
  "start",
  "action",
  "decision",
  "end",
] as const;
