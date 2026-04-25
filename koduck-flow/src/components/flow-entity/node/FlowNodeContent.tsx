/**
 * @file FlowNodeContent Component
 * @description Sub-component for rendering the content region of a flow node.
 * Acts as a wrapper for forms or custom content, with theme integration.
 * When the node entity has a formSchema, automatically renders FlowNodeForm.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 1.9, Task 4.9
 */

import React, { useCallback, useMemo, type CSSProperties, type ReactNode } from "react";
import { useFlowEntityContext } from "../context";
import type { FlowNodeTheme } from "../types";
import type { FlowNodeEntity } from "../../../common/flow/flow-node-entity";
import { FlowNodeForm } from "./form";

// =============================================================================
// Types
// =============================================================================

/**
 * Render mode affecting content padding and layout
 */
export type ContentRenderMode = "default" | "minimal" | "compact" | "expanded";

/**
 * Props for FlowNodeContent component
 */
export interface FlowNodeContentProps {
  /**
   * The flow node entity this content belongs to
   */
  entity: FlowNodeEntity;

  /**
   * Whether the parent node is currently selected
   * @default false
   */
  selected?: boolean;

  /**
   * Render mode affecting padding and layout
   * @default 'default'
   */
  renderMode?: ContentRenderMode;

  /**
   * Whether the content is in read-only mode
   * @default false
   */
  readOnly?: boolean;

  /**
   * Children to render inside the content area
   */
  children?: ReactNode;

  /**
   * Custom renderer for the content
   * Takes precedence over children if provided
   */
  renderer?: (props: {
    entity: FlowNodeEntity;
    theme: FlowNodeTheme;
    selected: boolean;
    readOnly: boolean;
    onFormChange?: (values: Record<string, unknown>) => void;
  }) => ReactNode;

  /**
   * Callback when form values change
   */
  onFormChange?: (values: Record<string, unknown>) => void;

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
 * FlowNodeContent - Sub-component for flow node content region
 *
 * Renders the main content area of a flow node with:
 * - Theme-based styling (text color, padding based on render mode)
 * - Flexible content rendering via children or custom renderer
 * - Support for form integration with onFormChange callback
 *
 * @example
 * ```tsx
 * <FlowNodeContent entity={nodeEntity}>
 *   <p>Node configuration or custom content here</p>
 * </FlowNodeContent>
 * ```
 *
 * @example With custom renderer
 * ```tsx
 * <FlowNodeContent
 *   entity={nodeEntity}
 *   renderer={({ entity, onFormChange }) => (
 *     <NodeForm
 *       schema={entity.data.formSchema}
 *       onChange={onFormChange}
 *     />
 *   )}
 *   onFormChange={(values) => console.log(values)}
 * />
 * ```
 */
export const FlowNodeContent: React.FC<FlowNodeContentProps> = React.memo(function FlowNodeContent({
  entity,
  selected = false,
  renderMode = "default",
  readOnly = false,
  children,
  renderer,
  onFormChange,
  className,
  style,
  "data-testid": testId,
}) {
  // Get theme from context
  const { theme, readOnly: contextReadOnly } = useFlowEntityContext();
  const nodeTheme = theme.node;

  // Combine readOnly from props and context
  const isReadOnly = readOnly || contextReadOnly;

  // Get form schema and data from entity
  const formSchema = entity.getFormSchema?.();
  const formData = entity.getFormData?.() ?? {};

  // Handle form data changes - update entity form data
  const handleFormDataChange = useCallback(
    (newData: Record<string, unknown>) => {
      // Update entity's form data
      entity.updateFormData?.(newData);
      // Notify parent component
      onFormChange?.(newData);
    },
    [entity, onFormChange]
  );

  // Compute padding based on render mode
  const padding = useMemo(() => {
    switch (renderMode) {
      case "minimal":
        return "4px";
      case "compact":
        return "4px 8px";
      case "expanded":
        return "12px 16px";
      default:
        return "8px 12px";
    }
  }, [renderMode]);

  // Content styles
  const contentStyle = useMemo<CSSProperties>(
    () => ({
      flex: 1,
      padding,
      overflow: "auto",
      color: nodeTheme.textColor,
      ...style,
    }),
    [nodeTheme, padding, style]
  );

  // Determine content to render
  const renderContent = (): ReactNode => {
    // Custom renderer takes precedence
    if (renderer) {
      return renderer({
        entity,
        theme: nodeTheme,
        selected,
        readOnly: isReadOnly,
        onFormChange,
      });
    }

    // If entity has formSchema, render FlowNodeForm
    if (formSchema && formSchema.properties && Object.keys(formSchema.properties).length > 0) {
      return (
        <FlowNodeForm
          schema={formSchema}
          data={formData}
          onChange={handleFormDataChange}
          readOnly={isReadOnly}
          compact={renderMode === "compact" || renderMode === "minimal"}
          testId={`flow-node-form-${entity.id}`}
        />
      );
    }

    // Otherwise, render children
    return children;
  };

  return (
    <div
      className={`flow-node-content ${className ?? ""}`.trim()}
      style={contentStyle}
      data-testid={testId ?? `flow-node-content-${entity.id}`}
      data-readonly={isReadOnly}
      data-render-mode={renderMode}
    >
      {renderContent()}
    </div>
  );
});

// Default export for convenience
export default FlowNodeContent;
