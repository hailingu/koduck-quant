/**
 * @file FlowNodeEntity unit tests
 * @description Tests for FlowNodeEntity class covering port management,
 * execution state, form data, and serialization.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  FlowNodeEntity,
  type IFlowNodeEntityArguments,
} from "../../../src/common/flow/flow-node-entity";
import type {
  ExecutionState,
  PortDefinition,
  FormSchema,
} from "../../../src/common/flow/model-types";

describe("FlowNodeEntity", () => {
  let entity: FlowNodeEntity;

  beforeEach(() => {
    entity = new FlowNodeEntity();
  });

  // ===========================================================================
  // Construction & Basic Properties
  // ===========================================================================

  describe("construction", () => {
    it("should create an entity with a unique ID", () => {
      const entity1 = new FlowNodeEntity();
      const entity2 = new FlowNodeEntity();
      expect(entity1.id).toMatch(/^flow-node-/);
      expect(entity2.id).toMatch(/^flow-node-/);
      expect(entity1.id).not.toBe(entity2.id);
    });

    it("should have correct type identifier", () => {
      expect(entity.type).toBe("flow-node-entity");
      expect(FlowNodeEntity.type).toBe("flow-node-entity");
    });

    it("should initialize with default values", () => {
      expect(entity.getLabel()).toBe("Node");
      expect(entity.getNodeType()).toBe("default");
      expect(entity.getExecutionState()).toBe("idle");
      expect(entity.getPosition()).toEqual({ x: 0, y: 0 });
      expect(entity.getSize()).toEqual({ width: 200, height: 100 });
      expect(entity.getInputPorts()).toEqual([]);
      expect(entity.getOutputPorts()).toEqual([]);
      expect(entity.isSelected()).toBe(false);
      expect(entity.isDisabled()).toBe(false);
      expect(entity.isLocked()).toBe(false);
    });

    it("should accept initial arguments", () => {
      const args: IFlowNodeEntityArguments = {
        nodeType: "task",
        label: "Process Data",
        position: { x: 100, y: 200 },
        size: { width: 250, height: 150 },
        executionState: "pending",
        inputPorts: [{ id: "in1", name: "Input", type: "input" }],
        outputPorts: [{ id: "out1", name: "Output", type: "output" }],
        disabled: true,
        selected: true,
        locked: true,
        metadata: { custom: "value" },
      };

      const customEntity = new FlowNodeEntity(args);

      expect(customEntity.getNodeType()).toBe("task");
      expect(customEntity.getLabel()).toBe("Process Data");
      expect(customEntity.getPosition()).toEqual({ x: 100, y: 200 });
      expect(customEntity.getSize()).toEqual({ width: 250, height: 150 });
      expect(customEntity.getExecutionState()).toBe("pending");
      expect(customEntity.getInputPorts()).toHaveLength(1);
      expect(customEntity.getOutputPorts()).toHaveLength(1);
      expect(customEntity.isDisabled()).toBe(true);
      expect(customEntity.isSelected()).toBe(true);
      expect(customEntity.isLocked()).toBe(true);
      expect(customEntity.getMetadata()).toEqual({ custom: "value" });
    });
  });

  // ===========================================================================
  // Position & Size Management
  // ===========================================================================

  describe("position management", () => {
    it("should get and set position", () => {
      entity.setPosition({ x: 150, y: 250 });
      expect(entity.getPosition()).toEqual({ x: 150, y: 250 });
    });

    it("should return a copy of position (not reference)", () => {
      entity.setPosition({ x: 100, y: 100 });
      const pos = entity.getPosition();
      pos.x = 999;
      expect(entity.getPosition().x).toBe(100);
    });
  });

  describe("size management", () => {
    it("should get and set size", () => {
      entity.setSize({ width: 300, height: 200 });
      expect(entity.getSize()).toEqual({ width: 300, height: 200 });
    });

    it("should return a copy of size (not reference)", () => {
      entity.setSize({ width: 200, height: 100 });
      const size = entity.getSize();
      size.width = 999;
      expect(entity.getSize().width).toBe(200);
    });
  });

  // ===========================================================================
  // Port Management
  // ===========================================================================

  describe("port management", () => {
    const inputPort: PortDefinition = {
      id: "in1",
      name: "Input 1",
      type: "input",
      dataType: "any",
      required: true,
    };

    const outputPort: PortDefinition = {
      id: "out1",
      name: "Output 1",
      type: "output",
      dataType: "string",
    };

    const mixedPorts: PortDefinition[] = [
      { id: "in1", name: "Input 1", type: "input" },
      { id: "in2", name: "Input 2", type: "input" },
      { id: "out1", name: "Output 1", type: "output" },
    ];

    it("should set ports and split by type", () => {
      entity.setPorts(mixedPorts);

      expect(entity.getInputPorts()).toHaveLength(2);
      expect(entity.getOutputPorts()).toHaveLength(1);
      expect(entity.getAllPorts()).toHaveLength(3);
    });

    it("should get input ports correctly", () => {
      entity.setPorts(mixedPorts);
      const inputs = entity.getInputPorts();

      expect(inputs.map((p) => p.id)).toEqual(["in1", "in2"]);
      expect(inputs.every((p) => p.type === "input")).toBe(true);
    });

    it("should get output ports correctly", () => {
      entity.setPorts(mixedPorts);
      const outputs = entity.getOutputPorts();

      expect(outputs.map((p) => p.id)).toEqual(["out1"]);
      expect(outputs.every((p) => p.type === "output")).toBe(true);
    });

    it("should get port by ID", () => {
      entity.setPorts(mixedPorts);

      expect(entity.getPortById("in1")).toMatchObject({ id: "in1", type: "input" });
      expect(entity.getPortById("out1")).toMatchObject({ id: "out1", type: "output" });
      expect(entity.getPortById("nonexistent")).toBeUndefined();
    });

    it("should add a single input port", () => {
      entity.addPort(inputPort);

      expect(entity.getInputPorts()).toHaveLength(1);
      expect(entity.getInputPorts()[0]).toMatchObject(inputPort);
    });

    it("should add a single output port", () => {
      entity.addPort(outputPort);

      expect(entity.getOutputPorts()).toHaveLength(1);
      expect(entity.getOutputPorts()[0]).toMatchObject(outputPort);
    });

    it("should remove a port by ID", () => {
      entity.setPorts(mixedPorts);

      expect(entity.removePort("in1")).toBe(true);
      expect(entity.getInputPorts()).toHaveLength(1);
      expect(entity.getPortById("in1")).toBeUndefined();
    });

    it("should return false when removing nonexistent port", () => {
      entity.setPorts(mixedPorts);
      expect(entity.removePort("nonexistent")).toBe(false);
    });

    it("should return copies of port arrays (not references)", () => {
      entity.setPorts(mixedPorts);
      const ports = entity.getAllPorts();
      ports.push({ id: "extra", name: "Extra", type: "input" });

      expect(entity.getAllPorts()).toHaveLength(3);
    });
  });

  // ===========================================================================
  // Execution State Management
  // ===========================================================================

  describe("execution state management", () => {
    const states: ExecutionState[] = [
      "idle",
      "pending",
      "running",
      "success",
      "error",
      "skipped",
      "cancelled",
    ];

    it.each(states)("should set and get execution state: %s", (state) => {
      entity.setExecutionState(state);
      expect(entity.getExecutionState()).toBe(state);
    });

    it("should track execution start time when entering running state", () => {
      const before = Date.now();
      entity.setExecutionState("running");
      const after = Date.now();

      const duration = entity.getExecutionDuration();
      expect(duration).toBeDefined();
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThanOrEqual(after - before + 10);
    });

    it("should track execution end time when completing", () => {
      entity.setExecutionState("running");
      entity.setExecutionState("success");

      const duration = entity.getExecutionDuration();
      expect(duration).toBeDefined();
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it("should set progress to 100 on success", () => {
      entity.setExecutionState("running");
      entity.setExecutionState("success");

      expect(entity.getExecutionProgress()).toBe(100);
    });

    it("should reset progress to 0 when entering running state", () => {
      entity.setExecutionProgress(50);
      entity.setExecutionState("running");

      expect(entity.getExecutionProgress()).toBe(0);
    });

    it("should set and get execution progress", () => {
      entity.setExecutionProgress(75);
      expect(entity.getExecutionProgress()).toBe(75);
    });

    it("should clamp progress to 0-100 range", () => {
      entity.setExecutionProgress(-10);
      expect(entity.getExecutionProgress()).toBe(0);

      entity.setExecutionProgress(150);
      expect(entity.getExecutionProgress()).toBe(100);
    });

    it("should clear error message when changing to non-error state", () => {
      entity.setExecutionState("error");
      entity.setErrorMessage("Something went wrong");
      expect(entity.getErrorMessage()).toBe("Something went wrong");

      entity.setExecutionState("idle");
      expect(entity.getErrorMessage()).toBeUndefined();
    });

    it("should preserve error message when setting error state", () => {
      entity.setExecutionState("error");
      entity.setErrorMessage("Error occurred");

      expect(entity.getErrorMessage()).toBe("Error occurred");
    });
  });

  // ===========================================================================
  // Form Data Management
  // ===========================================================================

  describe("form data management", () => {
    const testSchema: FormSchema = {
      type: "object",
      properties: {
        name: { type: "text", label: "Name", default: "Default Name" },
        count: { type: "number", label: "Count", default: 0 },
        enabled: { type: "boolean", label: "Enabled" },
      },
    };

    it("should set and get form schema", () => {
      entity.setFormSchema(testSchema);
      expect(entity.getFormSchema()).toEqual(testSchema);
    });

    it("should update form data", () => {
      entity.updateFormData({ name: "Test", count: 5 });
      expect(entity.getFormData()).toEqual({ name: "Test", count: 5 });
    });

    it("should merge form data updates", () => {
      entity.updateFormData({ name: "Test" });
      entity.updateFormData({ count: 10 });

      expect(entity.getFormData()).toEqual({ name: "Test", count: 10 });
    });

    it("should filter form data to schema keys when schema is set", () => {
      entity.setFormSchema(testSchema);
      entity.updateFormData({ name: "Valid", invalidKey: "Should be filtered" });

      const formData = entity.getFormData();
      expect(formData).toHaveProperty("name", "Valid");
      expect(formData).not.toHaveProperty("invalidKey");
    });

    it("should reset form data to only valid keys when schema changes", () => {
      entity.updateFormData({ oldKey: "old", name: "Test" });
      entity.setFormSchema(testSchema);

      const formData = entity.getFormData();
      expect(formData).toHaveProperty("name", "Test");
      expect(formData).not.toHaveProperty("oldKey");
    });

    it("should apply default values from schema", () => {
      entity.setFormSchema(testSchema);

      const formData = entity.getFormData();
      expect(formData.name).toBe("Default Name");
      expect(formData.count).toBe(0);
    });

    it("should allow all keys when no schema is set", () => {
      entity.updateFormData({ any: "value", another: 123 });

      expect(entity.getFormData()).toEqual({ any: "value", another: 123 });
    });
  });

  // ===========================================================================
  // Theme Management
  // ===========================================================================

  describe("theme management", () => {
    it("should set and get theme", () => {
      const theme = {
        backgroundColor: "#ffffff",
        borderColor: "#000000",
        borderWidth: 2,
      };

      entity.setTheme(theme);
      expect(entity.getTheme()).toEqual(theme);
    });

    it("should return undefined when no theme is set", () => {
      expect(entity.getTheme()).toBeUndefined();
    });
  });

  // ===========================================================================
  // Label & Type Management
  // ===========================================================================

  describe("label management", () => {
    it("should set and get label", () => {
      entity.setLabel("New Label");
      expect(entity.getLabel()).toBe("New Label");
    });
  });

  // ===========================================================================
  // Selection & State Flags
  // ===========================================================================

  describe("state flags", () => {
    it("should toggle selected state", () => {
      expect(entity.isSelected()).toBe(false);
      entity.setSelected(true);
      expect(entity.isSelected()).toBe(true);
      entity.setSelected(false);
      expect(entity.isSelected()).toBe(false);
    });

    it("should toggle disabled state", () => {
      expect(entity.isDisabled()).toBe(false);
      entity.setDisabled(true);
      expect(entity.isDisabled()).toBe(true);
    });

    it("should toggle locked state", () => {
      expect(entity.isLocked()).toBe(false);
      entity.setLocked(true);
      expect(entity.isLocked()).toBe(true);
    });
  });

  // ===========================================================================
  // Metadata Management
  // ===========================================================================

  describe("metadata management", () => {
    it("should set and get metadata", () => {
      entity.setMetadata({ key: "value", nested: { a: 1 } });
      expect(entity.getMetadata()).toEqual({ key: "value", nested: { a: 1 } });
    });

    it("should update metadata (merge)", () => {
      entity.setMetadata({ existing: "value" });
      entity.updateMetadata({ new: "added" });

      expect(entity.getMetadata()).toEqual({ existing: "value", new: "added" });
    });
  });

  // ===========================================================================
  // Serialization
  // ===========================================================================

  describe("serialization", () => {
    it("should serialize to JSON", () => {
      entity.setLabel("Test Node");
      entity.setPosition({ x: 100, y: 200 });
      entity.setExecutionState("running");

      const json = entity.toJSON();

      expect(json).toHaveProperty("id");
      expect(json).toHaveProperty("type", "flow-node-entity");
      expect(json).toHaveProperty("data");
      expect((json.data as Record<string, unknown>).label).toBe("Test Node");
      expect((json.data as Record<string, unknown>).position).toEqual({ x: 100, y: 200 });
      expect((json.data as Record<string, unknown>).executionState).toBe("running");
    });

    it("should deserialize from JSON", () => {
      const originalEntity = new FlowNodeEntity({
        nodeType: "task",
        label: "Serialized Node",
        position: { x: 50, y: 75 },
        executionState: "success",
        inputPorts: [{ id: "in1", name: "Input", type: "input" }],
        outputPorts: [{ id: "out1", name: "Output", type: "output" }],
        config: { key: "value" },
        selected: true,
        metadata: { custom: "data" },
      });

      const json = originalEntity.toJSON();
      const restoredEntity = FlowNodeEntity.fromJSON(json);

      expect(restoredEntity.getNodeType()).toBe("task");
      expect(restoredEntity.getLabel()).toBe("Serialized Node");
      expect(restoredEntity.getPosition()).toEqual({ x: 50, y: 75 });
      expect(restoredEntity.getExecutionState()).toBe("success");
      expect(restoredEntity.getInputPorts()).toHaveLength(1);
      expect(restoredEntity.getOutputPorts()).toHaveLength(1);
      expect(restoredEntity.getFormData()).toEqual({ key: "value" });
      expect(restoredEntity.isSelected()).toBe(true);
      expect(restoredEntity.getMetadata()).toEqual({ custom: "data" });
    });

    it("should preserve execution timing in serialization", () => {
      entity.setExecutionState("running");
      entity.setExecutionProgress(50);

      const json = entity.toJSON();
      const restoredEntity = FlowNodeEntity.fromJSON(json);

      expect(restoredEntity.getExecutionProgress()).toBe(50);
    });

    it("should preserve error message in serialization", () => {
      entity.setExecutionState("error");
      entity.setErrorMessage("Test error");

      const json = entity.toJSON();
      const restoredEntity = FlowNodeEntity.fromJSON(json);

      expect(restoredEntity.getErrorMessage()).toBe("Test error");
    });
  });

  // ===========================================================================
  // Disposal
  // ===========================================================================

  describe("disposal", () => {
    it("should mark entity as disposed", () => {
      expect(entity.isDisposed).toBe(false);
      entity.dispose();
      expect(entity.isDisposed).toBe(true);
    });

    it("should ignore state changes after disposal", () => {
      entity.setLabel("Before");
      entity.dispose();
      entity.setLabel("After");

      expect(entity.getLabel()).toBe("Before");
    });

    it("should ignore port changes after disposal", () => {
      entity.setPorts([{ id: "p1", name: "Port", type: "input" }]);
      entity.dispose();
      entity.setPorts([{ id: "p2", name: "New Port", type: "output" }]);

      expect(entity.getInputPorts()).toHaveLength(1);
      expect(entity.getInputPorts()[0].id).toBe("p1");
    });

    it("should be safe to call dispose multiple times", () => {
      expect(() => {
        entity.dispose();
        entity.dispose();
        entity.dispose();
      }).not.toThrow();
    });
  });
});
