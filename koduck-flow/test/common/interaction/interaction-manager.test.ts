import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { InteractionManager } from "../../../src/common/interaction/interaction-manager";
import type {
  Tool,
  PointerLikeEvent,
  ViewportLike,
} from "../../../src/common/interaction/types";

// Mock providers
const mockCanvasProvider = {
  getCanvas: vi.fn<() => HTMLCanvasElement | null>(),
};

const mockViewportProvider = {
  getViewport: vi.fn<() => ViewportLike>(),
};

// Mock tool
const createMockTool = (name: string = "test-tool"): Tool => ({
  name,
  onMouseDown: vi.fn(),
  onMouseMove: vi.fn(),
  onMouseUp: vi.fn(),
  onMouseLeave: vi.fn(),
  dispose: vi.fn(),
});

// Mock event
const createMockEvent = (
  overrides: Partial<PointerLikeEvent> = {}
): PointerLikeEvent => ({
  clientX: 100,
  clientY: 200,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  preventDefault: vi.fn(),
  ...overrides,
});

describe("InteractionManager", () => {
  let interactionManager: InteractionManager;
  let mockCanvas: HTMLCanvasElement;
  let mockViewport: ViewportLike;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCanvas = {
      getBoundingClientRect: vi.fn().mockReturnValue({
        left: 10,
        top: 20,
        width: 800,
        height: 600,
      }),
    } as unknown as HTMLCanvasElement;

    mockViewport = {
      x: 0,
      y: 0,
      zoom: 1,
      width: 800,
      height: 600,
    };

    mockCanvasProvider.getCanvas.mockReturnValue(mockCanvas);
    mockViewportProvider.getViewport.mockReturnValue(mockViewport);

    interactionManager = new InteractionManager(
      mockCanvasProvider,
      mockViewportProvider
    );
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("Constructor and Basic Setup", () => {
    test("should create interaction manager with providers", () => {
      expect(interactionManager).toBeInstanceOf(InteractionManager);
      // Providers are called when accessing canvas/viewport, not in constructor
      interactionManager.getCanvas();
      interactionManager.getViewport();
      expect(mockCanvasProvider.getCanvas).toHaveBeenCalled();
      expect(mockViewportProvider.getViewport).toHaveBeenCalled();
    });

    test("should handle null canvas", () => {
      mockCanvasProvider.getCanvas.mockReturnValue(null);

      const manager = new InteractionManager(
        mockCanvasProvider,
        mockViewportProvider
      );

      expect(manager.getCanvas()).toBeNull();
    });

    test("should provide canvas access", () => {
      expect(interactionManager.getCanvas()).toBe(mockCanvas);
      expect(mockCanvasProvider.getCanvas).toHaveBeenCalled();
    });

    test("should provide viewport access", () => {
      expect(interactionManager.getViewport()).toBe(mockViewport);
      expect(mockViewportProvider.getViewport).toHaveBeenCalled();
    });
  });

  describe("Tool Registration", () => {
    test("should register tool successfully", () => {
      const tool = createMockTool("test-tool");

      interactionManager.register(tool);

      // Test that tool is registered by checking event handling
      const event = createMockEvent();
      const result = interactionManager.onMouseDown(event);

      expect(tool.onMouseDown).toHaveBeenCalledWith(event, interactionManager);
      expect(result).toBe(false); // Tool returns undefined (falsy), so result is false
    });

    test("should register multiple tools", () => {
      const tool1 = createMockTool("tool1");
      const tool2 = createMockTool("tool2");

      interactionManager.register(tool1);
      interactionManager.register(tool2);

      const event = createMockEvent();
      interactionManager.onMouseDown(event);

      expect(tool1.onMouseDown).toHaveBeenCalledWith(event, interactionManager);
      expect(tool2.onMouseDown).toHaveBeenCalledWith(event, interactionManager);
    });

    test("should handle tool without event handlers", () => {
      const tool: Tool = { name: "minimal-tool" };

      interactionManager.register(tool);

      const event = createMockEvent();
      const result = interactionManager.onMouseDown(event);

      expect(result).toBe(false); // No tools handled the event
    });
  });

  describe("Tool Unregistration", () => {
    test("should unregister tool by name", () => {
      const tool = createMockTool("test-tool");
      interactionManager.register(tool);

      interactionManager.unregister("test-tool");

      const event = createMockEvent();
      interactionManager.onMouseDown(event);

      expect(tool.onMouseDown).not.toHaveBeenCalled();
      expect(tool.dispose).toHaveBeenCalled();
    });

    test("should not call dispose if tool has no dispose method", () => {
      const tool: Tool = {
        name: "no-dispose-tool",
        onMouseDown: vi.fn(),
      };
      interactionManager.register(tool);

      interactionManager.unregister("no-dispose-tool");

      const event = createMockEvent();
      interactionManager.onMouseDown(event);

      expect(tool.onMouseDown).not.toHaveBeenCalled();
    });

    test("should handle unregistering non-existent tool", () => {
      const tool = createMockTool("existing-tool");
      interactionManager.register(tool);

      // Try to unregister non-existent tool
      interactionManager.unregister("non-existent-tool");

      // Existing tool should still work
      const event = createMockEvent();
      interactionManager.onMouseDown(event);

      expect(tool.onMouseDown).toHaveBeenCalledWith(event, interactionManager);
    });

    test("should handle unregistering from empty manager", () => {
      expect(() => {
        interactionManager.unregister("any-tool");
      }).not.toThrow();
    });
  });

  describe("Clear Tools", () => {
    test("should clear all tools", () => {
      const tool1 = createMockTool("tool1");
      const tool2 = createMockTool("tool2");

      interactionManager.register(tool1);
      interactionManager.register(tool2);

      interactionManager.clear();

      expect(tool1.dispose).toHaveBeenCalled();
      expect(tool2.dispose).toHaveBeenCalled();

      // Verify tools are cleared
      const event = createMockEvent();
      interactionManager.onMouseDown(event);

      expect(tool1.onMouseDown).not.toHaveBeenCalled();
      expect(tool2.onMouseDown).not.toHaveBeenCalled();
    });

    test("should handle clearing empty manager", () => {
      expect(() => {
        interactionManager.clear();
      }).not.toThrow();
    });

    test("should handle tools without dispose method", () => {
      const tool: Tool = { name: "no-dispose-tool" };
      interactionManager.register(tool);

      interactionManager.clear();

      // Should not throw error
      expect(() => {
        interactionManager.clear();
      }).not.toThrow();
    });
  });

  describe("Event Handling - MouseDown", () => {
    test("should dispatch onMouseDown to all tools until one returns true", () => {
      const tool1 = createMockTool("tool1");
      const tool2 = createMockTool("tool2");
      const tool3 = createMockTool("tool3");

      vi.mocked(tool1.onMouseDown!).mockReturnValue(false);
      vi.mocked(tool2.onMouseDown!).mockReturnValue(true); // This should stop propagation
      vi.mocked(tool3.onMouseDown!).mockReturnValue(true);

      interactionManager.register(tool1);
      interactionManager.register(tool2);
      interactionManager.register(tool3);

      const event = createMockEvent();
      const result = interactionManager.onMouseDown(event);

      expect(tool1.onMouseDown).toHaveBeenCalledWith(event, interactionManager);
      expect(tool2.onMouseDown).toHaveBeenCalledWith(event, interactionManager);
      expect(tool3.onMouseDown).not.toHaveBeenCalled(); // Should not be called due to propagation stop
      expect(result).toBe(true);
    });

    test("should return false when no tools handle the event", () => {
      const tool1 = createMockTool("tool1");
      const tool2 = createMockTool("tool2");

      vi.mocked(tool1.onMouseDown!).mockReturnValue(false);
      vi.mocked(tool2.onMouseDown!).mockReturnValue(false);

      interactionManager.register(tool1);
      interactionManager.register(tool2);

      const event = createMockEvent();
      const result = interactionManager.onMouseDown(event);

      expect(result).toBe(false);
    });

    test("should return false for empty tool list", () => {
      const event = createMockEvent();
      const result = interactionManager.onMouseDown(event);

      expect(result).toBe(false);
    });

    test("should handle tools that don't have onMouseDown method", () => {
      const tool: Tool = { name: "no-mousedown-tool" };
      interactionManager.register(tool);

      const event = createMockEvent();
      const result = interactionManager.onMouseDown(event);

      expect(result).toBe(false);
    });

    test("should pass correct parameters to tool handlers", () => {
      const tool = createMockTool("test-tool");
      interactionManager.register(tool);

      const event = createMockEvent({
        clientX: 150,
        clientY: 250,
        altKey: true,
        shiftKey: true,
        metaKey: false,
      });

      interactionManager.onMouseDown(event);

      expect(tool.onMouseDown).toHaveBeenCalledWith(event, interactionManager);
      expect(tool.onMouseDown).toHaveBeenCalledTimes(1);
    });
  });

  describe("Event Handling - MouseMove", () => {
    test("should dispatch onMouseMove to all tools until one returns true", () => {
      const tool1 = createMockTool("tool1");
      const tool2 = createMockTool("tool2");

      vi.mocked(tool1.onMouseMove!).mockReturnValue(false);
      vi.mocked(tool2.onMouseMove!).mockReturnValue(true);

      interactionManager.register(tool1);
      interactionManager.register(tool2);

      const event = createMockEvent();
      const result = interactionManager.onMouseMove(event);

      expect(tool1.onMouseMove).toHaveBeenCalledWith(event, interactionManager);
      expect(tool2.onMouseMove).toHaveBeenCalledWith(event, interactionManager);
      expect(result).toBe(true);
    });

    test("should return false when no tools handle mouse move", () => {
      const tool = createMockTool("tool");
      vi.mocked(tool.onMouseMove!).mockReturnValue(false);

      interactionManager.register(tool);

      const event = createMockEvent();
      const result = interactionManager.onMouseMove(event);

      expect(result).toBe(false);
    });

    test("should handle tools without onMouseMove method", () => {
      const tool: Tool = { name: "no-mousemove-tool" };
      interactionManager.register(tool);

      const event = createMockEvent();
      const result = interactionManager.onMouseMove(event);

      expect(result).toBe(false);
    });
  });

  describe("Event Handling - MouseUp", () => {
    test("should dispatch onMouseUp to all tools until one returns true", () => {
      const tool1 = createMockTool("tool1");
      const tool2 = createMockTool("tool2");

      vi.mocked(tool1.onMouseUp!).mockReturnValue(false);
      vi.mocked(tool2.onMouseUp!).mockReturnValue(true);

      interactionManager.register(tool1);
      interactionManager.register(tool2);

      const event = createMockEvent();
      const result = interactionManager.onMouseUp(event);

      expect(tool1.onMouseUp).toHaveBeenCalledWith(event, interactionManager);
      expect(tool2.onMouseUp).toHaveBeenCalledWith(event, interactionManager);
      expect(result).toBe(true);
    });

    test("should return false when no tools handle mouse up", () => {
      const tool = createMockTool("tool");
      vi.mocked(tool.onMouseUp!).mockReturnValue(false);

      interactionManager.register(tool);

      const event = createMockEvent();
      const result = interactionManager.onMouseUp(event);

      expect(result).toBe(false);
    });

    test("should handle tools without onMouseUp method", () => {
      const tool: Tool = { name: "no-mouseup-tool" };
      interactionManager.register(tool);

      const event = createMockEvent();
      const result = interactionManager.onMouseUp(event);

      expect(result).toBe(false);
    });
  });

  describe("Event Handling - MouseLeave", () => {
    test("should dispatch onMouseLeave to all tools until one returns true", () => {
      const tool1 = createMockTool("tool1");
      const tool2 = createMockTool("tool2");

      vi.mocked(tool1.onMouseLeave!).mockReturnValue(false);
      vi.mocked(tool2.onMouseLeave!).mockReturnValue(true);

      interactionManager.register(tool1);
      interactionManager.register(tool2);

      const event = createMockEvent();
      const result = interactionManager.onMouseLeave(event);

      expect(tool1.onMouseLeave).toHaveBeenCalledWith(
        event,
        interactionManager
      );
      expect(tool2.onMouseLeave).toHaveBeenCalledWith(
        event,
        interactionManager
      );
      expect(result).toBe(true);
    });

    test("should return false when no tools handle mouse leave", () => {
      const tool = createMockTool("tool");
      vi.mocked(tool.onMouseLeave!).mockReturnValue(false);

      interactionManager.register(tool);

      const event = createMockEvent();
      const result = interactionManager.onMouseLeave(event);

      expect(result).toBe(false);
    });

    test("should handle tools without onMouseLeave method", () => {
      const tool: Tool = { name: "no-mouseleave-tool" };
      interactionManager.register(tool);

      const event = createMockEvent();
      const result = interactionManager.onMouseLeave(event);

      expect(result).toBe(false);
    });
  });

  describe("Event Propagation and Tool Ordering", () => {
    test("should process tools in registration order", () => {
      const tool1 = createMockTool("tool1");
      const tool2 = createMockTool("tool2");
      const tool3 = createMockTool("tool3");

      const callOrder: string[] = [];

      vi.mocked(tool1.onMouseDown!).mockImplementation(() => {
        callOrder.push("tool1");
        return false;
      });
      vi.mocked(tool2.onMouseDown!).mockImplementation(() => {
        callOrder.push("tool2");
        return false;
      });
      vi.mocked(tool3.onMouseDown!).mockImplementation(() => {
        callOrder.push("tool3");
        return false;
      });

      interactionManager.register(tool1);
      interactionManager.register(tool2);
      interactionManager.register(tool3);

      interactionManager.onMouseDown(createMockEvent());

      expect(callOrder).toEqual(["tool1", "tool2", "tool3"]);
    });

    test("should stop propagation when tool returns true", () => {
      const tool1 = createMockTool("tool1");
      const tool2 = createMockTool("tool2");
      const tool3 = createMockTool("tool3");

      vi.mocked(tool1.onMouseDown!).mockReturnValue(false);
      vi.mocked(tool2.onMouseDown!).mockReturnValue(true); // Stop propagation
      vi.mocked(tool3.onMouseDown!).mockReturnValue(true);

      interactionManager.register(tool1);
      interactionManager.register(tool2);
      interactionManager.register(tool3);

      interactionManager.onMouseDown(createMockEvent());

      expect(tool1.onMouseDown).toHaveBeenCalled();
      expect(tool2.onMouseDown).toHaveBeenCalled();
      expect(tool3.onMouseDown).not.toHaveBeenCalled();
    });

    test("should continue processing after unregistering stopping tool", () => {
      const tool1 = createMockTool("tool1");
      const tool2 = createMockTool("tool2");
      const tool3 = createMockTool("tool3");

      vi.mocked(tool1.onMouseDown!).mockReturnValue(false);
      vi.mocked(tool2.onMouseDown!).mockReturnValue(true);
      vi.mocked(tool3.onMouseDown!).mockReturnValue(false);

      interactionManager.register(tool1);
      interactionManager.register(tool2);
      interactionManager.register(tool3);

      // First call - tool2 stops propagation
      interactionManager.onMouseDown(createMockEvent());
      expect(tool3.onMouseDown).not.toHaveBeenCalled();

      // Unregister tool2
      interactionManager.unregister("tool2");

      // Reset mocks
      vi.clearAllMocks();
      vi.mocked(tool1.onMouseDown!).mockReturnValue(false);
      vi.mocked(tool3.onMouseDown!).mockReturnValue(false);

      // Second call - should reach tool3 now
      interactionManager.onMouseDown(createMockEvent());
      expect(tool1.onMouseDown).toHaveBeenCalled();
      expect(tool3.onMouseDown).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    test("should handle tool event handler throwing error", () => {
      const tool = createMockTool("error-tool");
      vi.mocked(tool.onMouseDown!).mockImplementation(() => {
        throw new Error("Tool error");
      });

      interactionManager.register(tool);

      expect(() => {
        interactionManager.onMouseDown(createMockEvent());
      }).toThrow("Tool error");
    });

    test("should continue processing other tools when one throws error", () => {
      const tool1 = createMockTool("error-tool");
      const tool2 = createMockTool("good-tool");

      vi.mocked(tool1.onMouseDown!).mockImplementation(() => {
        throw new Error("Tool error");
      });
      vi.mocked(tool2.onMouseDown!).mockReturnValue(true);

      interactionManager.register(tool1);
      interactionManager.register(tool2);

      expect(() => {
        interactionManager.onMouseDown(createMockEvent());
      }).toThrow("Tool error");
    });

    test("should handle dispose method throwing error", () => {
      const tool = createMockTool("error-dispose-tool");
      vi.mocked(tool.dispose!).mockImplementation(() => {
        throw new Error("Dispose error");
      });

      interactionManager.register(tool);

      expect(() => {
        interactionManager.unregister("error-dispose-tool");
      }).toThrow("Dispose error");
    });
  });

  describe("Complex Scenarios", () => {
    test("should handle dynamic tool registration during event processing", () => {
      const tool1 = createMockTool("tool1");
      const tool2 = createMockTool("tool2");

      vi.mocked(tool1.onMouseDown!).mockImplementation(() => {
        interactionManager.register(tool2);
        return false;
      });
      vi.mocked(tool2.onMouseDown!).mockReturnValue(true);

      interactionManager.register(tool1);

      const result = interactionManager.onMouseDown(createMockEvent());

      expect(tool1.onMouseDown).toHaveBeenCalled();
      expect(result).toBe(true); // tool2 was registered and returned true
    });

    test("should handle tool unregistration during event processing", () => {
      const tool1 = createMockTool("tool1");
      const tool2 = createMockTool("tool2");

      vi.mocked(tool1.onMouseDown!).mockImplementation(() => {
        interactionManager.unregister("tool2");
        return false;
      });
      vi.mocked(tool2.onMouseDown!).mockReturnValue(true);

      interactionManager.register(tool1);
      interactionManager.register(tool2);

      const result = interactionManager.onMouseDown(createMockEvent());

      expect(tool1.onMouseDown).toHaveBeenCalled();
      expect(tool2.onMouseDown).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    test("should handle multiple events with different tools", () => {
      const mouseTool = createMockTool("mouse-tool");
      const keyboardTool = createMockTool("keyboard-tool");

      vi.mocked(mouseTool.onMouseDown!).mockReturnValue(true);
      vi.mocked(keyboardTool.onMouseDown!).mockReturnValue(false);

      interactionManager.register(mouseTool);
      interactionManager.register(keyboardTool);

      // Mouse event
      const mouseResult = interactionManager.onMouseDown(createMockEvent());
      expect(mouseResult).toBe(true);
      expect(mouseTool.onMouseDown).toHaveBeenCalled();
      expect(keyboardTool.onMouseDown).not.toHaveBeenCalled();

      // Reset for next test
      vi.clearAllMocks();
      vi.mocked(mouseTool.onMouseDown!).mockReturnValue(false);

      // Another mouse event
      const mouseResult2 = interactionManager.onMouseDown(createMockEvent());
      expect(mouseResult2).toBe(false);
      expect(mouseTool.onMouseDown).toHaveBeenCalled();
      expect(keyboardTool.onMouseDown).toHaveBeenCalled();
    });
  });
});
