/**
 * @file Flow Entity Registry unit tests
 * @description Tests for flow-entity-registry.ts covering registry management,
 * entity type registration, and factory helpers.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  flowRegistryManager,
  FLOW_NODE_ENTITY_TYPE,
  FLOW_EDGE_ENTITY_TYPE,
  getFlowNodeEntityType,
  getFlowEdgeEntityType,
  createFlowNodeEntity,
  createFlowEdgeEntity,
  hasFlowEntityRegistry,
  getFlowEntityRegistry,
  registerFlowEntityType,
} from "../../../src/common/flow/flow-entity-registry";
import { FlowNodeEntity } from "../../../src/common/flow/flow-node-entity";
import { FlowEdgeEntity } from "../../../src/common/flow/flow-edge-entity";
import type { IRegistry } from "../../../src/common/registry/types";
import type { IEntity } from "../../../src/common/entity/types";

describe("FlowEntityRegistry", () => {
  // ===========================================================================
  // Registry Manager Tests
  // ===========================================================================

  describe("flowRegistryManager", () => {
    it("should be a singleton registry manager", () => {
      expect(flowRegistryManager).toBeDefined();
      expect(flowRegistryManager.name).toBe("RegistryManager");
    });

    it("should have flow-node-entity registry registered", () => {
      const registry = flowRegistryManager.getRegistry(FLOW_NODE_ENTITY_TYPE);
      expect(registry).toBeDefined();
      expect(registry?.meta?.type).toBe(FLOW_NODE_ENTITY_TYPE);
    });

    it("should have flow-edge-entity registry registered", () => {
      const registry = flowRegistryManager.getRegistry(FLOW_EDGE_ENTITY_TYPE);
      expect(registry).toBeDefined();
      expect(registry?.meta?.type).toBe(FLOW_EDGE_ENTITY_TYPE);
    });

    it("should have flow-node-entity as default registry", () => {
      const defaultRegistry = flowRegistryManager.getDefaultRegistry();
      expect(defaultRegistry).toBeDefined();
      expect(defaultRegistry?.meta?.type).toBe(FLOW_NODE_ENTITY_TYPE);
    });
  });

  // ===========================================================================
  // Type Constants Tests
  // ===========================================================================

  describe("type constants", () => {
    it("should have correct FLOW_NODE_ENTITY_TYPE value", () => {
      expect(FLOW_NODE_ENTITY_TYPE).toBe("flow-node-entity");
    });

    it("should have correct FLOW_EDGE_ENTITY_TYPE value", () => {
      expect(FLOW_EDGE_ENTITY_TYPE).toBe("flow-edge-entity");
    });
  });

  // ===========================================================================
  // getFlowNodeEntityType Tests
  // ===========================================================================

  describe("getFlowNodeEntityType", () => {
    it("should return FlowNodeEntity constructor", () => {
      const NodeClass = getFlowNodeEntityType();
      expect(NodeClass).toBe(FlowNodeEntity);
    });

    it("should be usable to create instances", () => {
      const NodeClass = getFlowNodeEntityType();
      const node = new NodeClass({ nodeType: "task", label: "Test" });

      expect(node).toBeInstanceOf(FlowNodeEntity);
      expect(node.getNodeType()).toBe("task");
      expect(node.getLabel()).toBe("Test");
    });
  });

  // ===========================================================================
  // getFlowEdgeEntityType Tests
  // ===========================================================================

  describe("getFlowEdgeEntityType", () => {
    it("should return FlowEdgeEntity constructor", () => {
      const EdgeClass = getFlowEdgeEntityType();
      expect(EdgeClass).toBe(FlowEdgeEntity);
    });

    it("should be usable to create instances", () => {
      const EdgeClass = getFlowEdgeEntityType();
      const edge = new EdgeClass({
        sourceNodeId: "node1",
        sourcePortId: "out1",
        targetNodeId: "node2",
        targetPortId: "in1",
      });

      expect(edge).toBeInstanceOf(FlowEdgeEntity);
      expect(edge.getSourceNodeId()).toBe("node1");
      expect(edge.getTargetNodeId()).toBe("node2");
    });
  });

  // ===========================================================================
  // createFlowNodeEntity Factory Tests
  // ===========================================================================

  describe("createFlowNodeEntity", () => {
    it("should create a FlowNodeEntity with default values", () => {
      const node = createFlowNodeEntity();

      expect(node).toBeInstanceOf(FlowNodeEntity);
      expect(node.getNodeType()).toBe("default");
      expect(node.getLabel()).toBe("Node");
      expect(node.getExecutionState()).toBe("idle");
    });

    it("should create a FlowNodeEntity with provided data", () => {
      const node = createFlowNodeEntity({
        nodeType: "decision",
        label: "Branch Node",
        position: { x: 200, y: 300 },
        executionState: "pending",
      });

      expect(node).toBeInstanceOf(FlowNodeEntity);
      expect(node.getNodeType()).toBe("decision");
      expect(node.getLabel()).toBe("Branch Node");
      expect(node.getPosition()).toEqual({ x: 200, y: 300 });
      expect(node.getExecutionState()).toBe("pending");
    });

    it("should create a FlowNodeEntity with ports", () => {
      const node = createFlowNodeEntity({
        inputPorts: [{ id: "in1", name: "Input", type: "input" }],
        outputPorts: [
          { id: "out1", name: "True", type: "output" },
          { id: "out2", name: "False", type: "output" },
        ],
      });

      expect(node.getInputPorts()).toHaveLength(1);
      expect(node.getOutputPorts()).toHaveLength(2);
      expect(node.getPortById("in1")?.name).toBe("Input");
      expect(node.getPortById("out1")?.name).toBe("True");
    });

    it("should create nodes with unique IDs", () => {
      const node1 = createFlowNodeEntity();
      const node2 = createFlowNodeEntity();

      expect(node1.id).not.toBe(node2.id);
    });
  });

  // ===========================================================================
  // createFlowEdgeEntity Factory Tests
  // ===========================================================================

  describe("createFlowEdgeEntity", () => {
    it("should create a FlowEdgeEntity with required connection data", () => {
      const edge = createFlowEdgeEntity({
        sourceNodeId: "nodeA",
        sourcePortId: "portOut",
        targetNodeId: "nodeB",
        targetPortId: "portIn",
      });

      expect(edge).toBeInstanceOf(FlowEdgeEntity);
      expect(edge.getSourceNodeId()).toBe("nodeA");
      expect(edge.getSourcePortId()).toBe("portOut");
      expect(edge.getTargetNodeId()).toBe("nodeB");
      expect(edge.getTargetPortId()).toBe("portIn");
    });

    it("should create a FlowEdgeEntity with default values", () => {
      const edge = createFlowEdgeEntity({
        sourceNodeId: "node1",
        sourcePortId: "out1",
        targetNodeId: "node2",
        targetPortId: "in1",
      });

      expect(edge.getAnimationState()).toBe("idle");
      expect(edge.getPathType()).toBe("bezier");
      expect(edge.getEdgeType()).toBe("default");
    });

    it("should create a FlowEdgeEntity with custom options", () => {
      const edge = createFlowEdgeEntity({
        sourceNodeId: "node1",
        sourcePortId: "out1",
        targetNodeId: "node2",
        targetPortId: "in1",
        edgeType: "conditional",
        label: "True Branch",
        pathType: "smoothstep",
        animationState: "flowing",
        theme: { strokeColor: "#3b82f6", strokeWidth: 2 },
      });

      expect(edge.getEdgeType()).toBe("conditional");
      expect(edge.getLabel()).toBe("True Branch");
      expect(edge.getPathType()).toBe("smoothstep");
      expect(edge.getAnimationState()).toBe("flowing");
      expect(edge.getTheme()).toEqual({ strokeColor: "#3b82f6", strokeWidth: 2 });
    });

    it("should create edges with unique IDs", () => {
      const edge1 = createFlowEdgeEntity({
        sourceNodeId: "n1",
        sourcePortId: "o1",
        targetNodeId: "n2",
        targetPortId: "i1",
      });
      const edge2 = createFlowEdgeEntity({
        sourceNodeId: "n1",
        sourcePortId: "o1",
        targetNodeId: "n2",
        targetPortId: "i1",
      });

      expect(edge1.id).not.toBe(edge2.id);
    });
  });

  // ===========================================================================
  // hasFlowEntityRegistry Tests
  // ===========================================================================

  describe("hasFlowEntityRegistry", () => {
    it("should return true for registered types", () => {
      expect(hasFlowEntityRegistry(FLOW_NODE_ENTITY_TYPE)).toBe(true);
      expect(hasFlowEntityRegistry(FLOW_EDGE_ENTITY_TYPE)).toBe(true);
    });

    it("should return false for unregistered types", () => {
      expect(hasFlowEntityRegistry("non-existent-type")).toBe(false);
      expect(hasFlowEntityRegistry("custom-node")).toBe(false);
    });
  });

  // ===========================================================================
  // getFlowEntityRegistry Tests
  // ===========================================================================

  describe("getFlowEntityRegistry", () => {
    it("should return registry for registered types", () => {
      const nodeRegistry = getFlowEntityRegistry(FLOW_NODE_ENTITY_TYPE);
      const edgeRegistry = getFlowEntityRegistry(FLOW_EDGE_ENTITY_TYPE);

      expect(nodeRegistry).toBeDefined();
      expect(edgeRegistry).toBeDefined();
    });

    it("should return undefined for unregistered types", () => {
      const registry = getFlowEntityRegistry("unknown-type");
      expect(registry).toBeUndefined();
    });

    it("should return registries with correct meta", () => {
      const nodeRegistry = getFlowEntityRegistry(FLOW_NODE_ENTITY_TYPE);
      expect(nodeRegistry?.meta?.type).toBe(FLOW_NODE_ENTITY_TYPE);
      expect(nodeRegistry?.meta?.description).toContain("FlowNodeEntity");
    });
  });

  // ===========================================================================
  // registerFlowEntityType Tests
  // ===========================================================================

  describe("registerFlowEntityType", () => {
    it("should register a custom entity type", () => {
      // Create a simple mock entity for testing
      class CustomEntity implements IEntity {
        static readonly type = "custom-test-entity";
        readonly id = "custom-1";
        readonly type = "custom-test-entity";
        data = undefined;
        config = undefined;
        get isDisposed() {
          return false;
        }
        dispose() {}
      }

      class CustomRegistry implements IRegistry<CustomEntity> {
        readonly meta = {
          type: "custom-test-entity",
          description: "Test custom registry",
        };

        getConstructor() {
          return CustomEntity;
        }
      }

      // Register the custom type
      registerFlowEntityType("custom-test-entity", new CustomRegistry());

      // Verify registration
      expect(hasFlowEntityRegistry("custom-test-entity")).toBe(true);

      const registry = getFlowEntityRegistry("custom-test-entity");
      expect(registry).toBeDefined();
      expect(registry?.meta?.type).toBe("custom-test-entity");

      // Verify constructor can be retrieved
      const Ctor = registry?.getConstructor();
      expect(Ctor).toBe(CustomEntity);
    });
  });

  // ===========================================================================
  // Integration Tests
  // ===========================================================================

  describe("integration", () => {
    it("should create connected node and edge entities", () => {
      // Create two nodes
      const startNode = createFlowNodeEntity({
        nodeType: "start",
        label: "Start",
        outputPorts: [{ id: "out1", name: "Output", type: "output" }],
      });

      const endNode = createFlowNodeEntity({
        nodeType: "end",
        label: "End",
        inputPorts: [{ id: "in1", name: "Input", type: "input" }],
      });

      // Create edge connecting them
      const edge = createFlowEdgeEntity({
        sourceNodeId: startNode.id,
        sourcePortId: "out1",
        targetNodeId: endNode.id,
        targetPortId: "in1",
      });

      // Verify connection
      expect(edge.getSourceNodeId()).toBe(startNode.id);
      expect(edge.getTargetNodeId()).toBe(endNode.id);
      expect(edge.connectsNode(startNode.id)).toBe(true);
      expect(edge.connectsNode(endNode.id)).toBe(true);
      expect(edge.connectsNodes(startNode.id, endNode.id)).toBe(true);
    });

    it("should serialize and deserialize entities created via factory", () => {
      const node = createFlowNodeEntity({
        nodeType: "task",
        label: "Process",
        position: { x: 100, y: 200 },
        metadata: { customField: "value" },
      });

      const json = node.toJSON();
      const restored = FlowNodeEntity.fromJSON(json);

      expect(restored.getNodeType()).toBe("task");
      expect(restored.getLabel()).toBe("Process");
      expect(restored.getPosition()).toEqual({ x: 100, y: 200 });
      expect(restored.getMetadata()).toEqual({ customField: "value" });
    });

    it("should allow retrieving constructor and creating instance directly", () => {
      const NodeClass = getFlowNodeEntityType();
      const EdgeClass = getFlowEdgeEntityType();

      // Create via constructor
      const node = new NodeClass({ nodeType: "manual", label: "Manual Node" });
      const edge = new EdgeClass({
        sourceNodeId: node.id,
        sourcePortId: "o1",
        targetNodeId: "other",
        targetPortId: "i1",
      });

      expect(node.getNodeType()).toBe("manual");
      expect(edge.getSourceNodeId()).toBe(node.id);
    });
  });
});
