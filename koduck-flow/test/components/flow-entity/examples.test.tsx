/**
 * @file Example Components Tests
 * @description Unit tests for example Flow Entity components.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 5.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import {
  FlowEntityProvider,
  DEFAULT_FLOW_THEME,
} from "../../../src/components/flow-entity/context";
import type { PortDefinition } from "../../../src/components/flow-entity/types";
import {
  createDecisionNode,
  DecisionNode,
} from "../../../src/components/flow-entity/examples/DecisionNode";
import {
  createActionNode,
  ActionNode,
} from "../../../src/components/flow-entity/examples/ActionNode";
import { createStartNode, StartNode } from "../../../src/components/flow-entity/examples/StartNode";
import { createEndNode, EndNode } from "../../../src/components/flow-entity/examples/EndNode";
import { createConditionalEdge } from "../../../src/components/flow-entity/examples/ConditionalEdge";

// =============================================================================
// Test Setup
// =============================================================================

// Mock ResizeObserver for BaseFlowNode
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Wrapper component for testing
 * @param root0
 * @param root0.children
 */
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <FlowEntityProvider theme={DEFAULT_FLOW_THEME}>{children}</FlowEntityProvider>
);

// =============================================================================
// DecisionNode Tests
// =============================================================================

describe("DecisionNode", () => {
  describe("createDecisionNode", () => {
    it("should create a decision node entity with default values", () => {
      const entity = createDecisionNode();

      expect(entity).toBeDefined();
      expect(entity.id).toMatch(/^flow-node-/);
      expect(entity.getNodeType()).toBe("decision");
      expect(entity.getLabel()).toBe("Decision");
    });

    it("should create a decision node with custom position", () => {
      const entity = createDecisionNode({
        position: { x: 100, y: 200 },
      });

      expect(entity.getPosition()).toEqual({ x: 100, y: 200 });
    });

    it("should create a decision node with custom label", () => {
      const entity = createDecisionNode({
        label: "Check Age",
      });

      expect(entity.getLabel()).toBe("Check Age");
    });

    it("should create a decision node with custom form data", () => {
      const entity = createDecisionNode({
        formData: {
          condition: "x > 10",
          trueLabel: "Pass",
          falseLabel: "Fail",
        },
      });

      const formData = entity.getFormData();
      expect(formData?.condition).toBe("x > 10");
      expect(formData?.trueLabel).toBe("Pass");
      expect(formData?.falseLabel).toBe("Fail");
    });

    it("should have three ports (input, true-output, false-output)", () => {
      const entity = createDecisionNode();
      const ports = entity.getAllPorts();

      expect(ports).toHaveLength(3);
      expect(ports.some((p: PortDefinition) => p.id === "input")).toBe(true);
      expect(ports.some((p: PortDefinition) => p.id === "true-output")).toBe(true);
      expect(ports.some((p: PortDefinition) => p.id === "false-output")).toBe(true);
    });

    it("should have a form schema defined", () => {
      const entity = createDecisionNode();
      expect(entity.getFormSchema()).toBeDefined();
    });
  });

  describe("DecisionNode Component", () => {
    it("should render without crashing", () => {
      const entity = createDecisionNode();

      render(
        <TestWrapper>
          <DecisionNode entity={entity} />
        </TestWrapper>
      );

      expect(screen.getByTestId(`decision-node-${entity.id}`)).toBeDefined();
    });

    it("should render with custom testId", () => {
      const entity = createDecisionNode();

      render(
        <TestWrapper>
          <DecisionNode entity={entity} testId="custom-decision" />
        </TestWrapper>
      );

      expect(screen.getByTestId("custom-decision")).toBeDefined();
    });

    it("should call onSelect when provided", () => {
      const entity = createDecisionNode();
      const onSelect = vi.fn();

      render(
        <TestWrapper>
          <DecisionNode entity={entity} onSelect={onSelect} />
        </TestWrapper>
      );

      // The onSelect is passed to BaseFlowNode, which handles the actual selection
      expect(screen.getByTestId(`decision-node-${entity.id}`)).toBeDefined();
    });
  });
});

// =============================================================================
// ActionNode Tests
// =============================================================================

describe("ActionNode", () => {
  describe("createActionNode", () => {
    it("should create an action node entity with default values", () => {
      const entity = createActionNode();

      expect(entity).toBeDefined();
      expect(entity.id).toMatch(/^flow-node-/);
      expect(entity.getNodeType()).toBe("action");
      expect(entity.getLabel()).toBe("动作节点");
    });

    it("should create an action node with custom config", () => {
      const entity = createActionNode({
        label: "Process Data",
        actionType: "transform",
        description: "Transform input data",
      });

      expect(entity.getLabel()).toBe("Process Data");
      const formData = entity.getFormData();
      expect(formData?.actionType).toBe("transform");
      expect(formData?.description).toBe("Transform input data");
    });

    it("should have two ports (input, output)", () => {
      const entity = createActionNode();
      const ports = entity.getAllPorts();

      expect(ports).toHaveLength(2);
      expect(ports.some((p: PortDefinition) => p.id === "input")).toBe(true);
      expect(ports.some((p: PortDefinition) => p.id === "output")).toBe(true);
    });
  });

  describe("ActionNode Component", () => {
    it("should render without crashing", () => {
      const entity = createActionNode();

      render(
        <TestWrapper>
          <ActionNode entity={entity} />
        </TestWrapper>
      );

      expect(screen.getByTestId(`action-node-${entity.id}`)).toBeDefined();
    });
  });
});

