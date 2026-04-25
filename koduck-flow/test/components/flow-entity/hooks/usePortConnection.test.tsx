/**
 * @file usePortConnection Hook Tests
 * @description Unit tests for the usePortConnection hook that provides
 * drag-to-connect behavior for flow node ports with validation support.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 2.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React, { type ReactNode } from "react";
import {
  usePortConnection,
  usePortConnectionContext,
  usePortConnectionContextOptional,
  PortConnectionProvider,
  areTypesCompatible,
  createConnectionKey,
  type PortConnection,
  type ConnectionValidationRules,
  type UsePortConnectionOptions,
  type PortConnectionProviderProps,
} from "../../../../src/components/flow-entity/hooks/usePortConnection.jsx";
import type { PortDefinition, PortDataType } from "../../../../src/components/flow-entity/types";

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock port definition
 */
function createMockPort(
  id: string,
  type: "input" | "output",
  dataType: PortDataType = "any"
): PortDefinition {
  return {
    id,
    name: `Port ${id}`,
    type,
    dataType,
  };
}

/**
 * Create a wrapper with PortConnectionProvider
 */
function createWrapper(props: Partial<PortConnectionProviderProps> = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <PortConnectionProvider {...props}>{children}</PortConnectionProvider>;
  };
}

// =============================================================================
// Helper Function Tests
// =============================================================================

describe("areTypesCompatible", () => {
  it("returns true when both types are undefined", () => {
    expect(areTypesCompatible(undefined, undefined)).toBe(true);
  });

  it("returns true when source type is undefined", () => {
    expect(areTypesCompatible(undefined, "string")).toBe(true);
  });

  it("returns true when target type is undefined", () => {
    expect(areTypesCompatible("string", undefined)).toBe(true);
  });

  it("returns true when source type is any", () => {
    expect(areTypesCompatible("any", "string")).toBe(true);
  });

  it("returns true when target type is any", () => {
    expect(areTypesCompatible("string", "any")).toBe(true);
  });

  it("returns true for matching types", () => {
    expect(areTypesCompatible("string", "string")).toBe(true);
    expect(areTypesCompatible("number", "number")).toBe(true);
    expect(areTypesCompatible("boolean", "boolean")).toBe(true);
    expect(areTypesCompatible("object", "object")).toBe(true);
    expect(areTypesCompatible("array", "array")).toBe(true);
    expect(areTypesCompatible("function", "function")).toBe(true);
  });

  it("returns true for number to string conversion", () => {
    expect(areTypesCompatible("number", "string")).toBe(true);
  });

  it("returns true for boolean to string conversion", () => {
    expect(areTypesCompatible("boolean", "string")).toBe(true);
  });

  it("returns false for incompatible types", () => {
    expect(areTypesCompatible("string", "number")).toBe(false);
    expect(areTypesCompatible("string", "boolean")).toBe(false);
    expect(areTypesCompatible("object", "array")).toBe(false);
    expect(areTypesCompatible("function", "object")).toBe(false);
  });
});

describe("createConnectionKey", () => {
  it("creates correct connection key format", () => {
    const key = createConnectionKey("node1", "port1", "node2", "port2");
    expect(key).toBe("node1:port1->node2:port2");
  });

  it("handles special characters in IDs", () => {
    const key = createConnectionKey("node-1", "port_1", "node:2", "port.2");
    expect(key).toBe("node-1:port_1->node:2:port.2");
  });
});

// =============================================================================
// usePortConnection Hook Tests
// =============================================================================

