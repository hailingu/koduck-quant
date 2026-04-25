/**
 * @file StartNode - 开始节点示例
 * @description
 * 开始节点是流程图的入口点，每个流程图通常有一个开始节点。
 * 该节点只有一个输出端口，没有输入端口。
 *
 * @example
 * ```tsx
 * import { StartNode, createStartNode } from './StartNode';
 *
 * const nodeEntity = createStartNode({
 *   label: '流程开始',
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
 * 开始节点配置
 */
export interface StartNodeConfig {
  /** 节点标签 */
  label?: string;
  /** 触发类型 */
  triggerType?: "manual" | "scheduled" | "event" | "api";
  /** 触发描述 */
  triggerDescription?: string;
  /** 初始位置 */
  position?: { x: number; y: number };
}

/**
 * StartNode 组件的 Props
 */
export interface StartNodeProps {
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
 * 触发类型选项
 */
const TRIGGER_TYPES = [
  { value: "manual", label: "手动触发" },
  { value: "scheduled", label: "定时触发" },
  { value: "event", label: "事件触发" },
  { value: "api", label: "API 触发" },
] as const;

/**
 * 开始节点表单配置
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
 * 开始节点端口定义（只有输出）
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
 * 开始节点主题（绿色）
 */
const START_NODE_THEME: Partial<FlowNodeTheme> = {
  backgroundColor: "#D1FAE5",
  borderColor: "#10B981",
  headerColor: "#10B981",
  textColor: "#065F46",
  borderRadius: 50, // 圆形
};

// ============================================================================
// Entity Factory
// ============================================================================

/**
 * 创建开始节点实体
 *
 * @param config - 节点配置
 * @returns FlowNodeEntity 实例
 *
 * @example
 * ```tsx
 * const entity = createStartNode({
 *   label: '流程开始',
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
 * 开始节点组件
 *
 * @description
 * 开始节点是流程图的入口点，使用绿色圆形设计。
 * 只有一个输出端口，用于连接到下一个节点。
 *
 * @param props - 组件属性
 * @returns JSX 元素
 *
 * @example
 * ```tsx
 * const startEntity = createStartNode({
 *   label: '开始',
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
