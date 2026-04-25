/**
 * @file FlowEdgeEntity unit tests
 * @description Tests for FlowEdgeEntity class covering connection management,
 * animation state, path configuration, theme, and serialization.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  FlowEdgeEntity,
  type IFlowEdgeEntityArguments,
} from "../../../src/common/flow/flow-edge-entity";
import type { EdgeAnimationState, PathType } from "../../../src/components/flow-entity/types";

describe("FlowEdgeEntity", () => {
  let entity: FlowEdgeEntity;
  const defaultArgs: IFlowEdgeEntityArguments = {
    sourceNodeId: "node1",
    sourcePortId: "out1",
    targetNodeId: "node2",
    targetPortId: "in1",
  };

  beforeEach(() => {
    entity = new FlowEdgeEntity(defaultArgs);
  });

  // ===========================================================================
  // Construction & Basic Properties
  // ===========================================================================

  describe("construction", () => {
    it("should create an entity with a unique ID", () => {
      const entity1 = new FlowEdgeEntity(defaultArgs);
      const entity2 = new FlowEdgeEntity(defaultArgs);
      expect(entity1.id).toMatch(/^flow-edge-/);
      expect(entity2.id).toMatch(/^flow-edge-/);
      expect(entity1.id).not.toBe(entity2.id);
    });

    it("should have correct type identifier", () => {
      expect(entity.type).toBe("flow-edge-entity");
      expect(FlowEdgeEntity.type).toBe("flow-edge-entity");
    });

    it("should throw error if sourceNodeId is missing", () => {
      expect(() => {
        new FlowEdgeEntity({
          sourcePortId: "out1",
          targetNodeId: "node2",
          targetPortId: "in1",
        } as IFlowEdgeEntityArguments);
      }).toThrow("sourceNodeId is required");
    });

    it("should throw error if sourcePortId is missing", () => {
      expect(() => {
        new FlowEdgeEntity({
          sourceNodeId: "node1",
          targetNodeId: "node2",
          targetPortId: "in1",
        } as IFlowEdgeEntityArguments);
      }).toThrow("sourcePortId is required");
    });

    it("should throw error if targetNodeId is missing", () => {
      expect(() => {
        new FlowEdgeEntity({
          sourceNodeId: "node1",
          sourcePortId: "out1",
          targetPortId: "in1",
        } as IFlowEdgeEntityArguments);
      }).toThrow("targetNodeId is required");
    });

    it("should throw error if targetPortId is missing", () => {
      expect(() => {
        new FlowEdgeEntity({
          sourceNodeId: "node1",
          sourcePortId: "out1",
          targetNodeId: "node2",
        } as IFlowEdgeEntityArguments);
      }).toThrow("targetPortId is required");
    });

    it("should initialize with default values", () => {
      expect(entity.getSourceNodeId()).toBe("node1");
      expect(entity.getSourcePortId()).toBe("out1");
      expect(entity.getTargetNodeId()).toBe("node2");
      expect(entity.getTargetPortId()).toBe("in1");
      expect(entity.getAnimationState()).toBe("idle");
      expect(entity.getPathType()).toBe("bezier");
      expect(entity.getEdgeType()).toBe("default");
      expect(entity.isSelected()).toBe(false);
      expect(entity.isDisabled()).toBe(false);
    });

    it("should accept initial arguments", () => {
      const args: IFlowEdgeEntityArguments = {
        edgeType: "conditional",
        label: "True Branch",
        sourceNodeId: "nodeA",
        sourcePortId: "outTrue",
        targetNodeId: "nodeB",
        targetPortId: "inData",
        animationState: "flowing",
        pathType: "smoothstep",
        pathConfig: { type: "smoothstep", borderRadius: 10 },
        animationConfig: { enabled: true, particleSpeed: 2 },
        theme: { strokeColor: "#3b82f6", strokeWidth: 2 },
        selected: true,
        disabled: true,
        metadata: { priority: "high" },
      };

      const customEntity = new FlowEdgeEntity(args);

      expect(customEntity.getEdgeType()).toBe("conditional");
      expect(customEntity.getLabel()).toBe("True Branch");
      expect(customEntity.getSourceNodeId()).toBe("nodeA");
      expect(customEntity.getSourcePortId()).toBe("outTrue");
      expect(customEntity.getTargetNodeId()).toBe("nodeB");
      expect(customEntity.getTargetPortId()).toBe("inData");
      expect(customEntity.getAnimationState()).toBe("flowing");
      expect(customEntity.getPathType()).toBe("smoothstep");
      expect(customEntity.getPathConfig()).toEqual({ type: "smoothstep", borderRadius: 10 });
      expect(customEntity.getAnimationConfig()).toEqual({ enabled: true, particleSpeed: 2 });
      expect(customEntity.getTheme()).toEqual({ strokeColor: "#3b82f6", strokeWidth: 2 });
      expect(customEntity.isSelected()).toBe(true);
      expect(customEntity.isDisabled()).toBe(true);
      expect(customEntity.getMetadata()).toEqual({ priority: "high" });
    });
  });

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  describe("connection management", () => {
    it("should get source and target node IDs", () => {
      expect(entity.getSourceNodeId()).toBe("node1");
      expect(entity.getTargetNodeId()).toBe("node2");
    });

    it("should get source and target port IDs", () => {
      expect(entity.getSourcePortId()).toBe("out1");
      expect(entity.getTargetPortId()).toBe("in1");
    });

    it("should set source connection", () => {
      entity.setSource("nodeA", "portA");
      expect(entity.getSourceNodeId()).toBe("nodeA");
      expect(entity.getSourcePortId()).toBe("portA");
    });

    it("should set target connection", () => {
      entity.setTarget("nodeB", "portB");
      expect(entity.getTargetNodeId()).toBe("nodeB");
      expect(entity.getTargetPortId()).toBe("portB");
    });

    it("should reconnect both source and target with connect()", () => {
      entity.connect("a", "a-out", "b", "b-in");
      expect(entity.getSourceNodeId()).toBe("a");
      expect(entity.getSourcePortId()).toBe("a-out");
      expect(entity.getTargetNodeId()).toBe("b");
      expect(entity.getTargetPortId()).toBe("b-in");
    });

    it("should check if edge connects a node", () => {
      expect(entity.connectsNode("node1")).toBe(true);
      expect(entity.connectsNode("node2")).toBe(true);
      expect(entity.connectsNode("node3")).toBe(false);
    });

    it("should check if edge connects two nodes", () => {
      expect(entity.connectsNodes("node1", "node2")).toBe(true);
      expect(entity.connectsNodes("node2", "node1")).toBe(true); // Either direction
      expect(entity.connectsNodes("node1", "node3")).toBe(false);
    });

    it("should get other node ID", () => {
      expect(entity.getOtherNodeId("node1")).toBe("node2");
      expect(entity.getOtherNodeId("node2")).toBe("node1");
      expect(entity.getOtherNodeId("node3")).toBeUndefined();
    });

    it("should detect self-loop", () => {
      expect(entity.isSelfLoop()).toBe(false);

      const selfLoopEntity = new FlowEdgeEntity({
        sourceNodeId: "node1",
        sourcePortId: "out1",
        targetNodeId: "node1",
        targetPortId: "in1",
      });
      expect(selfLoopEntity.isSelfLoop()).toBe(true);
    });

    it("should not modify connection after disposal", () => {
      entity.dispose();
      entity.setSource("newNode", "newPort");
      expect(entity.getSourceNodeId()).toBe("node1");
    });
  });

  // ===========================================================================
  // Animation State Management
  // ===========================================================================

  describe("animation state management", () => {
    it("should get and set animation state", () => {
      const states: EdgeAnimationState[] = ["idle", "flowing", "success", "error", "highlight"];

      for (const state of states) {
        entity.setAnimationState(state);
        expect(entity.getAnimationState()).toBe(state);
      }
    });

    it("should get and set animation config", () => {
      const config = {
        enabled: true,
        particleSpeed: 3,
        particleSize: 5,
        particleCount: 10,
      };

      entity.setAnimationConfig(config);
      expect(entity.getAnimationConfig()).toEqual(config);
    });

    it("should enable and disable animation", () => {
      expect(entity.isAnimationEnabled()).toBe(false);

      entity.setAnimationEnabled(true);
      expect(entity.isAnimationEnabled()).toBe(true);

      entity.setAnimationEnabled(false);
      expect(entity.isAnimationEnabled()).toBe(false);
    });

    it("should preserve existing animation config when enabling", () => {
      entity.setAnimationConfig({ particleSpeed: 5, particleSize: 3 });
      entity.setAnimationEnabled(true);

      const config = entity.getAnimationConfig();
      expect(config?.enabled).toBe(true);
      expect(config?.particleSpeed).toBe(5);
      expect(config?.particleSize).toBe(3);
    });

    it("should not modify animation state after disposal", () => {
      entity.dispose();
      entity.setAnimationState("flowing");
      expect(entity.getAnimationState()).toBe("idle");
    });
  });

  // ===========================================================================
  // Path Type Management
  // ===========================================================================

  describe("path type management", () => {
    it("should get and set path type", () => {
      const pathTypes: PathType[] = ["straight", "bezier", "step", "smoothstep"];

      for (const pathType of pathTypes) {
        entity.setPathType(pathType);
        expect(entity.getPathType()).toBe(pathType);
      }
    });

    it("should default to bezier path type", () => {
      expect(entity.getPathType()).toBe("bezier");
    });

    it("should get and set path config", () => {
      const config = {
        type: "smoothstep" as PathType,
        curvature: 0.5,
        borderRadius: 10,
        offset: 20,
      };

      entity.setPathConfig(config);
      expect(entity.getPathConfig()).toEqual(config);
      expect(entity.getPathType()).toBe("smoothstep"); // Should sync path type
    });

    it("should set and get curvature", () => {
      entity.setCurvature(0.75);
      expect(entity.getCurvature()).toBe(0.75);
    });

    it("should normalize curvature to 0-1 range", () => {
      entity.setCurvature(-0.5);
      expect(entity.getCurvature()).toBe(0);

      entity.setCurvature(1.5);
      expect(entity.getCurvature()).toBe(1);
    });

    it("should return default curvature if not set", () => {
      expect(entity.getCurvature()).toBe(0.25);
    });

    it("should not modify path type after disposal", () => {
      entity.dispose();
      entity.setPathType("straight");
      expect(entity.getPathType()).toBe("bezier");
    });
  });

  // ===========================================================================
  // Theme Management
  // ===========================================================================

  describe("theme management", () => {
    it("should get and set theme", () => {
      const theme = {
        strokeColor: "#ff0000",
        strokeWidth: 3,
        opacity: 0.8,
      };

      entity.setTheme(theme);
      expect(entity.getTheme()).toEqual(theme);
    });

    it("should update theme (merge)", () => {
      entity.setTheme({ strokeColor: "#ff0000" });
      entity.updateTheme({ strokeWidth: 2 });

      expect(entity.getTheme()).toEqual({
        strokeColor: "#ff0000",
        strokeWidth: 2,
      });
    });

    it("should get and set stroke color", () => {
      entity.setStrokeColor("#00ff00");
      expect(entity.getStrokeColor()).toBe("#00ff00");
    });

    it("should get and set stroke width", () => {
      entity.setStrokeWidth(4);
      expect(entity.getStrokeWidth()).toBe(4);
    });

    it("should get and set stroke dasharray", () => {
      entity.setStrokeDasharray("5,5");
      expect(entity.getStrokeDasharray()).toBe("5,5");
    });

    it("should preserve existing theme when setting individual properties", () => {
      entity.setTheme({ strokeColor: "#ff0000", opacity: 0.5 });
      entity.setStrokeWidth(2);

      const theme = entity.getTheme();
      expect(theme?.strokeColor).toBe("#ff0000");
      expect(theme?.strokeWidth).toBe(2);
      expect(theme?.opacity).toBe(0.5);
    });

    it("should not modify theme after disposal", () => {
      entity.dispose();
      entity.setTheme({ strokeColor: "#ff0000" });
      expect(entity.getTheme()).toBeUndefined();
    });
  });

  // ===========================================================================
  // Label & Type Management
  // ===========================================================================

  describe("label and type management", () => {
    it("should get and set label", () => {
      expect(entity.getLabel()).toBeUndefined();

      entity.setLabel("Connection");
      expect(entity.getLabel()).toBe("Connection");
    });

    it("should get and set edge type", () => {
      expect(entity.getEdgeType()).toBe("default");

      entity.setEdgeType("conditional");
      expect(entity.getEdgeType()).toBe("conditional");
    });

    it("should not modify label after disposal", () => {
      entity.dispose();
      entity.setLabel("New Label");
      expect(entity.getLabel()).toBeUndefined();
    });
  });

  // ===========================================================================
  // Selection & State Flags
  // ===========================================================================

  describe("selection and state flags", () => {
    it("should get and set selected state", () => {
      expect(entity.isSelected()).toBe(false);

      entity.setSelected(true);
      expect(entity.isSelected()).toBe(true);

      entity.setSelected(false);
      expect(entity.isSelected()).toBe(false);
    });

    it("should get and set disabled state", () => {
      expect(entity.isDisabled()).toBe(false);

      entity.setDisabled(true);
      expect(entity.isDisabled()).toBe(true);

      entity.setDisabled(false);
      expect(entity.isDisabled()).toBe(false);
    });

    it("should not modify state flags after disposal", () => {
      entity.dispose();
      entity.setSelected(true);
      entity.setDisabled(true);
      expect(entity.isSelected()).toBe(false);
      expect(entity.isDisabled()).toBe(false);
    });
  });

  // ===========================================================================
  // Metadata Management
  // ===========================================================================

  describe("metadata management", () => {
    it("should get and set metadata", () => {
      expect(entity.getMetadata()).toBeUndefined();

      const metadata = { weight: 1.5, label: "primary" };
      entity.setMetadata(metadata);
      expect(entity.getMetadata()).toEqual(metadata);
    });

    it("should update metadata (merge)", () => {
      entity.setMetadata({ key1: "value1" });
      entity.updateMetadata({ key2: "value2" });

      expect(entity.getMetadata()).toEqual({
        key1: "value1",
        key2: "value2",
      });
    });

    it("should overwrite existing keys on update", () => {
      entity.setMetadata({ key: "old" });
      entity.updateMetadata({ key: "new" });

      expect(entity.getMetadata()).toEqual({ key: "new" });
    });

    it("should not modify metadata after disposal", () => {
      entity.dispose();
      entity.setMetadata({ key: "value" });
      expect(entity.getMetadata()).toBeUndefined();
    });
  });

  // ===========================================================================
  // Entity Data & Config
  // ===========================================================================

  describe("entity data and config", () => {
    it("should expose data property", () => {
      const data = entity.data;
      expect(data).toBeDefined();
      expect(data?.sourceNodeId).toBe("node1");
      expect(data?.targetNodeId).toBe("node2");
    });

    it("should allow setting data", () => {
      entity.data = {
        sourceNodeId: "nodeA",
        sourcePortId: "portA",
        targetNodeId: "nodeB",
        targetPortId: "portB",
        animationState: "flowing",
      };

      expect(entity.getSourceNodeId()).toBe("nodeA");
      expect(entity.getAnimationState()).toBe("flowing");
    });

    it("should not set data after disposal", () => {
      entity.dispose();
      entity.data = {
        sourceNodeId: "newNode",
        sourcePortId: "newPort",
        targetNodeId: "newTarget",
        targetPortId: "newTargetPort",
        animationState: "success",
      };

      expect(entity.getSourceNodeId()).toBe("node1");
    });

    it("should expose config property", () => {
      const args: IFlowEdgeEntityArguments = {
        ...defaultArgs,
        edgeType: "custom",
      };
      const customEntity = new FlowEdgeEntity(args);

      expect(customEntity.config).toEqual(args);
    });

    it("should allow setting config", () => {
      entity.config = { id: "test-config" };
      expect(entity.config).toEqual({ id: "test-config" });
    });
  });

  // ===========================================================================
  // Edge Reference
  // ===========================================================================

  describe("edge reference", () => {
    it("should throw error when getting edge before it is set", () => {
      expect(() => entity.edge).toThrow("edge reference not set");
    });

    it("should get and set edge reference", () => {
      const mockEdge = {
        sources: [],
        targets: [],
        isValid: true,
        state: "active" as const,
        setState: () => {},
        activate: () => {},
        deactivate: () => {},
        disable: () => {},
        isActive: () => true,
        connectsNode: () => false,
        connectsNodes: () => false,
        getOtherNodes: () => [],
        isSelfLoop: () => false,
        toJSON: () => ({}),
        dispose: () => {},
      };

      entity.setEdge(mockEdge);
      expect(entity.edge).toBe(mockEdge);
    });
  });

  // ===========================================================================
  // Serialization
  // ===========================================================================

  describe("serialization", () => {
    it("should serialize to JSON", () => {
      entity.setLabel("Test Edge");
      entity.setAnimationState("flowing");
      entity.setPathType("smoothstep");
      entity.setTheme({ strokeColor: "#3b82f6" });
      entity.setSelected(true);
      entity.setMetadata({ priority: 1 });

      const json = entity.toJSON();

      expect(json.id).toBe(entity.id);
      expect(json.type).toBe("flow-edge-entity");
      expect(json.data).toBeDefined();

      const data = json.data as Record<string, unknown>;
      expect(data.sourceNodeId).toBe("node1");
      expect(data.targetNodeId).toBe("node2");
      expect(data.label).toBe("Test Edge");
      expect(data.animationState).toBe("flowing");
      expect(data.pathType).toBe("smoothstep");
      expect(data.theme).toEqual({ strokeColor: "#3b82f6" });
      expect(data.selected).toBe(true);
      expect(data.metadata).toEqual({ priority: 1 });
    });

    it("should deserialize from JSON", () => {
      const json = {
        id: "flow-edge-test",
        type: "flow-edge-entity",
        data: {
          edgeType: "conditional",
          label: "Branch",
          sourceNodeId: "nodeA",
          sourcePortId: "outA",
          targetNodeId: "nodeB",
          targetPortId: "inB",
          animationState: "success",
          pathType: "step",
          pathConfig: { type: "step", borderRadius: 5 },
          animationConfig: { enabled: true },
          theme: { strokeWidth: 2 },
          selected: true,
          disabled: true,
          metadata: { key: "value" },
        },
      };

      const restored = FlowEdgeEntity.fromJSON(json);

      expect(restored.id).toMatch(/^flow-edge-/); // New ID is generated
      expect(restored.type).toBe("flow-edge-entity");
      expect(restored.getEdgeType()).toBe("conditional");
      expect(restored.getLabel()).toBe("Branch");
      expect(restored.getSourceNodeId()).toBe("nodeA");
      expect(restored.getSourcePortId()).toBe("outA");
      expect(restored.getTargetNodeId()).toBe("nodeB");
      expect(restored.getTargetPortId()).toBe("inB");
      expect(restored.getAnimationState()).toBe("success");
      expect(restored.getPathType()).toBe("step");
      expect(restored.getPathConfig()).toEqual({ type: "step", borderRadius: 5 });
      expect(restored.getAnimationConfig()).toEqual({ enabled: true });
      expect(restored.getTheme()).toEqual({ strokeWidth: 2 });
      expect(restored.isSelected()).toBe(true);
      expect(restored.isDisabled()).toBe(true);
      expect(restored.getMetadata()).toEqual({ key: "value" });
    });

    it("should round-trip serialize and deserialize", () => {
      entity.setLabel("Round Trip");
      entity.setAnimationState("highlight");
      entity.setPathType("bezier");
      entity.setCurvature(0.6);
      entity.setTheme({ strokeColor: "#10b981", strokeWidth: 3 });
      entity.setMetadata({ test: true });

      const json = entity.toJSON();
      const restored = FlowEdgeEntity.fromJSON(json);

      expect(restored.getLabel()).toBe("Round Trip");
      expect(restored.getAnimationState()).toBe("highlight");
      expect(restored.getPathType()).toBe("bezier");
      expect(restored.getCurvature()).toBe(0.6);
      expect(restored.getTheme()).toEqual({ strokeColor: "#10b981", strokeWidth: 3 });
      expect(restored.getMetadata()).toEqual({ test: true });
    });
  });

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  describe("lifecycle", () => {
    it("should track disposed state", () => {
      expect(entity.isDisposed).toBe(false);

      entity.dispose();
      expect(entity.isDisposed).toBe(true);
    });

    it("should only dispose once", () => {
      entity.dispose();
      entity.dispose(); // Should not throw

      expect(entity.isDisposed).toBe(true);
    });

    it("should clear edge reference on dispose", () => {
      const mockEdge = {
        sources: [],
        targets: [],
        isValid: true,
        state: "active" as const,
        setState: () => {},
        activate: () => {},
        deactivate: () => {},
        disable: () => {},
        isActive: () => true,
        connectsNode: () => false,
        connectsNodes: () => false,
        getOtherNodes: () => [],
        isSelfLoop: () => false,
        toJSON: () => ({}),
        dispose: () => {},
      };

      entity.setEdge(mockEdge);
      entity.dispose();

      expect(() => entity.edge).toThrow("edge reference not set");
    });

    it("should call dispose on underlying edge if available", () => {
      let disposeCalled = false;
      const mockEdge = {
        sources: [],
        targets: [],
        isValid: true,
        state: "active" as const,
        setState: () => {},
        activate: () => {},
        deactivate: () => {},
        disable: () => {},
        isActive: () => true,
        connectsNode: () => false,
        connectsNodes: () => false,
        getOtherNodes: () => [],
        isSelfLoop: () => false,
        toJSON: () => ({}),
        dispose: () => {
          disposeCalled = true;
        },
      };

      entity.setEdge(mockEdge);
      entity.dispose();

      expect(disposeCalled).toBe(true);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle empty string labels", () => {
      entity.setLabel("");
      expect(entity.getLabel()).toBe("");
    });

    it("should handle complex metadata", () => {
      const complexMetadata = {
        nested: { deep: { value: true } },
        array: [1, 2, 3],
        mixed: { items: [{ id: 1 }] },
      };

      entity.setMetadata(complexMetadata);
      expect(entity.getMetadata()).toEqual(complexMetadata);
    });

    it("should handle all animation state colors in theme", () => {
      entity.setTheme({
        strokeColor: "#000",
        animationStateColors: {
          idle: "#gray",
          flowing: "#blue",
          success: "#green",
          error: "#red",
          highlight: "#yellow",
        },
      });

      expect(entity.getTheme()?.animationStateColors).toEqual({
        idle: "#gray",
        flowing: "#blue",
        success: "#green",
        error: "#red",
        highlight: "#yellow",
      });
    });

    it("should handle path config with all options", () => {
      entity.setPathConfig({
        type: "smoothstep",
        curvature: 0.5,
        borderRadius: 8,
        offset: 16,
      });

      const config = entity.getPathConfig();
      expect(config?.type).toBe("smoothstep");
      expect(config?.curvature).toBe(0.5);
      expect(config?.borderRadius).toBe(8);
      expect(config?.offset).toBe(16);
    });

    it("should handle animation config with all options", () => {
      entity.setAnimationConfig({
        enabled: true,
        particleSpeed: 2,
        particleSize: 4,
        particleCount: 8,
        animation: {
          duration: 1000,
          easing: "ease-in-out",
          delay: 100,
          iterations: "infinite",
        },
      });

      const config = entity.getAnimationConfig();
      expect(config?.enabled).toBe(true);
      expect(config?.particleSpeed).toBe(2);
      expect(config?.particleSize).toBe(4);
      expect(config?.particleCount).toBe(8);
      expect(config?.animation?.duration).toBe(1000);
      expect(config?.animation?.easing).toBe("ease-in-out");
      expect(config?.animation?.delay).toBe(100);
      expect(config?.animation?.iterations).toBe("infinite");
    });
  });
});
