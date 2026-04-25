/**
 * @file BaseFlowNode Component
 * @description Base skeleton component for rendering flow nodes.
 * Provides structural DOM (container, header, content, ports placeholder)
 * without interactive behaviors (drag, selection animation).
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 1.8, Task 1.9
 */

import React, { useCallback, useMemo, type CSSProperties, type ReactNode } from "react";
import { useFlowEntityContext } from "../context";
import { useFlowNode, useNodeDrag, useNodeResize, useSelectionContextOptional } from "../hooks";
import type { FlowNodeTheme, Position, Size } from "../types";
import type { FlowNodeEntity } from "../../../common/flow/flow-node-entity";
import { FlowNodeHeader } from "./FlowNodeHeader";
import { FlowNodeContent } from "./FlowNodeContent";
import { FlowNodePorts } from "./FlowNodePorts";

// =============================================================================
// Constants
// =============================================================================

/**
 * Default node dimensions when not specified
 */
const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 100;

/**
 * Default header height
 */
const DEFAULT_HEADER_HEIGHT = 40;

// =============================================================================
// Types
// =============================================================================

/**
 * Render mode for the node component
 */
export type NodeRenderMode = "default" | "minimal" | "compact" | "expanded";

/**
 * Props for custom header renderer
 */
export interface HeaderRendererProps {
  /** The node entity */
  entity: FlowNodeEntity;
  /** Current theme */
  theme: FlowNodeTheme;
  /** Whether the node is selected */
  selected: boolean;
}

/**
 * Props for custom content renderer
 */
export interface ContentRendererProps {
  /** The node entity */
  entity: FlowNodeEntity;
  /** Current theme */
  theme: FlowNodeTheme;
  /** Whether the node is selected */
  selected: boolean;
  /** Whether the node is in read-only mode */
  readOnly: boolean;
  /** Callback for form changes */
  onFormChange?: (values: Record<string, unknown>) => void;
}

/**
 * Props for custom footer renderer
 */
export interface FooterRendererProps {
  /** The node entity */
  entity: FlowNodeEntity;
  /** Current theme */
  theme: FlowNodeTheme;
  /** Whether the node is selected */
  selected: boolean;
}

/**
 * Base props for the BaseFlowNode component
 */
export interface BaseFlowNodeProps {
  /**
   * The flow node entity to render
   */
  entity: FlowNodeEntity;

  /**
   * Render mode controlling the visual style
   * @default 'default'
   */
  renderMode?: NodeRenderMode;

  /**
   * Whether the node is currently selected
   * @default false
   */
  selected?: boolean;

  /**
   * Callback when the node is selected/clicked
   */
  onSelect?: (entity: FlowNodeEntity) => void;

  /**
   * Callback when the node is moved
   */
  onMove?: (entity: FlowNodeEntity, position: Position) => void;

  /**
   * Callback when the node is resized
   */
  onResize?: (entity: FlowNodeEntity, size: Size) => void;

  /**
   * Callback when a port connection is initiated
   */
  onPortConnect?: (entity: FlowNodeEntity, portId: string) => void;

  /**
   * Callback when form values change
   */
  onFormChange?: (entity: FlowNodeEntity, values: Record<string, unknown>) => void;

  /**
   * Custom header renderer
   * If not provided, displays the node label
   */
  headerRenderer?: (props: HeaderRendererProps) => ReactNode;

  /**
   * Custom content renderer
   * If not provided, renders children
   */
  contentRenderer?: (props: ContentRendererProps) => ReactNode;

  /**
   * Custom footer renderer
   */
  footerRenderer?: (props: FooterRendererProps) => ReactNode;

