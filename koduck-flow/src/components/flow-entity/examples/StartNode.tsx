/**
 * @file StartNode - Start node example
 * @description
 * Start node is the entry point of the flow diagram; each flow diagram usually has one start node.
 * This node has only one output port and no input ports.
 *
 * @example
 * ```tsx
 * import { StartNode, createStartNode } from './StartNode';
 *
 * const nodeEntity = createStartNode({
 *   label: 'Flow Start',
 *   triggerType: 'manual'
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
 * Start node configuration
 */
export interface StartNodeConfig {
  /** Node label */
  label?: string;
  /** Trigger type */
  triggerType?: "manual" | "scheduled" | "event" | "api";
  /** Trigger description */
  triggerDescription?: string;
  /** Initial position */
  position?: { x: number; y: number };
}

/**
 * StartNode component props
 */
export interface StartNodeProps {
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
 * Trigger type options
 */
const TRIGGER_TYPES = [
  { value: "manual", label: "手动触发" },
  { value: "scheduled", label: "定时触发" },
  { value: "event", label: "事件触发" },
  { value: "api", label: "API 触发" },
] as const;

/**
 * Start node form configuration
 */
export const START_FORM_SCHEMA: FormSchema = {
  type: "object",
  properties: {
    triggerType: {
      type: "select",
      label: "触发方式",
      description: "选择流程的触发方式",
      defaultValue: "manual",
      options: TRIGGER_TYPES.map((t) => ({ value: t.value, label: t.label })),
      validation: { required: true },
      order: 1,
    },
    triggerDescription: {
      type: "textarea",
      label: "触发描述",
      description: "触发条件的详细描述",
      placeholder: "描述触发条件...",
      order: 2,
    },
  },
  layout: {
    columns: 1,
    spacing: "normal",
    labelPosition: "top",
  },
};

/**
 * Start node port definitions (output only)
 */
const START_PORTS: PortDefinition[] = [
  {
    id: "output",
    name: "开始",
    type: "output",
    dataType: "any",
  },
];

/**
 * Start node theme (green)
 */
const START_NODE_THEME: Partial<FlowNodeTheme> = {
  backgroundColor: "#D1FAE5",
  borderColor: "#10B981",
  headerColor: "#10B981",
  textColor: "#065F46",
  borderRadius: 50, // Circle
};

// ============================================================================
// Entity Factory
// ============================================================================

/**
 * Create start node entity
 *
 * @param config - Node configuration
 * @returns FlowNodeEntity instance
 *
 * @example
 * ```tsx
 * const entity = createStartNode({
 *   label: 'Flow Start',
 *   triggerType: 'scheduled'
 * });
 * ```
 */
export function createStartNode(config?: StartNodeConfig): FlowNodeEntity {
  const {
    label = "开始",
    triggerType = "manual",
    triggerDescription = "",
    position = { x: 0, y: 0 },
  } = config ?? {};

  const entity = new FlowNodeEntity({
    nodeType: "start",
    label,
    position,
    size: { width: 100, height: 100 },
    formSchema: START_FORM_SCHEMA,
    theme: START_NODE_THEME,
    config: {
      triggerType,
      triggerDescription,
    },
  });

  entity.setPorts(START_PORTS);
  return entity;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Start node component
 *
 * @description
 * Start node is the entry point of the flow diagram, designed with a green circle.
 * Has only one output port for connecting to the next node.
 *
 * @param props - Component props
 * @returns JSX element
 *
 * @example
 * ```tsx
 * const startEntity = createStartNode({
 *   label: 'Start',
 *   triggerType: 'manual'
 * });
 *
 * <StartNode
 *   entity={startEntity}
 *   selected={selectedId === startEntity.id}
 *   onSelect={(e) => setSelectedId(e.id)}
 * />
 * ```
 */
export const StartNode: React.FC<StartNodeProps> = React.memo(function StartNode({
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
      data-testid={testId ?? `start-node-${entity.id}`}
    />
  );
});

export default StartNode;