describe("usePortConnection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("starts with isConnecting false", () => {
      const { result } = renderHook(() => usePortConnection());
      expect(result.current.isConnecting).toBe(false);
    });

    it("starts with null preview position", () => {
      const { result } = renderHook(() => usePortConnection());
      expect(result.current.previewPosition).toBeNull();
    });

    it("starts with isValidTarget false", () => {
      const { result } = renderHook(() => usePortConnection());
      expect(result.current.isValidTarget).toBe(false);
    });

    it("has empty connection state initially", () => {
      const { result } = renderHook(() => usePortConnection());
      expect(result.current.connectionState).toEqual({
        isConnecting: false,
        sourcePort: null,
        sourceNodeId: null,
        previewPosition: null,
        hoveredTargetPort: null,
        hoveredTargetNodeId: null,
        isValidTarget: false,
      });
    });
  });

  describe("startConnection", () => {
    it("sets isConnecting to true", () => {
      const { result } = renderHook(() => usePortConnection());
      const port = createMockPort("out1", "output");

      act(() => {
        result.current.startConnection("node1", port, { x: 100, y: 100 });
      });

      expect(result.current.isConnecting).toBe(true);
    });

    it("stores source port and node", () => {
      const { result } = renderHook(() => usePortConnection());
      const port = createMockPort("out1", "output");

      act(() => {
        result.current.startConnection("node1", port, { x: 100, y: 100 });
      });

      expect(result.current.connectionState.sourcePort).toEqual(port);
      expect(result.current.connectionState.sourceNodeId).toBe("node1");
    });

    it("sets initial preview position", () => {
      const { result } = renderHook(() => usePortConnection());
      const port = createMockPort("out1", "output");

      act(() => {
        result.current.startConnection("node1", port, { x: 100, y: 200 });
      });

      expect(result.current.previewPosition).toEqual({ x: 100, y: 200 });
    });

    it("calls onConnectionStart callback", () => {
      const onConnectionStart = vi.fn();
      const { result } = renderHook(() => usePortConnection({ onConnectionStart }));
      const port = createMockPort("out1", "output");

      act(() => {
        result.current.startConnection("node1", port, { x: 100, y: 100 });
      });

      expect(onConnectionStart).toHaveBeenCalledOnce();
      expect(onConnectionStart).toHaveBeenCalledWith({
        nodeId: "node1",
        portId: "out1",
        port,
      });
    });

    it("does nothing when disabled", () => {
      const onConnectionStart = vi.fn();
      const { result } = renderHook(() => usePortConnection({ onConnectionStart, disabled: true }));
      const port = createMockPort("out1", "output");

      act(() => {
        result.current.startConnection("node1", port, { x: 100, y: 100 });
      });

      expect(result.current.isConnecting).toBe(false);
      expect(onConnectionStart).not.toHaveBeenCalled();
    });
  });

  describe("updatePreview", () => {
    it("updates preview position during connection", () => {
      const { result } = renderHook(() => usePortConnection());
      const port = createMockPort("out1", "output");

      act(() => {
        result.current.startConnection("node1", port, { x: 100, y: 100 });
      });

      act(() => {
        result.current.updatePreview({ x: 200, y: 300 });
      });

      expect(result.current.previewPosition).toEqual({ x: 200, y: 300 });
    });

    it("does not update when not connecting", () => {
      const { result } = renderHook(() => usePortConnection());

      act(() => {
        result.current.updatePreview({ x: 200, y: 300 });
      });

      expect(result.current.previewPosition).toBeNull();
    });

    it("calls onPreviewUpdate callback", () => {
      const onPreviewUpdate = vi.fn();
      const { result } = renderHook(() => usePortConnection({ onPreviewUpdate }));
      const port = createMockPort("out1", "output");

      act(() => {
        result.current.startConnection("node1", port, { x: 100, y: 100 });
      });

      act(() => {
        result.current.updatePreview({ x: 200, y: 300 });
      });

      expect(onPreviewUpdate).toHaveBeenCalledWith({ x: 200, y: 300 });
    });
  });

  describe("hoverPort", () => {
    it("sets hovered target port", () => {
      const { result } = renderHook(() => usePortConnection());
      const sourcePort = createMockPort("out1", "output");
      const targetPort = createMockPort("in1", "input");

      act(() => {
        result.current.startConnection("node1", sourcePort, { x: 100, y: 100 });
      });

      act(() => {
        result.current.hoverPort("node2", targetPort);
      });

      expect(result.current.connectionState.hoveredTargetPort).toEqual(targetPort);
      expect(result.current.connectionState.hoveredTargetNodeId).toBe("node2");
    });

    it("validates target and sets isValidTarget", () => {
      const { result } = renderHook(() => usePortConnection());
      const sourcePort = createMockPort("out1", "output");
      const targetPort = createMockPort("in1", "input");

      act(() => {
        result.current.startConnection("node1", sourcePort, { x: 100, y: 100 });
      });

      act(() => {
        result.current.hoverPort("node2", targetPort);
      });

      expect(result.current.isValidTarget).toBe(true);
    });

    it("sets isValidTarget false for invalid targets", () => {
      const { result } = renderHook(() => usePortConnection());
      const sourcePort = createMockPort("out1", "output");
      const targetPort = createMockPort("out2", "output"); // Same direction

      act(() => {
        result.current.startConnection("node1", sourcePort, { x: 100, y: 100 });
      });

      act(() => {
        result.current.hoverPort("node2", targetPort);
      });

      expect(result.current.isValidTarget).toBe(false);
    });

    it("clears hover state when passing null", () => {
      const { result } = renderHook(() => usePortConnection());
      const sourcePort = createMockPort("out1", "output");
      const targetPort = createMockPort("in1", "input");

      act(() => {
        result.current.startConnection("node1", sourcePort, { x: 100, y: 100 });
      });

      act(() => {
        result.current.hoverPort("node2", targetPort);
      });

      act(() => {
        result.current.hoverPort(null, null);
      });

      expect(result.current.connectionState.hoveredTargetPort).toBeNull();
      expect(result.current.connectionState.hoveredTargetNodeId).toBeNull();
    });

    it("calls onTargetHover callback", () => {
      const onTargetHover = vi.fn();
      const { result } = renderHook(() => usePortConnection({ onTargetHover }));
      const sourcePort = createMockPort("out1", "output");
      const targetPort = createMockPort("in1", "input");

      act(() => {
        result.current.startConnection("node1", sourcePort, { x: 100, y: 100 });
      });

      act(() => {
        result.current.hoverPort("node2", targetPort);
      });

      expect(onTargetHover).toHaveBeenCalledWith(
        { nodeId: "node2", portId: "in1", port: targetPort },
        true
      );
    });
  });

  describe("validateConnection", () => {
    it("returns valid for output to input connection", () => {
      const { result } = renderHook(() => usePortConnection());
      const sourcePort = createMockPort("out1", "output");
      const targetPort = createMockPort("in1", "input");

      const validation = result.current.validateConnection(
        "node1",
        sourcePort,
        "node2",
        targetPort
      );

      expect(validation.valid).toBe(true);
    });

    it("returns valid for input to output connection (reverse)", () => {
      const { result } = renderHook(() => usePortConnection());
      const sourcePort = createMockPort("in1", "input");
      const targetPort = createMockPort("out1", "output");

      const validation = result.current.validateConnection(
        "node1",
        sourcePort,
        "node2",
        targetPort
      );

      expect(validation.valid).toBe(true);
    });

    it("returns invalid for output to output connection by default", () => {
      const { result } = renderHook(() => usePortConnection());
      const sourcePort = createMockPort("out1", "output");
      const targetPort = createMockPort("out2", "output");

      const validation = result.current.validateConnection(
        "node1",
        sourcePort,
        "node2",
        targetPort
      );

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe("Cannot connect output to output");
    });

    it("returns invalid for input to input connection by default", () => {
      const { result } = renderHook(() => usePortConnection());
      const sourcePort = createMockPort("in1", "input");
      const targetPort = createMockPort("in2", "input");

      const validation = result.current.validateConnection(
        "node1",
        sourcePort,
        "node2",
        targetPort
      );

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe("Cannot connect input to input");
    });

    it("returns invalid for self-connection by default", () => {
      const { result } = renderHook(() => usePortConnection());
      const sourcePort = createMockPort("out1", "output");
      const targetPort = createMockPort("in1", "input");

      const validation = result.current.validateConnection(
        "node1",
        sourcePort,
        "node1", // Same node
        targetPort
      );

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe("Self-connection is not allowed");
    });

    it("allows self-connection when configured", () => {
      const { result } = renderHook(() =>
        usePortConnection({
          validationRules: { allowSelfConnection: true },
        })
      );
      const sourcePort = createMockPort("out1", "output");
      const targetPort = createMockPort("in1", "input");

      const validation = result.current.validateConnection(
        "node1",
        sourcePort,
        "node1",
        targetPort
      );

      expect(validation.valid).toBe(true);
    });

    it("allows output to output when configured", () => {
      const { result } = renderHook(() =>
        usePortConnection({
          validationRules: { allowOutputToOutput: true },
        })
      );
      const sourcePort = createMockPort("out1", "output");
      const targetPort = createMockPort("out2", "output");

      const validation = result.current.validateConnection(
        "node1",
        sourcePort,
        "node2",
        targetPort
      );

      expect(validation.valid).toBe(true);
    });

    it("allows input to input when configured", () => {
      const { result } = renderHook(() =>
        usePortConnection({
          validationRules: { allowInputToInput: true },
        })
      );
      const sourcePort = createMockPort("in1", "input");
      const targetPort = createMockPort("in2", "input");

      const validation = result.current.validateConnection(
        "node1",
        sourcePort,
        "node2",
        targetPort
      );

      expect(validation.valid).toBe(true);
    });

    it("returns invalid for incompatible types", () => {
      const { result } = renderHook(() => usePortConnection());
      const sourcePort = createMockPort("out1", "output", "object");
      const targetPort = createMockPort("in1", "input", "function");

      const validation = result.current.validateConnection(
        "node1",
        sourcePort,
        "node2",
        targetPort
      );

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain("Incompatible types");
    });

    it("allows incompatible types when configured", () => {
      const { result } = renderHook(() =>
        usePortConnection({
          validationRules: { allowIncompatibleTypes: true },
        })
      );
      const sourcePort = createMockPort("out1", "output", "object");
      const targetPort = createMockPort("in1", "input", "function");

      const validation = result.current.validateConnection(
        "node1",
        sourcePort,
        "node2",
        targetPort
      );

      expect(validation.valid).toBe(true);
    });

    it("checks for duplicate connections", () => {
      const existingConnections = new Set(["node1:out1->node2:in1"]);
      const { result } = renderHook(() => usePortConnection({ existingConnections }));
      const sourcePort = createMockPort("out1", "output");
      const targetPort = createMockPort("in1", "input");

      const validation = result.current.validateConnection(
        "node1",
        sourcePort,
        "node2",
        targetPort
      );

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe("Connection already exists");
    });

    it("uses custom validator", () => {
      const customValidator = vi.fn().mockReturnValue({
        valid: false,
        reason: "Custom validation failed",
      });
      const { result } = renderHook(() =>
        usePortConnection({
          validationRules: { customValidator },
        })
      );
      const sourcePort = createMockPort("out1", "output");
      const targetPort = createMockPort("in1", "input");

      const validation = result.current.validateConnection(
        "node1",
        sourcePort,
        "node2",
        targetPort
      );

      expect(customValidator).toHaveBeenCalled();
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe("Custom validation failed");
    });
  });

  describe("canConnectTo", () => {
    it("returns false when not connecting", () => {
      const { result } = renderHook(() => usePortConnection());
      const targetPort = createMockPort("in1", "input");

      expect(result.current.canConnectTo("node2", targetPort)).toBe(false);
    });

    it("returns true for valid target during connection", () => {
      const { result } = renderHook(() => usePortConnection());
      const sourcePort = createMockPort("out1", "output");
      const targetPort = createMockPort("in1", "input");

      act(() => {
        result.current.startConnection("node1", sourcePort, { x: 100, y: 100 });
      });

      expect(result.current.canConnectTo("node2", targetPort)).toBe(true);
    });

    it("returns false for invalid target during connection", () => {
      const { result } = renderHook(() => usePortConnection());
      const sourcePort = createMockPort("out1", "output");
      const targetPort = createMockPort("out2", "output");

      act(() => {
        result.current.startConnection("node1", sourcePort, { x: 100, y: 100 });
      });

      expect(result.current.canConnectTo("node2", targetPort)).toBe(false);
    });
  });

  describe("completeConnection", () => {
    it("completes valid connection and calls onConnect", () => {
      const onConnect = vi.fn();
      const { result } = renderHook(() => usePortConnection({ onConnect }));
      const sourcePort = createMockPort("out1", "output");
      const targetPort = createMockPort("in1", "input");

      act(() => {
        result.current.startConnection("node1", sourcePort, { x: 100, y: 100 });
      });

      let success: boolean;
      act(() => {
        success = result.current.completeConnection("node2", targetPort);
      });

      expect(success!).toBe(true);
      expect(onConnect).toHaveBeenCalledOnce();
      expect(onConnect).toHaveBeenCalledWith(
        { nodeId: "node1", portId: "out1", port: sourcePort },
        { nodeId: "node2", portId: "in1", port: targetPort }
      );
    });

    it("resets connection state after completion", () => {
      const { result } = renderHook(() => usePortConnection());
      const sourcePort = createMockPort("out1", "output");
      const targetPort = createMockPort("in1", "input");

      act(() => {
        result.current.startConnection("node1", sourcePort, { x: 100, y: 100 });
      });

      act(() => {
        result.current.completeConnection("node2", targetPort);
      });

      expect(result.current.isConnecting).toBe(false);
      expect(result.current.connectionState.sourcePort).toBeNull();
    });

    it("rejects invalid connection and calls onConnectionFailed", () => {
      const onConnect = vi.fn();
      const onConnectionFailed = vi.fn();
      const { result } = renderHook(() => usePortConnection({ onConnect, onConnectionFailed }));
      const sourcePort = createMockPort("out1", "output");
      const targetPort = createMockPort("out2", "output");

      act(() => {
        result.current.startConnection("node1", sourcePort, { x: 100, y: 100 });
      });

      let success: boolean;
      act(() => {
        success = result.current.completeConnection("node2", targetPort);
      });

      expect(success!).toBe(false);
      expect(onConnect).not.toHaveBeenCalled();
      expect(onConnectionFailed).toHaveBeenCalledOnce();
    });

    it("returns false when not connecting", () => {
      const { result } = renderHook(() => usePortConnection());
      const targetPort = createMockPort("in1", "input");

      let success: boolean;
      act(() => {
        success = result.current.completeConnection("node2", targetPort);
      });

      expect(success!).toBe(false);
    });
  });

  describe("cancelConnection", () => {
    it("resets connection state", () => {
      const { result } = renderHook(() => usePortConnection());
      const port = createMockPort("out1", "output");

      act(() => {
        result.current.startConnection("node1", port, { x: 100, y: 100 });
      });

      expect(result.current.isConnecting).toBe(true);

      act(() => {
        result.current.cancelConnection();
      });

      expect(result.current.isConnecting).toBe(false);
    });

    it("calls onConnectionCancel callback", () => {
      const onConnectionCancel = vi.fn();
      const { result } = renderHook(() => usePortConnection({ onConnectionCancel }));
      const port = createMockPort("out1", "output");

      act(() => {
        result.current.startConnection("node1", port, { x: 100, y: 100 });
      });

      act(() => {
        result.current.cancelConnection();
      });

      expect(onConnectionCancel).toHaveBeenCalledOnce();
    });

    it("does not call onConnectionCancel when not connecting", () => {
      const onConnectionCancel = vi.fn();
      const { result } = renderHook(() => usePortConnection({ onConnectionCancel }));

      act(() => {
        result.current.cancelConnection();
      });

      expect(onConnectionCancel).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// PortConnectionProvider Tests
// =============================================================================

describe("PortConnectionProvider", () => {
  describe("context access", () => {
    it("provides context value to children", () => {
      const { result } = renderHook(() => usePortConnectionContext(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.startConnection).toBeInstanceOf(Function);
    });

    it("throws error when usePortConnectionContext is used outside provider", () => {
      expect(() => {
        renderHook(() => usePortConnectionContext());
      }).toThrow("usePortConnectionContext must be used within a PortConnectionProvider");
    });

    it("returns undefined when usePortConnectionContextOptional is used outside provider", () => {
      const { result } = renderHook(() => usePortConnectionContextOptional());
      expect(result.current).toBeUndefined();
    });
  });

  describe("shared state", () => {
    it("passes options to internal hook", () => {
      const onConnect = vi.fn();
      const { result } = renderHook(() => usePortConnectionContext(), {
        wrapper: createWrapper({ onConnect }),
      });
      const sourcePort = createMockPort("out1", "output");
      const targetPort = createMockPort("in1", "input");

      act(() => {
        result.current.startConnection("node1", sourcePort, { x: 100, y: 100 });
      });

      act(() => {
        result.current.completeConnection("node2", targetPort);
      });

      expect(onConnect).toHaveBeenCalledOnce();
    });

    it("provides consistent context value to all children in same tree", () => {
      // This test verifies that the context value is correctly provided
      // Note: Each renderHook creates a separate React tree, so they won't share state
      // In a real component tree, children would share the same context state
      const { result } = renderHook(() => usePortConnectionContext(), {
        wrapper: createWrapper(),
      });

      const port = createMockPort("out1", "output");

      // Verify initial state
      expect(result.current.isConnecting).toBe(false);

      // Start connection
      act(() => {
        result.current.startConnection("node1", port, { x: 100, y: 100 });
      });

      // Verify state updated
      expect(result.current.isConnecting).toBe(true);
      expect(result.current.connectionState.sourceNodeId).toBe("node1");
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe("Port Connection Integration", () => {
  it("simulates complete drag-to-connect workflow", () => {
    const onConnect = vi.fn();
    const onConnectionStart = vi.fn();
    const onTargetHover = vi.fn();

    const { result } = renderHook(() =>
      usePortConnection({
        onConnect,
        onConnectionStart,
        onTargetHover,
      })
    );

    const sourcePort = createMockPort("out1", "output", "string");
    const targetPort = createMockPort("in1", "input", "string");

    // Step 1: Start connection from output port
    act(() => {
      result.current.startConnection("node1", sourcePort, { x: 100, y: 100 });
    });

    expect(result.current.isConnecting).toBe(true);
    expect(onConnectionStart).toHaveBeenCalledOnce();

    // Step 2: Update preview position (simulating drag)
    act(() => {
      result.current.updatePreview({ x: 150, y: 150 });
    });

    expect(result.current.previewPosition).toEqual({ x: 150, y: 150 });

    // Step 3: Hover over target port
    act(() => {
      result.current.hoverPort("node2", targetPort);
    });

    expect(result.current.isValidTarget).toBe(true);
    expect(onTargetHover).toHaveBeenCalledWith(
      { nodeId: "node2", portId: "in1", port: targetPort },
      true
    );

    // Step 4: Complete connection
    act(() => {
      result.current.completeConnection("node2", targetPort);
    });

    expect(onConnect).toHaveBeenCalledWith(
      { nodeId: "node1", portId: "out1", port: sourcePort },
      { nodeId: "node2", portId: "in1", port: targetPort }
    );
    expect(result.current.isConnecting).toBe(false);
  });

  it("simulates drag-to-connect with invalid target", () => {
    const onConnect = vi.fn();
    const onConnectionFailed = vi.fn();
    const onTargetHover = vi.fn();

    const { result } = renderHook(() =>
      usePortConnection({
        onConnect,
        onConnectionFailed,
        onTargetHover,
      })
    );

    const sourcePort = createMockPort("out1", "output");
    const invalidTargetPort = createMockPort("out2", "output"); // Same direction

    // Start connection
    act(() => {
      result.current.startConnection("node1", sourcePort, { x: 100, y: 100 });
    });

    // Hover over invalid target
    act(() => {
      result.current.hoverPort("node2", invalidTargetPort);
    });

    expect(result.current.isValidTarget).toBe(false);
    expect(onTargetHover).toHaveBeenCalledWith(expect.objectContaining({ nodeId: "node2" }), false);

    // Try to complete connection - should fail
    let success: boolean;
    act(() => {
      success = result.current.completeConnection("node2", invalidTargetPort);
    });

    expect(success!).toBe(false);
    expect(onConnect).not.toHaveBeenCalled();
    expect(onConnectionFailed).toHaveBeenCalledOnce();
  });

  it("simulates cancel connection with Escape key behavior", () => {
    const onConnectionCancel = vi.fn();

    const { result } = renderHook(() => usePortConnection({ onConnectionCancel }));

    const sourcePort = createMockPort("out1", "output");

    act(() => {
      result.current.startConnection("node1", sourcePort, { x: 100, y: 100 });
    });

    expect(result.current.isConnecting).toBe(true);

    // Cancel the connection
    act(() => {
      result.current.cancelConnection();
    });

    expect(result.current.isConnecting).toBe(false);
    expect(onConnectionCancel).toHaveBeenCalledOnce();
  });
});
