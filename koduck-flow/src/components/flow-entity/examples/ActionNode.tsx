/**
 * @file ActionNode - 动作节点示例
 * @description
 * 动作节点用于表示流程中执行某个操作的步骤。
 * 这是最基础的节点类型，具有单个输入和输出端口。
 *
 * @example
 * ```tsx
 * import { ActionNode, createActionNode } from './ActionNode';
 *
 * const nodeEntity = createActionNode({
 *   label: '处理数据',
 *   actionType: 'process',
 *   description: '对输入数据进行处理'
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
 * 动作节点配置
 */
export interface ActionNodeConfig {
  /** 节点标签 */
  label?: string;
  /** 动作类型 */
  actionType?: "process" | "transform" | "validate" | "custom";
  /** 动作描述 */
  description?: string;
  /** 自定义动作名称（当 actionType 为 custom 时使用） */
  customAction?: string;
  /** 初始位置 */
  position?: { x: number; y: number };
}

/**
 * ActionNode 组件的 Props
 */
export interface ActionNodeProps {
  /** FlowNodeEntity 实例 */
  entity: FlowNodeEntity;
  /** 是否选中 */
  selected?: boolean;
  /** 选中回调 */
  onSelect?: (entity: FlowNodeEntity) => void;
  /** 表单值变更回调 */
  onFormChange?: (entity: FlowNodeEntity, values: Record<string, unknown>) => void;
  /** 额外 CSS 类 */
  className?: string;
  /** 测试 ID */
  testId?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * 动作类型选项
 */
const ACTION_TYPES = [
  { value: "process", label: "处理" },
  { value: "transform", label: "转换" },
  { value: "validate", label: "验证" },
  { value: "custom", label: "自定义" },
] as const;

/**
 * 动作节点表单配置
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
 * 动作节点端口定义
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
 * 动作节点主题
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
 * 创建动作节点实体
 *
 * @param config - 节点配置
 * @returns FlowNodeEntity 实例
 *
 * @example
 * ```tsx
 * const entity = createActionNode({
 *   label: '数据处理',
 *   actionType: 'process',
 *   description: '清理和格式化数据'
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
 * 动作节点组件
 *
 * @description
 * 动作节点是流程图中最基础的节点类型，用于表示执行某个操作的步骤。
 * 具有一个输入端口和一个输出端口，支持配置动作类型和描述。
 *
 * @param props - 组件属性
 * @returns JSX 元素
 *
 * @example
 * ```tsx
 * const actionEntity = createActionNode({
 *   label: '处理数据',
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
