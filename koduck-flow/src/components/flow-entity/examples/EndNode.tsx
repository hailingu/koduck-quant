/**
 * @file EndNode - 结束节点示例
 * @description
 * 结束节点是流程图的终止点，表示流程的完成。
 * 该节点只有一个输入端口，没有输出端口。
 *
 * @example
 * ```tsx
 * import { EndNode, createEndNode } from './EndNode';
 *
 * const nodeEntity = createEndNode({
 *   label: '流程结束',
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
 * 结束节点配置
 */
export interface EndNodeConfig {
  /** 节点标签 */
  label?: string;
  /** 结束类型 */
  endType?: "success" | "failure" | "cancel" | "timeout";
  /** 结束描述 */
  endDescription?: string;
  /** 返回值 */
  returnValue?: string;
  /** 初始位置 */
  position?: { x: number; y: number };
}

/**
 * EndNode 组件的 Props
 */
export interface EndNodeProps {
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
 * 结束类型选项
 */
const END_TYPES = [
  { value: "success", label: "成功" },
  { value: "failure", label: "失败" },
  { value: "cancel", label: "取消" },
  { value: "timeout", label: "超时" },
] as const;

/**
 * 结束节点表单配置
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
 * 结束节点端口定义（只有输入）
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
 * 结束节点主题（红色）
 */
const END_NODE_THEME: Partial<FlowNodeTheme> = {
  backgroundColor: "#FEE2E2",
  borderColor: "#EF4444",
  headerColor: "#EF4444",
  textColor: "#7F1D1D",
  borderRadius: 50, // 圆形
};

// ============================================================================
// Entity Factory
// ============================================================================

/**
 * 创建结束节点实体
 *
 * @param config - 节点配置
 * @returns FlowNodeEntity 实例
 *
 * @example
 * ```tsx
 * const entity = createEndNode({
 *   label: '完成',
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
 * 结束节点组件
 *
 * @description
 * 结束节点是流程图的终止点，使用红色圆形设计。
 * 只有一个输入端口，表示流程的终结。
 *
 * @param props - 组件属性
 * @returns JSX 元素
 *
 * @example
 * ```tsx
 * const endEntity = createEndNode({
 *   label: '结束',
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
