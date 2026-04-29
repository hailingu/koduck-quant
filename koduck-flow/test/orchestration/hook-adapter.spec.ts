import { describe, expect, it, beforeEach, vi } from "vitest";
import { HookAdapter } from "../../src/common/flow/orchestration/hook-adapter";
import { FlowHooks } from "../../src/common/flow/hooks";

 

describe("HookAdapter", () => {
  let flowHooks: FlowHooks;
  let adapter: HookAdapter;

  beforeEach(() => {
    flowHooks = new FlowHooks();
    adapter = new HookAdapter(flowHooks);
  });

  describe("Constructor and Initialization", () => {
    it("should create HookAdapter with FlowHooks instance", () => {
      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(HookAdapter);
    });

    it("should initialize with default hook state", () => {
      expect(adapter.enableHooks).toBe(true);
      expect(adapter.hookDepthLimit).toBe(5);
    });
  });

  describe("Control Properties (enableHooks)", () => {
    it("should get enableHooks status", () => {
      expect(adapter.enableHooks).toBe(true);
    });

    it("should set enableHooks to false", () => {
      adapter.enableHooks = false;
      expect(adapter.enableHooks).toBe(false);
      expect(flowHooks.enableHooks).toBe(false);
    });

    it("should set enableHooks to true", () => {
      adapter.enableHooks = false;
      adapter.enableHooks = true;
      expect(adapter.enableHooks).toBe(true);
    });

    it("should proxy enableHooks changes to underlying FlowHooks", () => {
      adapter.enableHooks = false;
      expect(flowHooks.enableHooks).toBe(false);

      adapter.enableHooks = true;
      expect(flowHooks.enableHooks).toBe(true);
    });
  });

  describe("Control Properties (hookDepthLimit)", () => {
    it("should get hookDepthLimit", () => {
      expect(adapter.hookDepthLimit).toBe(5);
    });

    it("should set hookDepthLimit", () => {
      adapter.hookDepthLimit = 10;
      expect(adapter.hookDepthLimit).toBe(10);
      expect(flowHooks.hookDepthLimit).toBe(10);
    });

    it("should proxy hookDepthLimit changes to underlying FlowHooks", () => {
      adapter.hookDepthLimit = 15;
      expect(flowHooks.hookDepthLimit).toBe(15);
    });
  });

  describe("onEntityAdded Hook Property", () => {
    it("should get onEntityAdded when not set", () => {
      expect(adapter.onEntityAdded).toBeUndefined();
    });

    it("should set onEntityAdded handler", () => {
      const handler = vi.fn((entity) => true);
      adapter.onEntityAdded = handler as any;
      expect(adapter.onEntityAdded).toBe(handler);
    });

    it("should allow unsetting onEntityAdded", () => {
      const handler = vi.fn((entity) => true);
      adapter.onEntityAdded = handler as any;
      adapter.onEntityAdded = undefined;
      expect(adapter.onEntityAdded).toBeUndefined();
    });

    it("should proxy onEntityAdded to FlowHooks", () => {
      const handler = vi.fn((entity) => true);
      adapter.onEntityAdded = handler as any;
      expect(flowHooks.onEntityAdded).toBe(handler);
    });
  });

  describe("onEntityRemoved Hook Property", () => {
    it("should get onEntityRemoved when not set", () => {
      expect(adapter.onEntityRemoved).toBeUndefined();
    });

    it("should set onEntityRemoved handler", () => {
      const handler = vi.fn((id: string) => true);
      adapter.onEntityRemoved = handler;
      expect(adapter.onEntityRemoved).toBe(handler);
    });

    it("should proxy onEntityRemoved to FlowHooks", () => {
      const handler = vi.fn((id: string) => true);
      adapter.onEntityRemoved = handler;
      expect(flowHooks.onEntityRemoved).toBe(handler);
    });
  });

  describe("onFlowLoaded Hook Property", () => {
    it("should get onFlowLoaded when not set", () => {
      expect(adapter.onFlowLoaded).toBeUndefined();
    });

    it("should set onFlowLoaded handler", () => {
      const handler = vi.fn((payload: Record<string, unknown>) => true);
      adapter.onFlowLoaded = handler;
      expect(adapter.onFlowLoaded).toBe(handler);
    });

    it("should proxy onFlowLoaded to FlowHooks", () => {
      const handler = vi.fn((payload: Record<string, unknown>) => true);
      adapter.onFlowLoaded = handler;
      expect(flowHooks.onFlowLoaded).toBe(handler);
    });
  });

  describe("onFlowSaved Hook Property", () => {
    it("should get onFlowSaved when not set", () => {
      expect(adapter.onFlowSaved).toBeUndefined();
    });

    it("should set onFlowSaved handler", () => {
      const handler = vi.fn(() => true);
      adapter.onFlowSaved = handler;
      expect(adapter.onFlowSaved).toBe(handler);
    });

    it("should proxy onFlowSaved to FlowHooks", () => {
      const handler = vi.fn(() => true);
      adapter.onFlowSaved = handler;
      expect(flowHooks.onFlowSaved).toBe(handler);
    });
  });

  describe("runEntityAdded Sync Hook Execution", () => {
    it("should return true when no handler is set", () => {
      const entity = { id: "test-1" };
      const result = adapter.runEntityAdded(entity as any);
      expect(result).toBe(true);
    });

    it("should call handler when runEntityAdded is invoked", () => {
      const entity = { id: "test-1" };
      const handler = vi.fn(() => true);
      adapter.onEntityAdded = handler as any;

      adapter.runEntityAdded(entity as any);
      expect(handler).toHaveBeenCalledWith(entity);
    });

    it("should return handler result", () => {
      const entity = { id: "test-1" };
      const handler = vi.fn(() => false);
      adapter.onEntityAdded = handler as any;

      const result = adapter.runEntityAdded(entity as any);
      expect(result).toBe(false);
    });

    it("should return true when hooks are disabled", () => {
      const entity = { id: "test-1" };
      const handler = vi.fn(() => false);
      adapter.onEntityAdded = handler as any;
      adapter.enableHooks = false;

      const result = adapter.runEntityAdded(entity as any);
      expect(result).toBe(true);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("runEntityRemoved Sync Hook Execution", () => {
    it("should return true when no handler is set", () => {
      const result = adapter.runEntityRemoved("test-id");
      expect(result).toBe(true);
    });

    it("should call handler when runEntityRemoved is invoked", () => {
      const handler = vi.fn(() => true);
      adapter.onEntityRemoved = handler;

      adapter.runEntityRemoved("test-id");
      expect(handler).toHaveBeenCalledWith("test-id");
    });

    it("should return false when handler returns false", () => {
      const handler = vi.fn(() => false);
      adapter.onEntityRemoved = handler;

      const result = adapter.runEntityRemoved("test-id");
      expect(result).toBe(false);
    });

    it("should return true when hooks are disabled", () => {
      const handler = vi.fn(() => false);
      adapter.onEntityRemoved = handler;
      adapter.enableHooks = false;

      const result = adapter.runEntityRemoved("test-id");
      expect(result).toBe(true);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("runFlowLoaded Sync Hook Execution", () => {
    it("should return true when no handler is set", () => {
      const payload = { data: "test" };
      const result = adapter.runFlowLoaded(payload);
      expect(result).toBe(true);
    });

    it("should call handler with flow state", () => {
      const handler = vi.fn((payload: Record<string, unknown>) => true);
      adapter.onFlowLoaded = handler;
      const payload = { data: "test" };

      adapter.runFlowLoaded(payload);
      expect(handler).toHaveBeenCalledWith(payload);
    });

    it("should return handler result", () => {
      const handler = vi.fn(() => false);
      adapter.onFlowLoaded = handler;
      const payload = { data: "test" };

      const result = adapter.runFlowLoaded(payload);
      expect(result).toBe(false);
    });

    it("should return true when hooks are disabled", () => {
      const handler = vi.fn(() => false);
      adapter.onFlowLoaded = handler;
      adapter.enableHooks = false;
      const payload = { data: "test" };

      const result = adapter.runFlowLoaded(payload);
      expect(result).toBe(true);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("runFlowSaved Sync Hook Execution", () => {
    it("should return true when no handler is set", () => {
      const result = adapter.runFlowSaved();
      expect(result).toBe(true);
    });

    it("should call handler when runFlowSaved is invoked", () => {
      const handler = vi.fn(() => true);
      adapter.onFlowSaved = handler;

      adapter.runFlowSaved();
      expect(handler).toHaveBeenCalled();
    });

    it("should return handler result", () => {
      const handler = vi.fn(() => false);
      adapter.onFlowSaved = handler;

      const result = adapter.runFlowSaved();
      expect(result).toBe(false);
    });

    it("should return true when hooks are disabled", () => {
      const handler = vi.fn(() => false);
      adapter.onFlowSaved = handler;
      adapter.enableHooks = false;

      const result = adapter.runFlowSaved();
      expect(result).toBe(true);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("runEntityAddedAsync Async Hook Execution", () => {
    it("should return true when no handler is set", async () => {
      const entity = { id: "test-1" };
      const result = await adapter.runEntityAddedAsync(entity as any);
      expect(result).toBe(true);
    });

    it("should return true when hooks are disabled", async () => {
      const entity = { id: "test-1" };
      const handler = vi.fn(async () => false);
      flowHooks.updateHandlers(
        {
          onEntityAdded: undefined,
          onEntityRemoved: undefined,
          onFlowLoaded: undefined,
          onFlowSaved: undefined,
        },
        {
          onEntityAddedAsync: handler as any,
          onEntityRemovedAsync: undefined,
          onFlowLoadedAsync: undefined,
          onFlowSavedAsync: undefined,
        }
      );
      adapter.enableHooks = false;

      const result = await adapter.runEntityAddedAsync(entity as any);
      expect(result).toBe(true);
      expect(handler).not.toHaveBeenCalled();
    });

    it("should handle async handler errors gracefully", async () => {
      const entity = { id: "test-1" };
      const error = new Error("Test error");
      const handler = vi.fn(async () => {
        throw error;
      });
      flowHooks.updateHandlers(
        {
          onEntityAdded: undefined,
          onEntityRemoved: undefined,
          onFlowLoaded: undefined,
          onFlowSaved: undefined,
        },
        {
          onEntityAddedAsync: handler as any,
          onEntityRemovedAsync: undefined,
          onFlowLoadedAsync: undefined,
          onFlowSavedAsync: undefined,
        }
      );

      const result = await adapter.runEntityAddedAsync(entity as any);
      expect(result).toBe(false);
    });
  });

  describe("runEntityRemovedAsync Async Hook Execution", () => {
    it("should return true when no handler is set", async () => {
      const result = await adapter.runEntityRemovedAsync("test-id");
      expect(result).toBe(true);
    });

    it("should return true when hooks are disabled", async () => {
      const handler = vi.fn(async () => false);
      flowHooks.updateHandlers(
        {
          onEntityAdded: undefined,
          onEntityRemoved: undefined,
          onFlowLoaded: undefined,
          onFlowSaved: undefined,
        },
        {
          onEntityAddedAsync: undefined,
          onEntityRemovedAsync: handler as any,
          onFlowLoadedAsync: undefined,
          onFlowSavedAsync: undefined,
        }
      );
      adapter.enableHooks = false;

      const result = await adapter.runEntityRemovedAsync("test-id");
      expect(result).toBe(true);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("runFlowLoadedAsync Async Hook Execution", () => {
    it("should return true when no handler is set", async () => {
      const payload = { data: "test" };
      const result = await adapter.runFlowLoadedAsync(payload);
      expect(result).toBe(true);
    });

    it("should return true when hooks are disabled", async () => {
      const handler = vi.fn(async () => false);
      flowHooks.updateHandlers(
        {
          onEntityAdded: undefined,
          onEntityRemoved: undefined,
          onFlowLoaded: undefined,
          onFlowSaved: undefined,
        },
        {
          onEntityAddedAsync: undefined,
          onEntityRemovedAsync: undefined,
          onFlowLoadedAsync: handler as any,
          onFlowSavedAsync: undefined,
        }
      );
      adapter.enableHooks = false;
      const payload = { data: "test" };

      const result = await adapter.runFlowLoadedAsync(payload);
      expect(result).toBe(true);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("runFlowSavedAsync Async Hook Execution", () => {
    it("should return true when no handler is set", async () => {
      const result = await adapter.runFlowSavedAsync();
      expect(result).toBe(true);
    });

    it("should return true when hooks are disabled", async () => {
      const handler = vi.fn(async () => false);
      flowHooks.updateHandlers(
        {
          onEntityAdded: undefined,
          onEntityRemoved: undefined,
          onFlowLoaded: undefined,
          onFlowSaved: undefined,
        },
        {
          onEntityAddedAsync: undefined,
          onEntityRemovedAsync: undefined,
          onFlowLoadedAsync: undefined,
          onFlowSavedAsync: handler as any,
        }
      );
      adapter.enableHooks = false;

      const result = await adapter.runFlowSavedAsync();
      expect(result).toBe(true);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("Hook Enable/Disable State Management", () => {
    it("should respect enable/disable state in sync hooks", () => {
      const handler = vi.fn(() => true);
      adapter.onEntityAdded = handler as any;
      const entity = { id: "test-1" };

      // Enabled
      adapter.runEntityAdded(entity as any);
      expect(handler).toHaveBeenCalledTimes(1);

      // Disabled
      adapter.enableHooks = false;
      adapter.runEntityAdded(entity as any);
      expect(handler).toHaveBeenCalledTimes(1); // Not called again

      // Re-enabled
      adapter.enableHooks = true;
      adapter.runEntityAdded(entity as any);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("should respect hookDepthLimit setting", () => {
      adapter.hookDepthLimit = 2;
      expect(adapter.hookDepthLimit).toBe(2);
    });

    it("should support changing hookDepthLimit during runtime", () => {
      expect(adapter.hookDepthLimit).toBe(5);
      adapter.hookDepthLimit = 20;
      expect(adapter.hookDepthLimit).toBe(20);
      adapter.hookDepthLimit = 3;
      expect(adapter.hookDepthLimit).toBe(3);
    });
  });

  describe("Multiple Hook Handler Replacements", () => {
    it("should allow replacing sync hook handlers", () => {
      const handler1 = vi.fn(() => true);
      const handler2 = vi.fn(() => true);
      const entity = { id: "test-1" };

      adapter.onEntityAdded = handler1 as any;
      adapter.runEntityAdded(entity as any);
      expect(handler1).toHaveBeenCalledTimes(1);

      adapter.onEntityAdded = handler2 as any;
      adapter.runEntityAdded(entity as any);
      expect(handler1).toHaveBeenCalledTimes(1); // Still 1, not called again
      expect(handler2).toHaveBeenCalledTimes(1); // Called once
    });

    it("should allow replacing onEntityRemoved handler", () => {
      const handler1 = vi.fn(() => true);
      const handler2 = vi.fn(() => false);

      adapter.onEntityRemoved = handler1;
      let result = adapter.runEntityRemoved("id-1");
      expect(result).toBe(true);

      adapter.onEntityRemoved = handler2;
      result = adapter.runEntityRemoved("id-1");
      expect(result).toBe(false);
    });
  });

  describe("Hook Execution Sequence and Order", () => {
    it("should execute multiple different hooks in correct order", () => {
      const callOrder: string[] = [];
      adapter.onEntityAdded = (() => {
        callOrder.push("added");
        return true;
      }) as any;
      adapter.onFlowSaved = (() => {
        callOrder.push("saved");
        return true;
      }) as any;

      const entity = { id: "test-1" };

      adapter.runEntityAdded(entity as any);
      adapter.runFlowSaved();

      expect(callOrder).toEqual(["added", "saved"]);
    });

    it("should maintain handler behavior across multiple invocations", () => {
      const handler = vi.fn(() => true);
      adapter.onEntityAdded = handler as any;
      const entity = { id: "test-1" };

      adapter.runEntityAdded(entity as any);
      adapter.runEntityAdded(entity as any);
      adapter.runEntityAdded(entity as any);

      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler).toHaveBeenCalledWith(entity);
    });
  });
});
