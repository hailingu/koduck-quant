/**
 * @file ActionNode - Action node example
 * @description
 * Action node represents a step in the flow that executes an operation.
 * This is the most basic node type with a single input and output port.
 *
 * @example
 * ```tsx
 * import { ActionNode, createActionNode } from './ActionNode';
 *
 * const nodeEntity = createActionNode({
 *   label: 'Process Data',
 *   actionType: 'process',
 *   description: 'Process input data'
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
 * Action node configuration
 */
export interface ActionNodeConfig {
  /** Node label */
  label?: string;
  /** Action type */
  actionType?: "process" | "transform" | "validate" | "custom";
  /** Action description */
  description?: string;
  /** Custom action name (used when actionType is custom) */
  customAction?: string;
  /** Initial position */
  position?: { x: number; y: number };
}

/**
 * ActionNode component props
 */
export interface ActionNodeProps {
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
 * Action type options
 */
const ACTION_TYPES = [
  { value: "process", label: "处理" },
  { value: "transform", label: "转换" },
  { value: "validate", label: "验证" },
  { value: "custom", label: "自定义" },
] as const;

/**
 * Action node form configuration
 */
export const ACTION_FORM_SCHEMA: FormSchema = {
  type: "object",
  properties: {
    actionType: {
      type: "select",
      label: "动作类型",
      description: "选择要执行的动作类型",
      defaultValue: "process",
      options: ACTION_TYPES.map((t) => ({ value: t.value, label: t.label })),
      validation: { required: true },
      order: 1,
    },
    description: {
      type: "textarea",
      label: "描述",
      description: "动作的详细描述",
      placeholder: "输入动作描述...",
      order: 2,
    },
    customAction: {
      type: "text",
      label: "自定义动作",
      description: "当选择自定义类型时，输入动作名称",
      placeholder: "自定义动作名称",
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
 * Action node port definitions
 */
const ACTION_PORTS: PortDefinition[] = [
  {
    id: "input",
    name: "输入",
    type: "input",
    dataType: "any",
  },
  {
    id: "output",
    name: "输出",
    type: "output",
    dataType: "any",
  },
];

/**
 * Action node theme
 */
const ACTION_NODE_THEME: Partial<FlowNodeTheme> = {
  backgroundColor: "#EFF6FF",
  borderColor: "#3B82F6",
  headerColor: "#3B82F6",
  textColor: "#1E3A5F",
};

// ============================================================================
// Entity Factory
// ============================================================================

/**
 * Create action node entity
 *
 * @param config - Node configuration
 * @returns FlowNodeEntity instance
 *
 * @example
 * ```tsx
 * const entity = createActionNode({
 *   label: 'Data Processing',
 *   actionType: 'process',
 *   description: 'Clean and format data'
 * });
 * ```
 */
export function createActionNode(config?: ActionNodeConfig): FlowNodeEntity {
  const {
    label = "动作节点",
    actionType = "process",
    description = "",
    customAction = "",
    position = { x: 0, y: 0 },
  } = config ?? {};

  const entity = new FlowNodeEntity({
    nodeType: "action",
    label,
    position,
    size: { width: 200, height: 120 },
    formSchema: ACTION_FORM_SCHEMA,
    theme: ACTION_NODE_THEME,
    config: {
      actionType,
      description,
      customAction,
    },
  });

  entity.setPorts(ACTION_PORTS);
  return entity;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Action node component
 *
 * @description
 * Action node is the most basic node type in the flow diagram, representing a step that executes an operation.
 * Has one input port and one output port, supports configuring action type and description.
 *
 * @param props - Component props
 * @returns JSX element
 *
 * @example
 * ```tsx
 * const actionEntity = createActionNode({
 *   label: 'Process Data',
 *   actionType: 'process'
 * });
 *
 * <ActionNode
 *   entity={actionEntity}
 *   selected={selectedId === actionEntity.id}
 *   onSelect={(e) => setSelectedId(e.id)}
 * />
 * ```
 */
export const ActionNode: React.FC<ActionNodeProps> = React.memo(function ActionNode({
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
      data-testid={testId ?? `action-node-${entity.id}`}
    />
  );
});

export default ActionNode;
