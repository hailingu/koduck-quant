/**
 * @file ExecutionStateManager unit tests
 * @description Tests for ExecutionStateManager core functionality including
 * state management, subscriptions, progress tracking, and engine integration.
 *
 * @see docs/design/flow-entity-step-plan-en.md Phase 3 - Task 3.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ExecutionStateManager,
  createExecutionStateManager,
  type ExecutionStateListener,
  type ProgressListener,
  type EntityStartEvent,
  type EntityFinishEvent,
} from "../../../../src/components/flow-entity/execution/execution-state-manager";
import type { ExecutionState } from "../../../../src/components/flow-entity/types";

describe("ExecutionStateManager", () => {
  let manager: ExecutionStateManager;

  beforeEach(() => {
    manager = new ExecutionStateManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  // ===========================================================================
  // Constructor & Configuration
  // ===========================================================================

  describe("constructor", () => {
    it("should create manager with default configuration", () => {
      expect(manager).toBeDefined();
      expect(manager.disposed).toBe(false);
    });

    it("should create manager with custom configuration", () => {
      const customManager = new ExecutionStateManager({
        enableLogging: true,
        defaultState: "pending",
        trackTiming: false,
      });

      expect(customManager.getState("nonexistent")).toBe("pending");
      customManager.dispose();
    });

    it("should use factory function to create manager", () => {
      const factoryManager = createExecutionStateManager({ enableLogging: false });
      expect(factoryManager).toBeInstanceOf(ExecutionStateManager);
      factoryManager.dispose();
    });
  });

  // ===========================================================================
  // State Management
  // ===========================================================================

  describe("getState", () => {
    it("should return default state for unknown entity", () => {
      expect(manager.getState("unknown-entity")).toBe("idle");
    });

    it("should return set state for known entity", () => {
      manager.setState("entity-1", "running");
      expect(manager.getState("entity-1")).toBe("running");
    });
  });

  describe("setState", () => {
    it("should set state for an entity", () => {
      manager.setState("entity-1", "running");
      expect(manager.getState("entity-1")).toBe("running");
    });

    it("should update state when changed", () => {
      manager.setState("entity-1", "running");
      manager.setState("entity-1", "success");
      expect(manager.getState("entity-1")).toBe("success");
    });

    it("should not notify listeners when state unchanged", () => {
      const listener = vi.fn();
      manager.subscribe("entity-1", listener);
      manager.setState("entity-1", "running");
      manager.setState("entity-1", "running"); // Same state
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should accept optional error message", () => {
      manager.setState("entity-1", "error", { errorMessage: "Test error" });
      expect(manager.getError("entity-1")).toBe("Test error");
    });

    it("should accept optional duration", () => {
      manager.setState("entity-1", "success", { durationMs: 1500 });
      expect(manager.getDuration("entity-1")).toBe(1500);
    });

    it("should clear error message when state is not error", () => {
      manager.setState("entity-1", "error", { errorMessage: "Test error" });
      manager.setState("entity-1", "success");
      expect(manager.getError("entity-1")).toBeUndefined();
    });

    it("should clear progress when entering terminal state", () => {
      manager.setState("entity-1", "running");
      manager.setProgress("entity-1", 50);
      manager.setState("entity-1", "success");
      expect(manager.getProgress("entity-1")).toBeUndefined();
    });

    it("should throw when manager is disposed", () => {
      manager.dispose();
      expect(() => manager.setState("entity-1", "running")).toThrow(
        "ExecutionStateManager has been disposed"
      );
    });
  });

  describe("setStates", () => {
    it("should set multiple entity states at once", () => {
      const updates = new Map<string, ExecutionState>([
        ["entity-1", "running"],
        ["entity-2", "pending"],
        ["entity-3", "success"],
      ]);

      manager.setStates(updates);

      expect(manager.getState("entity-1")).toBe("running");
      expect(manager.getState("entity-2")).toBe("pending");
      expect(manager.getState("entity-3")).toBe("success");
    });
  });

  describe("resetState", () => {
    it("should reset entity to default state", () => {
      manager.setState("entity-1", "running");
      manager.setProgress("entity-1", 75);
      manager.resetState("entity-1");

      expect(manager.getState("entity-1")).toBe("idle");
      expect(manager.getProgress("entity-1")).toBeUndefined();
    });

    it("should clear error message on reset", () => {
      manager.setState("entity-1", "error", { errorMessage: "Test error" });
      manager.resetState("entity-1");
      expect(manager.getError("entity-1")).toBeUndefined();
    });
  });

  describe("resetAll", () => {
    it("should reset all entities to default state", () => {
      manager.setState("entity-1", "running");
      manager.setState("entity-2", "success");
      manager.setState("entity-3", "error");

      manager.resetAll();

      expect(manager.getState("entity-1")).toBe("idle");
      expect(manager.getState("entity-2")).toBe("idle");
      expect(manager.getState("entity-3")).toBe("idle");
    });
  });

  // ===========================================================================
  // Progress Management
  // ===========================================================================

  describe("getProgress", () => {
    it("should return undefined for entity without progress", () => {
      expect(manager.getProgress("entity-1")).toBeUndefined();
    });

    it("should return set progress for entity", () => {
      manager.setProgress("entity-1", 50);
      expect(manager.getProgress("entity-1")).toBe(50);
    });
  });

  describe("setProgress", () => {
    it("should set progress for entity", () => {
      manager.setProgress("entity-1", 75);
      expect(manager.getProgress("entity-1")).toBe(75);
    });

    it("should clamp progress to 0-100 range", () => {
      manager.setProgress("entity-1", -10);
      expect(manager.getProgress("entity-1")).toBe(0);

      manager.setProgress("entity-1", 150);
      expect(manager.getProgress("entity-1")).toBe(100);
    });

    it("should not notify when progress change is insignificant", () => {
      const listener = vi.fn();
      manager.subscribeProgress("entity-1", listener);

      manager.setProgress("entity-1", 50);
      manager.setProgress("entity-1", 50.05); // Within 0.1% threshold

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Entity Info Getters
  // ===========================================================================

  describe("getEntityInfo", () => {
    it("should return complete entity info", () => {
      manager.setState("entity-1", "running");
      manager.setProgress("entity-1", 50);

      const info = manager.getEntityInfo("entity-1");

      expect(info.state).toBe("running");
      expect(info.progress).toBe(50);
      expect(info.updatedAt).toBeGreaterThan(0);
    });

    it("should include error message for error state", () => {
      manager.setState("entity-1", "error", { errorMessage: "Test error" });
      const info = manager.getEntityInfo("entity-1");
      expect(info.errorMessage).toBe("Test error");
    });

    it("should include duration for completed state", () => {
      manager.setState("entity-1", "success", { durationMs: 2000 });
      const info = manager.getEntityInfo("entity-1");
      expect(info.durationMs).toBe(2000);
    });
  });

  describe("isExecuting", () => {
    it("should return true for pending state", () => {
      manager.setState("entity-1", "pending");
      expect(manager.isExecuting("entity-1")).toBe(true);
    });

    it("should return true for running state", () => {
      manager.setState("entity-1", "running");
      expect(manager.isExecuting("entity-1")).toBe(true);
    });

    it("should return false for idle state", () => {
      expect(manager.isExecuting("entity-1")).toBe(false);
    });

    it("should return false for terminal states", () => {
      manager.setState("entity-1", "success");
      expect(manager.isExecuting("entity-1")).toBe(false);

      manager.setState("entity-2", "error");
      expect(manager.isExecuting("entity-2")).toBe(false);
    });
  });

  describe("isCompleted", () => {
    it("should return true for success state", () => {
      manager.setState("entity-1", "success");
      expect(manager.isCompleted("entity-1")).toBe(true);
    });

    it("should return true for error state", () => {
      manager.setState("entity-1", "error");
      expect(manager.isCompleted("entity-1")).toBe(true);
    });

    it("should return true for skipped state", () => {
      manager.setState("entity-1", "skipped");
      expect(manager.isCompleted("entity-1")).toBe(true);
    });

    it("should return true for cancelled state", () => {
      manager.setState("entity-1", "cancelled");
      expect(manager.isCompleted("entity-1")).toBe(true);
    });

    it("should return false for non-terminal states", () => {
      expect(manager.isCompleted("entity-1")).toBe(false);
      manager.setState("entity-1", "running");
      expect(manager.isCompleted("entity-1")).toBe(false);
    });
  });

  // ===========================================================================
  // Subscription Management
  // ===========================================================================

  describe("subscribe", () => {
    it("should notify listener when state changes", () => {
      const listener = vi.fn();
      manager.subscribe("entity-1", listener);

      manager.setState("entity-1", "running");

      expect(listener).toHaveBeenCalledWith("running", "idle");
    });

    it("should notify listener with previous and new state", () => {
      const listener = vi.fn();
      manager.subscribe("entity-1", listener);

      manager.setState("entity-1", "running");
      manager.setState("entity-1", "success");

      expect(listener).toHaveBeenLastCalledWith("success", "running");
    });

    it("should support multiple listeners for same entity", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      manager.subscribe("entity-1", listener1);
      manager.subscribe("entity-1", listener2);

      manager.setState("entity-1", "running");

      expect(listener1).toHaveBeenCalledWith("running", "idle");
      expect(listener2).toHaveBeenCalledWith("running", "idle");
    });

    it("should return unsubscribe function", () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribe("entity-1", listener);

      manager.setState("entity-1", "running");
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      manager.setState("entity-1", "success");
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });

    it("should handle listener errors gracefully", () => {
      const errorListener = vi.fn(() => {
        throw new Error("Listener error");
      });
      const goodListener = vi.fn();

      manager.subscribe("entity-1", errorListener);
      manager.subscribe("entity-1", goodListener);

      // Should not throw and should call good listener
      expect(() => manager.setState("entity-1", "running")).not.toThrow();
      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe("subscribeProgress", () => {
    it("should notify listener when progress changes", () => {
      const listener = vi.fn();
      manager.subscribeProgress("entity-1", listener);

      manager.setProgress("entity-1", 50);

      expect(listener).toHaveBeenCalledWith(50, "entity-1");
    });

    it("should return unsubscribe function", () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribeProgress("entity-1", listener);

      manager.setProgress("entity-1", 25);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      manager.setProgress("entity-1", 75);
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe("subscribeAll", () => {
    it("should notify listener for all entity state changes", () => {
      const listener = vi.fn();
      manager.subscribeAll(listener);

      manager.setState("entity-1", "running");
      manager.setState("entity-2", "pending");

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith("entity-1", "running", "idle");
      expect(listener).toHaveBeenCalledWith("entity-2", "pending", "idle");
    });

    it("should return unsubscribe function", () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribeAll(listener);

      manager.setState("entity-1", "running");
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      manager.setState("entity-2", "pending");
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe("getSubscriberCount", () => {
    it("should return 0 for entity with no subscribers", () => {
      expect(manager.getSubscriberCount("entity-1")).toBe(0);
    });

    it("should return correct count for state and progress subscribers", () => {
      manager.subscribe("entity-1", vi.fn());
      manager.subscribe("entity-1", vi.fn());
      manager.subscribeProgress("entity-1", vi.fn());

      expect(manager.getSubscriberCount("entity-1")).toBe(3);
    });
  });

  // ===========================================================================
  // Engine Integration
  // ===========================================================================

  describe("handleEntityStart", () => {
    it("should set state to running on entity start", () => {
      const event: EntityStartEvent = { entityId: "entity-1", type: "node" };
      manager.handleEntityStart(event);
      expect(manager.getState("entity-1")).toBe("running");
    });
  });

  describe("handleEntityFinish", () => {
    it("should set state to success on successful finish", () => {
      const event: EntityFinishEvent = {
        entityId: "entity-1",
        type: "node",
        status: "success",
        durationMs: 1000,
      };
      manager.handleEntityFinish(event);
      expect(manager.getState("entity-1")).toBe("success");
    });

    it("should set state to error with message on error finish", () => {
      const event: EntityFinishEvent = {
        entityId: "entity-1",
        type: "node",
        status: "error",
        durationMs: 500,
        error: new Error("Execution failed"),
      };
      manager.handleEntityFinish(event);
      expect(manager.getState("entity-1")).toBe("error");
      expect(manager.getError("entity-1")).toBe("Execution failed");
    });

    it("should set state to skipped", () => {
      const event: EntityFinishEvent = {
        entityId: "entity-1",
        type: "node",
        status: "skipped",
        durationMs: 0,
      };
      manager.handleEntityFinish(event);
      expect(manager.getState("entity-1")).toBe("skipped");
    });

    it("should set state to cancelled", () => {
      const event: EntityFinishEvent = {
        entityId: "entity-1",
        type: "node",
        status: "cancelled",
        durationMs: 200,
      };
      manager.handleEntityFinish(event);
      expect(manager.getState("entity-1")).toBe("cancelled");
    });

    it("should store duration from event", () => {
      const event: EntityFinishEvent = {
        entityId: "entity-1",
        type: "node",
        status: "success",
        durationMs: 1500,
      };
      manager.handleEntityFinish(event);
      expect(manager.getDuration("entity-1")).toBe(1500);
    });
  });

  describe("createEngineHandlers", () => {
    it("should return handlers object with start and finish handlers", () => {
      const handlers = manager.createEngineHandlers();

      expect(handlers.onEntityStart).toBeTypeOf("function");
      expect(handlers.onEntityFinish).toBeTypeOf("function");
    });

    it("should create handlers that update state correctly", () => {
      const handlers = manager.createEngineHandlers();

      handlers.onEntityStart({ entityId: "entity-1", type: "node" });
      expect(manager.getState("entity-1")).toBe("running");

      handlers.onEntityFinish({
        entityId: "entity-1",
        type: "node",
        status: "success",
        durationMs: 100,
      });
      expect(manager.getState("entity-1")).toBe("success");
    });
  });

  describe("connectToEngine", () => {
    it("should connect to engine events and update state", () => {
      const startHandler = vi.fn();
      const finishHandler = vi.fn();

      const mockEngine = {
        onEntityStart: {
          on: vi.fn((handler) => {
            startHandler.mockImplementation(handler);
            return vi.fn();
          }),
        },
        onEntityFinish: {
          on: vi.fn((handler) => {
            finishHandler.mockImplementation(handler);
            return vi.fn();
          }),
        },
      };

      const disconnect = manager.connectToEngine(mockEngine);

      // Simulate engine events
      startHandler({ entityId: "entity-1", type: "node" });
      expect(manager.getState("entity-1")).toBe("running");

      finishHandler({
        entityId: "entity-1",
        type: "node",
        status: "success",
        durationMs: 500,
      });
      expect(manager.getState("entity-1")).toBe("success");

      disconnect();
    });

    it("should return disconnect function", () => {
      const disposeStart = vi.fn();
      const disposeFinish = vi.fn();

      const mockEngine = {
        onEntityStart: { on: vi.fn(() => disposeStart) },
        onEntityFinish: { on: vi.fn(() => disposeFinish) },
      };

      const disconnect = manager.connectToEngine(mockEngine);
      disconnect();

      expect(disposeStart).toHaveBeenCalled();
      expect(disposeFinish).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Snapshot & Serialization
  // ===========================================================================

  describe("createSnapshot", () => {
    it("should create snapshot with all entity info", () => {
      manager.setState("entity-1", "running");
      manager.setProgress("entity-1", 50);
      manager.setState("entity-2", "success", { durationMs: 1000 });

      const snapshot = manager.createSnapshot();

      expect(snapshot.entities.size).toBe(2);
      expect(snapshot.timestamp).toBeGreaterThan(0);

      const entity1 = snapshot.entities.get("entity-1");
      expect(entity1?.state).toBe("running");
      expect(entity1?.progress).toBe(50);

      const entity2 = snapshot.entities.get("entity-2");
      expect(entity2?.state).toBe("success");
      expect(entity2?.durationMs).toBe(1000);
    });
  });

  describe("restoreFromSnapshot", () => {
    it("should restore states from snapshot", () => {
      manager.setState("entity-1", "running");
      manager.setProgress("entity-1", 50);

      const snapshot = manager.createSnapshot();

      // Reset and restore
      manager.resetAll();
      expect(manager.getState("entity-1")).toBe("idle");

      manager.restoreFromSnapshot(snapshot);
      expect(manager.getState("entity-1")).toBe("running");
      expect(manager.getProgress("entity-1")).toBe(50);
    });
  });

  describe("getStateCounts", () => {
    it("should return count of entities in each state", () => {
      manager.setState("entity-1", "running");
      manager.setState("entity-2", "running");
      manager.setState("entity-3", "success");
      manager.setState("entity-4", "error");

      const counts = manager.getStateCounts();

      expect(counts.running).toBe(2);
      expect(counts.success).toBe(1);
      expect(counts.error).toBe(1);
      expect(counts.idle).toBe(0);
    });
  });

  describe("getEntitiesByState", () => {
    it("should return entity IDs with specific state", () => {
      manager.setState("entity-1", "running");
      manager.setState("entity-2", "running");
      manager.setState("entity-3", "success");

      const runningEntities = manager.getEntitiesByState("running");

      expect(runningEntities).toHaveLength(2);
      expect(runningEntities).toContain("entity-1");
      expect(runningEntities).toContain("entity-2");
    });

    it("should return empty array for state with no entities", () => {
      const pendingEntities = manager.getEntitiesByState("pending");
      expect(pendingEntities).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Timing Tracking
  // ===========================================================================

  describe("timing tracking", () => {
    it("should automatically calculate duration when finishing", async () => {
      manager.setState("entity-1", "running");

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      manager.setState("entity-1", "success");

      const duration = manager.getDuration("entity-1");
      expect(duration).toBeGreaterThanOrEqual(10);
    });

    it("should not track timing when disabled", async () => {
      const noTimingManager = new ExecutionStateManager({ trackTiming: false });

      noTimingManager.setState("entity-1", "running");
      await new Promise((resolve) => setTimeout(resolve, 10));
      noTimingManager.setState("entity-1", "success");

      // Duration should be undefined since we didn't pass it and tracking is off
      expect(noTimingManager.getDuration("entity-1")).toBeUndefined();

      noTimingManager.dispose();
    });
  });

  // ===========================================================================
  // Dispose
  // ===========================================================================

  describe("dispose", () => {
    it("should mark manager as disposed", () => {
      expect(manager.disposed).toBe(false);
      manager.dispose();
      expect(manager.disposed).toBe(true);
    });

    it("should clear all internal state on dispose", () => {
      manager.setState("entity-1", "running");
      manager.setProgress("entity-1", 50);
      manager.subscribe("entity-1", vi.fn());

      manager.dispose();

      // Attempting operations should throw
      expect(() => manager.setState("entity-1", "success")).toThrow();
    });

    it("should be idempotent", () => {
      manager.dispose();
      manager.dispose(); // Should not throw
      expect(manager.disposed).toBe(true);
    });
  });
});