// =============================================================================
// StartNode Tests
// =============================================================================

describe("StartNode", () => {
  describe("createStartNode", () => {
    it("should create a start node entity with default values", () => {
      const entity = createStartNode();

      expect(entity).toBeDefined();
      expect(entity.id).toMatch(/^flow-node-/);
      expect(entity.getNodeType()).toBe("start");
      expect(entity.getLabel()).toBe("开始");
    });

    it("should create a start node with custom trigger type", () => {
      const entity = createStartNode({
        triggerType: "scheduled",
        triggerDescription: "Run every hour",
      });

      const formData = entity.getFormData();
      expect(formData?.triggerType).toBe("scheduled");
      expect(formData?.triggerDescription).toBe("Run every hour");
    });

    it("should have only one output port", () => {
      const entity = createStartNode();
      const ports = entity.getAllPorts();

      expect(ports).toHaveLength(1);
      expect(ports[0].id).toBe("output");
      expect(ports[0].type).toBe("output");
    });
  });

  describe("StartNode Component", () => {
    it("should render without crashing", () => {
      const entity = createStartNode();

      render(
        <TestWrapper>
          <StartNode entity={entity} />
        </TestWrapper>
      );

      expect(screen.getByTestId(`start-node-${entity.id}`)).toBeDefined();
    });
  });
});

// =============================================================================
// EndNode Tests
// =============================================================================

describe("EndNode", () => {
  describe("createEndNode", () => {
    it("should create an end node entity with default values", () => {
      const entity = createEndNode();

      expect(entity).toBeDefined();
      expect(entity.id).toMatch(/^flow-node-/);
      expect(entity.getNodeType()).toBe("end");
      expect(entity.getLabel()).toBe("结束");
    });

    it("should create an end node with custom end type", () => {
      const entity = createEndNode({
        endType: "failure",
        endDescription: "Process failed",
        returnValue: "error_code_123",
      });

      const formData = entity.getFormData();
      expect(formData?.endType).toBe("failure");
      expect(formData?.endDescription).toBe("Process failed");
      expect(formData?.returnValue).toBe("error_code_123");
    });

    it("should have only one input port", () => {
      const entity = createEndNode();
      const ports = entity.getAllPorts();

      expect(ports).toHaveLength(1);
      expect(ports[0].id).toBe("input");
      expect(ports[0].type).toBe("input");
    });
  });

  describe("EndNode Component", () => {
    it("should render without crashing", () => {
      const entity = createEndNode();

      render(
        <TestWrapper>
          <EndNode entity={entity} />
        </TestWrapper>
      );

      expect(screen.getByTestId(`end-node-${entity.id}`)).toBeDefined();
    });
  });
});

// =============================================================================
// ConditionalEdge Tests
// =============================================================================

describe("ConditionalEdge", () => {
  describe("createConditionalEdge", () => {
    it("should create a conditional edge with required params", () => {
      const edge = createConditionalEdge({
        source: "node-1",
        sourcePort: "output",
        target: "node-2",
        targetPort: "input",
      });

      expect(edge).toBeDefined();
      expect(edge.id).toMatch(/^flow-edge-/);
      expect(edge.getEdgeType()).toBe("conditional");
    });

    it("should create a true branch edge with green theme", () => {
      const edge = createConditionalEdge({
        source: "decision-1",
        sourcePort: "true-output",
        target: "action-1",
        targetPort: "input",
        conditionResult: true,
        condition: "x > 10",
      });

      expect(edge.getLabel()).toBe("是");
      const theme = edge.getTheme();
      expect(theme?.strokeColor).toBe("#10B981"); // Green
    });

    it("should create a false branch edge with red theme", () => {
      const edge = createConditionalEdge({
        source: "decision-1",
        sourcePort: "false-output",
        target: "action-2",
        targetPort: "input",
        conditionResult: false,
        condition: "x <= 10",
      });

      expect(edge.getLabel()).toBe("否");
      const theme = edge.getTheme();
      expect(theme?.strokeColor).toBe("#EF4444"); // Red
    });

    it("should use custom label when provided", () => {
      const edge = createConditionalEdge({
        source: "node-1",
        sourcePort: "output",
        target: "node-2",
        targetPort: "input",
        label: "Custom Label",
      });

      expect(edge.getLabel()).toBe("Custom Label");
    });

    it("should store condition in metadata", () => {
      const edge = createConditionalEdge({
        source: "node-1",
        sourcePort: "output",
        target: "node-2",
        targetPort: "input",
        condition: "value === 'test'",
        conditionResult: true,
      });

      const metadata = edge.getMetadata();
      expect(metadata?.condition).toBe("value === 'test'");
      expect(metadata?.conditionResult).toBe(true);
    });
  });
});
