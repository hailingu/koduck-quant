/**
 * @file EndNode - End node example
 * @description
 * End node is the termination point of the flow diagram, indicating flow completion.
 * This node has only one input port and no output ports.
 *
 * @example
 * ```tsx
 * import { EndNode, createEndNode } from './EndNode';
 *
 * const nodeEntity = createEndNode({
 *   label: 'Flow End',
 *   endType: 'success'
 * });
 * ```
 */

import React, { useMemo } from "react";
import { FlowNodeEntity } from "../../../common/flow/flow-node-entity";
import { BaseFlowNode } from "../node/BaseFlowNode";
import type { FormSchema, PortDefinition, FlowNodeTheme } from "../types";

// ============================================================================
// Types
// ============================================================================

/**
 * End node configuration
 */
export interface EndNodeConfig {
  /** Node label */
  label?: string;
  /** End type */
  endType?: "success" | "failure" | "cancel" | "timeout";
  /** End description */
  endDescription?: string;
  /** Return value */
  returnValue?: string;
  /** Initial position */
  position?: { x: number; y: number };
}

/**
 * EndNode component props
 */
export interface EndNodeProps {
  /** FlowNodeEntity instance */
  entity: FlowNodeEntity;
  /** Whether selected */
  selected?: boolean;
  /** Select callback */
  onSelect?: (entity: FlowNodeEntity) => void;
  /** Form value change callback */
  onFormChange?: (entity: FlowNodeEntity, values: Record<string, unknown>) => void;
  /** Extra CSS class */
  className?: string;
  /** Test ID */
  testId?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * End type options
 */
const END_TYPES = [
  { value: "success", label: "成功" },
  { value: "failure", label: "失败" },
  { value: "cancel", label: "取消" },
  { value: "timeout", label: "超时" },
] as const;

/**
 * End node form configuration
 */
export const END_FORM_SCHEMA: FormSchema = {
  type: "object",
  properties: {
    endType: {
      type: "select",
      label: "结束类型",
      description: "选择流程的结束状态",
      defaultValue: "success",
      options: END_TYPES.map((t) => ({ value: t.value, label: t.label })),
      validation: { required: true },
      order: 1,
    },
    endDescription: {
      type: "textarea",
      label: "结束描述",
      description: "结束状态的详细描述",
      placeholder: "描述结束状态...",
      order: 2,
    },
    returnValue: {
      type: "text",
      label: "返回值",
      description: "流程结束时的返回值（可选）",
      placeholder: "输入返回值...",
      order: 3,
    },
  },
  layout: {
    columns: 1,
    spacing: "normal",
    labelPosition: "top",
  },
};

/**
 * End node port definitions (input only)
 */
const END_PORTS: PortDefinition[] = [
  {
    id: "input",
    name: "结束",
    type: "input",
    dataType: "any",
  },
];

/**
 * End node theme (red)
 */
const END_NODE_THEME: Partial<FlowNodeTheme> = {
  backgroundColor: "#FEE2E2",
  borderColor: "#EF4444",
  headerColor: "#EF4444",
  textColor: "#7F1D1D",
  borderRadius: 50, // Circle
};

// ============================================================================
// Entity Factory
// ============================================================================

/**
 * Create end node entity
 *
 * @param config - Node configuration
 * @returns FlowNodeEntity instance
 *
 * @example
 * ```tsx
 * const entity = createEndNode({
 *   label: 'Complete',
 *   endType: 'success',
 *   returnValue: 'result'
 * });
 * ```
 */
export function createEndNode(config?: EndNodeConfig): FlowNodeEntity {
  const {
    label = "结束",
    endType = "success",
    endDescription = "",
    returnValue = "",
    position = { x: 0, y: 0 },
  } = config ?? {};

  const entity = new FlowNodeEntity({
    nodeType: "end",
    label,
    position,
    size: { width: 100, height: 100 },
    formSchema: END_FORM_SCHEMA,
    theme: END_NODE_THEME,
    config: {
      endType,
      endDescription,
      returnValue,
    },
  });

  entity.setPorts(END_PORTS);
  return entity;
}

// ============================================================================
// Component
// ============================================================================

/**
 * End node component
 *
 * @description
 * End node is the termination point of the flow diagram, designed with a red circle.
 * Has only one input port, indicating the end of the flow.
 *
 * @param props - Component props
 * @returns JSX element
 *
 * @example
 * ```tsx
 * const endEntity = createEndNode({
 *   label: 'End',
 *   endType: 'success'
 * });
 *
 * <EndNode
 *   entity={endEntity}
 *   selected={selectedId === endEntity.id}
 *   onSelect={(e) => setSelectedId(e.id)}
 * />
 * ```
 */
export const EndNode: React.FC<EndNodeProps> = React.memo(function EndNode({
  entity,
  selected = false,
  onSelect,
  onFormChange,
  className,
  testId,
}) {
  const handleFormChange = useMemo(() => {
    if (!onFormChange) return undefined;
    return (nodeEntity: FlowNodeEntity, values: Record<string, unknown>) => {
      onFormChange(nodeEntity, values);
    };
  }, [onFormChange]);

  return (
    <BaseFlowNode
      entity={entity}
      selected={selected}
      onSelect={onSelect}
      onFormChange={handleFormChange}
      renderMode="default"
      className={className}
      data-testid={testId ?? `end-node-${entity.id}`}
    />
  );
});

export default EndNode;
