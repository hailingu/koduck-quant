/**
 * @file FlowNodeHeader Component
 * @description Sub-component for rendering the header region of a flow node.
 * Supports customization via children or custom renderer, and integrates with theme.
 * Optionally displays execution state indicator.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 1.9, Task 3.3
 */

import React, { useMemo, type CSSProperties, type ReactNode } from "react";
import { useFlowEntityContext } from "../context";
import type { FlowNodeTheme } from "../types";
import type { FlowNodeEntity } from "../../../common/flow/flow-node-entity";
import { FlowNodeStatusDot } from "./FlowNodeStatus";

// =============================================================================
// Constants
// =============================================================================

/**
 * Default header height in pixels
 */
const DEFAULT_HEADER_HEIGHT = 40;

// =============================================================================
// Types
// =============================================================================

/**
 * Props for FlowNodeHeader component
 */
export interface FlowNodeHeaderProps {
  /**
   * The flow node entity this header belongs to
   */
  entity: FlowNodeEntity;

  /**
   * Whether the parent node is currently selected
   * @default false
   */
  selected?: boolean;

  /**
   * Custom header height in pixels
   * @default 40
   */
  height?: number;

  /**
   * Whether to show execution status indicator
   * @default true
   */
  showStatus?: boolean;

  /**
   * Children to render inside the header
   * If not provided, displays the node label
   */
  children?: ReactNode;

  /**
   * Custom renderer for the header content
   * Takes precedence over children if provided
   */
  renderer?: (props: {
    entity: FlowNodeEntity;
    theme: FlowNodeTheme;
    selected: boolean;
  }) => ReactNode;

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
// Component
// =============================================================================

/**
 * FlowNodeHeader - Sub-component for flow node header region
 *
 * Renders the header section of a flow node with:
 * - Theme-based styling (background, text color, border)
 * - Optional custom renderer or children for content
 * - Default label display when no custom content is provided
 *
 * @example
 * ```tsx
 * <FlowNodeHeader entity={nodeEntity}>
 *   <Icon name="task" /> {nodeEntity.data.label}
 * </FlowNodeHeader>
 * ```
 *
 * @example With custom renderer
 * ```tsx
 * <FlowNodeHeader
 *   entity={nodeEntity}
 *   renderer={({ entity, theme, selected }) => (
 *     <div style={{ color: selected ? 'blue' : theme.textColor }}>
 *       {entity.data.label}
 *     </div>
 *   )}
 * />
 * ```
 */
export const FlowNodeHeader: React.FC<FlowNodeHeaderProps> = React.memo(function FlowNodeHeader({
  entity,
  selected = false,
  height = DEFAULT_HEADER_HEIGHT,
  showStatus = true,
  children,
  renderer,
  className,
  style,
  "data-testid": testId,
}) {
  // Get theme from context
  const { theme } = useFlowEntityContext();
  const nodeTheme = theme.node;

  // Extract entity data
  const data = entity.data!;
  const { label } = data;

  // Header styles
  const headerStyle = useMemo<CSSProperties>(
    () => ({
      height,
      backgroundColor: nodeTheme.headerColor ?? nodeTheme.backgroundColor,
      borderBottom: `1px solid ${nodeTheme.borderColor}`,
      padding: "8px 12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      color: nodeTheme.textColor,
      fontWeight: 500,
      fontSize: 14,
      overflow: "hidden",
      ...style,
    }),
    [height, nodeTheme, style]
  );

  // Label container styles
  const labelContainerStyle = useMemo<CSSProperties>(
    () => ({
      display: "flex",
      alignItems: "center",
      gap: 8,
      flex: 1,
      minWidth: 0,
      overflow: "hidden",
    }),
    []
  );

  // Label text styles
  const labelStyle = useMemo<CSSProperties>(
    () => ({
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    }),
    []
  );

  // Determine content to render
  const renderContent = (): ReactNode => {
    // Custom renderer takes precedence
    if (renderer) {
      return renderer({ entity, theme: nodeTheme, selected });
    }
    // Then children
    if (children) {
      return children;
    }
    // Default: display status indicator and label with title for tooltip
    return (
      <div style={labelContainerStyle}>
        {showStatus && <FlowNodeStatusDot entityId={entity.id} />}
        <span style={labelStyle} title={label}>
          {label}
        </span>
      </div>
    );
  };

  return (
    <div
      className={`flow-node-header ${className ?? ""}`.trim()}
      style={headerStyle}
      data-testid={testId ?? `flow-node-header-${entity.id}`}
    >
      {renderContent()}
    </div>
  );
});

// Default export for convenience
export default FlowNodeHeader;
