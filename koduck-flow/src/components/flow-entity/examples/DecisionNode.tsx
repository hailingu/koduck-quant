/**
 * @file DecisionNode Component
 * @description A decision node with conditional branching (true/false outputs).
 * Features a diamond-shaped visual indicator and condition expression input.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 5.2
 * @see docs/reference/flow-entity-extension-api.md
 */

import React, { useMemo } from "react";
import { FlowNodeEntity } from "../../../common/flow/flow-node-entity";
import type { FormSchema, PortDefinition, FlowNodeTheme } from "../types";
import { BaseFlowNode, type HeaderRendererProps } from "../node/BaseFlowNode";

// =============================================================================
// Constants
// =============================================================================

/**
 * Node type identifier for DecisionNode
 */
export const DECISION_NODE_TYPE = "decision" as const;

/**
 * Default node dimensions for decision nodes
 */
export const DECISION_NODE_SIZE = {
  width: 220,
  height: 180,
} as const;

/**
 * Form schema for Decision Node configuration
 */
export const DECISION_FORM_SCHEMA: FormSchema = {
  type: "object",
  properties: {
    condition: {
      type: "textarea",
      label: "Condition",
      description: "JavaScript expression that evaluates to true/false",
      placeholder: "data.value > 10",
      validation: {
        required: true,
      },
      order: 1,
    },
    trueLabel: {
      type: "text",
      label: "True Branch Label",
      placeholder: "Yes",
      default: "Yes",
      order: 2,
    },
    falseLabel: {
      type: "text",
      label: "False Branch Label",
      placeholder: "No",
      default: "No",
      order: 3,
    },
  },
  layout: {
    spacing: "normal",
    labelPosition: "top",
  },
};

/**
 * Port definitions for Decision Node
 */
export const DECISION_PORTS: PortDefinition[] = [
  {
    id: "input",
    name: "Input",
    type: "input",
    dataType: "any",
    description: "Data input for condition evaluation",
  },
  {
    id: "true-output",
    name: "True",
    type: "output",
    dataType: "any",
    description: "Output when condition is true",
  },
  {
    id: "false-output",
    name: "False",
    type: "output",
    dataType: "any",
    description: "Output when condition is false",
  },
];

/**
 * Default theme overrides for Decision Node
 */
export const DECISION_NODE_THEME: Partial<FlowNodeTheme> = {
  headerColor: "#fef3c7", // Amber-100
  borderColor: "#f59e0b", // Amber-500
};

// =============================================================================
// Types
// =============================================================================

/**
 * Decision node form data structure
 */
export interface DecisionFormData {
  /** JavaScript condition expression */
  condition: string;
  /** Label for true branch */
  trueLabel?: string;
  /** Label for false branch */
  falseLabel?: string;
}

/**
 * Props for DecisionNode component
 */
export interface DecisionNodeProps {
  /** The flow node entity */
  entity: FlowNodeEntity;
  /** Whether the node is selected */
  selected?: boolean;
  /** Callback when the node is selected */
  onSelect?: (entity: FlowNodeEntity) => void;
  /** Callback when form values change */
  onFormChange?: (entity: FlowNodeEntity, values: Record<string, unknown>) => void;
  /** Additional CSS class */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

// =============================================================================
// Custom Header Component
// =============================================================================

/**
 * Custom header renderer for decision nodes with diamond icon
 *
 * @param props - Header renderer props
 * @param props.entity - The node entity
 * @param props.theme - Current theme
 * @param props.selected - Whether the node is selected
 * @returns JSX element for the header
 */
const DecisionHeader: React.FC<HeaderRendererProps> = ({ entity, theme, selected }) => {
  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    backgroundColor: DECISION_NODE_THEME.headerColor ?? theme.headerColor,
    borderBottom: `1px solid ${DECISION_NODE_THEME.borderColor ?? theme.borderColor}`,
    borderTopLeftRadius: theme.borderRadius ?? 8,
    borderTopRightRadius: theme.borderRadius ?? 8,
  };

  const iconStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    transform: "rotate(45deg)",
    backgroundColor: selected ? "#f59e0b" : "#fbbf24",
    borderRadius: "4px",
    flexShrink: 0,
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: "14px",
    color: theme.textColor,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  return (
    <div style={headerStyle} data-testid="decision-node-header">
      <span style={iconStyle}>
        <span style={{ transform: "rotate(-45deg)", fontSize: "12px" }}>?</span>
      </span>
      <span style={labelStyle}>{entity.getLabel()}</span>
    </div>
  );
};

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a new Decision Node entity with default configuration.
 *
 * @param options - Optional initial configuration
 * @param options.position - Initial position { x, y }
 * @param options.position.x - X coordinate
 * @param options.position.y - Y coordinate
 * @param options.formData - Initial form data values
 * @param options.label - Custom label for the node
 * @returns A new FlowNodeEntity configured as a Decision Node
 *
 * @example
 * ```typescript
 * const decisionNode = createDecisionNode({
 *   position: { x: 100, y: 100 },
 *   formData: { condition: 'data.status === "approved"' }
 * });
 * ```
 */
export function createDecisionNode(options?: {
  position?: { x: number; y: number };
  formData?: Partial<DecisionFormData>;
  label?: string;
}): FlowNodeEntity {
  const entity = new FlowNodeEntity({
    nodeType: DECISION_NODE_TYPE,
    label: options?.label ?? "Decision",
    position: options?.position ?? { x: 0, y: 0 },
    size: DECISION_NODE_SIZE,
    formSchema: DECISION_FORM_SCHEMA,
    config: {
      condition: "",
      trueLabel: "Yes",
      falseLabel: "No",
      ...options?.formData,
    },
  });

  // Set ports
  entity.setPorts(DECISION_PORTS);

  return entity;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Memoized header renderer to avoid creating new functions on each render
 * @param props
 */
const memoizedHeaderRenderer = (props: HeaderRendererProps) => <DecisionHeader {...props} />;

/**
 * DecisionNode - A conditional branching node
 *
 * Features:
 * - Diamond-shaped icon indicating decision point
 * - Condition expression input for JavaScript evaluation
 * - Two output ports: True and False branches
 * - Customizable branch labels
 *
 * @example
 * ```tsx
 * const decisionEntity = createDecisionNode({
 *   position: { x: 200, y: 100 },
 *   formData: { condition: 'value > 50' }
 * });
 *
 * <DecisionNode
 *   entity={decisionEntity}
 *   selected={selectedId === decisionEntity.id}
 *   onSelect={(e) => setSelectedId(e.id)}
 * />
 * ```
 */
export const DecisionNode: React.FC<DecisionNodeProps> = React.memo(function DecisionNode({
  entity,
  selected = false,
  onSelect,
  onFormChange,
  className,
  testId,
}) {
  // Memoize the form change handler
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
      headerRenderer={memoizedHeaderRenderer}
      renderMode="default"
      className={className}
      data-testid={testId ?? `decision-node-${entity.id}`}
    />
  );
});

export default DecisionNode;