  /**
   * Children to render in the content area
   * Used when contentRenderer is not provided
   */
  children?: ReactNode;

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
 * BaseFlowNode - Skeleton component for flow node rendering
 *
 * Provides the structural DOM for a flow node including:
 * - Outer container with positioning and theming
 * - Header region (customizable via headerRenderer or default label)
 * - Content region (customizable via contentRenderer or children)
 * - Ports region placeholder (to be filled by FlowNodePorts in Task 1.9)
 *
 * This is a skeleton component - interactive behaviors (drag, selection animation)
 * will be added in later tasks.
 *
 * @example
 * ```tsx
 * <BaseFlowNode
 *   entity={nodeEntity}
 *   selected={selectedId === nodeEntity.id}
 *   onSelect={(entity) => setSelectedId(entity.id)}
 * />
 * ```
 *
 * @example With custom renderers
 * ```tsx
 * <BaseFlowNode
 *   entity={nodeEntity}
 *   headerRenderer={({ entity, theme }) => (
 *     <div style={{ color: theme.textColor }}>
 *       <Icon name={entity.getData().nodeType} />
 *       {entity.getData().label}
 *     </div>
 *   )}
 *   contentRenderer={({ entity, onFormChange }) => (
 *     <NodeForm schema={entity.getData().formSchema} onChange={onFormChange} />
 *   )}
 * />
 * ```
 */
export const BaseFlowNode: React.FC<BaseFlowNodeProps> = React.memo(function BaseFlowNode({
  entity,
  renderMode = "default",
  selected = false,
  onSelect,
  onMove,
  onResize,
  onPortConnect,
  onFormChange,
  headerRenderer,
  contentRenderer,
  footerRenderer,
  children,
  className,
  style,
  "data-testid": testId,
}) {
  // Get theme from context
  const { theme, readOnly } = useFlowEntityContext();
  const nodeTheme = theme.node;

  // Use the useFlowNode hook to encapsulate node state and handlers
  const {
    position,
    size,
    isSelected,
    isDisabled,
    executionState,
    label,
    handleSelect,
    handleMove,
    handleResize,
    handleFormChange,
    handlePortConnect,
  } = useFlowNode(entity, {
    selected,
    onSelect,
    onMove,
    onResize,
    onPortConnect,
    onFormChange,
  });

  // Use the useNodeDrag hook for drag interaction
  const { handleMouseDown: handleDragMouseDown, isDragging } = useNodeDrag(entity, {
    onMove: handleMove,
    disabled: isDisabled || readOnly,
  });

  // Wrapper for resize callback to match useNodeResize signature
  const handleResizeWrapper = useCallback(
    (_entity: FlowNodeEntity, newSize: Size) => {
      handleResize(newSize);
    },
    [handleResize]
  );

  // Use the useNodeResize hooks for resize interaction on different edges
  // Right edge - horizontal resize only
  const { handleMouseDown: handleRightEdgeMouseDown, isResizing: isResizingRight } = useNodeResize(
    entity,
    {
      onResize: handleResizeWrapper,
      disabled: isDisabled || readOnly,
      direction: "horizontal",
    }
  );

  // Bottom edge - vertical resize only
  const { handleMouseDown: handleBottomEdgeMouseDown, isResizing: isResizingBottom } =
    useNodeResize(entity, {
      onResize: handleResizeWrapper,
      disabled: isDisabled || readOnly,
      direction: "vertical",
    });

  // Corner - both directions
  const { handleMouseDown: handleCornerMouseDown, isResizing: isResizingCorner } = useNodeResize(
    entity,
    {
      onResize: handleResizeWrapper,
      disabled: isDisabled || readOnly,
      direction: "both",
    }
  );

  // Combined resize state
  const isResizing = isResizingRight || isResizingBottom || isResizingCorner;

  // Use the selection context for centralized selection management (if available)
  const selectionContext = useSelectionContextOptional();

  // Determine effective selection state - prefer context over local state if available
  const effectiveIsSelected = useMemo(() => {
    if (selectionContext) {
      return selectionContext.isSelected(entity.id);
    }
    return isSelected;
  }, [selectionContext, entity.id, isSelected]);

  // Compute dimensions
  const width = size.width;
  const height = size.height;

  // Compute border color based on selection and execution state
  const borderColor = useMemo(() => {
    if (effectiveIsSelected) {
      return nodeTheme.executionStateColors?.running ?? "#3b82f6";
    }
    if (executionState && executionState !== "idle" && nodeTheme.executionStateColors) {
      return nodeTheme.executionStateColors[executionState] ?? nodeTheme.borderColor;
    }
    return nodeTheme.borderColor;
  }, [effectiveIsSelected, executionState, nodeTheme]);

  // Container styles
  const containerStyle = useMemo<CSSProperties>(
    () => ({
      position: "absolute",
      left: position.x,
      top: position.y,
      width,
      height,
      backgroundColor: nodeTheme.backgroundColor,
      border: `${nodeTheme.borderWidth ?? 1}px solid ${borderColor}`,
      borderRadius: nodeTheme.borderRadius ?? 8,
      boxShadow: nodeTheme.shadow,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      opacity: isDisabled ? 0.5 : 1,
      cursor: isDisabled ? "not-allowed" : isDragging ? "grabbing" : "grab",
      userSelect: "none",
      ...style,
    }),
    [position, width, height, nodeTheme, borderColor, isDisabled, isDragging, style]
  );

  // Resize handle styles
  const resizeHandleStyle = useMemo<CSSProperties>(
    () => ({
      position: "absolute",
      right: 0,
      bottom: 0,
      width: 12,
      height: 12,
      cursor: isDisabled || readOnly ? "not-allowed" : "nwse-resize",
      background: "transparent",
      zIndex: 10,
    }),
    [isDisabled, readOnly]
  );

  // Resize handle inner triangle styles
  const resizeTriangleStyle = useMemo<CSSProperties>(
    () => ({
      position: "absolute",
      right: 2,
      bottom: 2,
      width: 0,
      height: 0,
      borderStyle: "solid",
      borderWidth: "0 0 8px 8px",
      borderColor: `transparent transparent ${isResizing ? "#3b82f6" : "#9ca3af"} transparent`,
      opacity: isDisabled || readOnly ? 0.3 : 0.6,
      transition: "border-color 0.15s ease",
    }),
    [isDisabled, readOnly, isResizing]
  );

  // Note: Header, content, and ports styles are now handled by sub-components

  // Click handler - supports multi-select via Shift/Cmd/Ctrl when SelectionProvider is present
  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();

    // If SelectionProvider is available, use centralized selection management
    if (selectionContext) {
      const isMultiSelect = event.shiftKey || event.metaKey || event.ctrlKey;
      selectionContext.select(entity.id, { multi: isMultiSelect });
    }

    // Always call the local handleSelect for component-level state and callbacks
    handleSelect();
  };

  // Form change handler wrapper for FlowNodeContent
  const handleFormChangeWrapper = (values: Record<string, unknown>) => {
    handleFormChange(values);
  };

  // Port connect handler wrapper for FlowNodePorts
  const handlePortConnectWrapper = (nodeEntity: FlowNodeEntity, portId: string) => {
    handlePortConnect(portId);
  };

  return (
    <div
      className={
        `${className ?? ""}${isDragging ? " flow-node--dragging" : ""}${isResizing ? " flow-node--resizing" : ""}`.trim() ||
        undefined
      }
      style={containerStyle}
      onClick={handleClick}
      onMouseDown={handleDragMouseDown}
      data-testid={testId ?? `flow-node-${entity.id}`}
      data-node-id={entity.id}
      data-node-type={entity.data?.nodeType}
      data-execution-state={executionState}
      data-selected={effectiveIsSelected}
      data-disabled={isDisabled}
      data-dragging={isDragging}
      data-resizing={isResizing}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-label={`Flow node: ${label}`}
      aria-selected={effectiveIsSelected}
      aria-disabled={isDisabled}
    >
      {/* Header Region - using FlowNodeHeader sub-component */}
      <FlowNodeHeader
        entity={entity}
        selected={effectiveIsSelected}
        height={DEFAULT_HEADER_HEIGHT}
        renderer={headerRenderer}
      />

      {/* Content Region - using FlowNodeContent sub-component */}
      <FlowNodeContent
        entity={entity}
        selected={effectiveIsSelected}
        renderMode={renderMode}
        readOnly={readOnly}
        renderer={contentRenderer}
        onFormChange={handleFormChangeWrapper}
      >
        {children}
      </FlowNodeContent>

      {/* Footer Region (optional) */}
      {footerRenderer && (
        <div className="flow-node-footer" data-testid={`flow-node-footer-${entity.id}`}>
          {footerRenderer({ entity, theme: nodeTheme, selected: effectiveIsSelected })}
        </div>
      )}

      {/* Ports Region - using FlowNodePorts sub-component */}
      <FlowNodePorts entity={entity} onPortConnect={handlePortConnectWrapper} />

      {/* Resize Handles - Right edge, Bottom edge, and Corner */}
      {!readOnly && !isDisabled && (
        <>
          {/* Right edge - horizontal resize */}
          <div
            className="flow-node-resize-edge flow-node-resize-edge--right"
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: 8,
              height: "calc(100% - 12px)",
              cursor: "ew-resize",
              background: "transparent",
              zIndex: 10,
            }}
            onMouseDown={handleRightEdgeMouseDown}
            data-testid={`flow-node-resize-right-${entity.id}`}
          />

          {/* Bottom edge - vertical resize */}
          <div
            className="flow-node-resize-edge flow-node-resize-edge--bottom"
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              width: "calc(100% - 12px)",
              height: 8,
              cursor: "ns-resize",
              background: "transparent",
              zIndex: 10,
            }}
            onMouseDown={handleBottomEdgeMouseDown}
            data-testid={`flow-node-resize-bottom-${entity.id}`}
          />

          {/* Corner - both directions */}
          <div
            className="flow-node-resize-handle"
            style={resizeHandleStyle}
            onMouseDown={handleCornerMouseDown}
            data-testid={`flow-node-resize-handle-${entity.id}`}
            aria-label="Resize handle"
          >
            <div style={resizeTriangleStyle} />
          </div>
        </>
      )}
    </div>
  );
});

// Default export for convenience
export default BaseFlowNode;
