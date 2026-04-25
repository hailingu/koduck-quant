/**
 * @file FlowEntityContext unit tests
 * @description Tests for FlowEntityProvider, useFlowEntityContext, and related hooks
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, renderHook } from "@testing-library/react";
import React from "react";
import {
  FlowEntityProvider,
  useFlowEntityContext,
  useOptionalFlowEntityContext,
  useFlowTheme,
  usePortConfig,
  useFlowReadOnly,
  DEFAULT_FLOW_THEME,
  DEFAULT_NODE_THEME,
  DEFAULT_EDGE_THEME,
  DEFAULT_PORT_CONFIG,
  DEFAULT_EXECUTION_VISUALS,
  DEFAULT_EDGE_ANIMATION,
  type FlowEntityContextValue,
} from "../../../src/components/flow-entity";

describe("FlowEntityContext", () => {
  // ===========================================================================
  // Default Exports
  // ===========================================================================

  describe("default exports", () => {
    it("should export DEFAULT_NODE_THEME with all required properties", () => {
      expect(DEFAULT_NODE_THEME).toBeDefined();
      expect(DEFAULT_NODE_THEME.backgroundColor).toBe("#ffffff");
      expect(DEFAULT_NODE_THEME.borderColor).toBe("#e5e7eb");
      expect(DEFAULT_NODE_THEME.textColor).toBe("#111827");
      expect(DEFAULT_NODE_THEME.portColors).toBeDefined();
      expect(DEFAULT_NODE_THEME.executionStateColors).toBeDefined();
    });

    it("should export DEFAULT_EDGE_THEME with all required properties", () => {
      expect(DEFAULT_EDGE_THEME).toBeDefined();
      expect(DEFAULT_EDGE_THEME.strokeColor).toBe("#9ca3af");
      expect(DEFAULT_EDGE_THEME.strokeWidth).toBe(2);
      expect(DEFAULT_EDGE_THEME.animationStateColors).toBeDefined();
    });

    it("should export DEFAULT_FLOW_THEME with node and edge themes", () => {
      expect(DEFAULT_FLOW_THEME).toBeDefined();
      expect(DEFAULT_FLOW_THEME.node).toBe(DEFAULT_NODE_THEME);
      expect(DEFAULT_FLOW_THEME.edge).toBe(DEFAULT_EDGE_THEME);
      expect(DEFAULT_FLOW_THEME.canvasBackground).toBe("#f9fafb");
    });

    it("should export DEFAULT_PORT_CONFIG", () => {
      expect(DEFAULT_PORT_CONFIG).toBeDefined();
      expect(DEFAULT_PORT_CONFIG.enableTypeChecking).toBe(true);
      expect(DEFAULT_PORT_CONFIG.showLabels).toBe(true);
      expect(DEFAULT_PORT_CONFIG.portSize).toBe(10);
    });

    it("should export DEFAULT_EXECUTION_VISUALS", () => {
      expect(DEFAULT_EXECUTION_VISUALS).toBeDefined();
      expect(DEFAULT_EXECUTION_VISUALS.showProgress).toBe(true);
      expect(DEFAULT_EXECUTION_VISUALS.enablePulse).toBe(true);
    });

    it("should export DEFAULT_EDGE_ANIMATION", () => {
      expect(DEFAULT_EDGE_ANIMATION).toBeDefined();
      expect(DEFAULT_EDGE_ANIMATION.enabled).toBe(true);
      expect(DEFAULT_EDGE_ANIMATION.particleCount).toBe(3);
    });
  });

  // ===========================================================================
  // FlowEntityProvider
  // ===========================================================================

  describe("FlowEntityProvider", () => {
    it("should render children", () => {
      render(
        <FlowEntityProvider>
          <div data-testid="child">Hello</div>
        </FlowEntityProvider>
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByText("Hello")).toBeInTheDocument();
    });

    it("should provide default context values", () => {
      let contextValue: FlowEntityContextValue | undefined;

      function Consumer() {
        contextValue = useFlowEntityContext();
        return null;
      }

      render(
        <FlowEntityProvider>
          <Consumer />
        </FlowEntityProvider>
      );

      expect(contextValue).toBeDefined();
      expect(contextValue!.theme).toEqual(DEFAULT_FLOW_THEME);
      expect(contextValue!.portConfig).toEqual(DEFAULT_PORT_CONFIG);
      expect(contextValue!.executionVisuals).toEqual(DEFAULT_EXECUTION_VISUALS);
      expect(contextValue!.edgeAnimation).toEqual(DEFAULT_EDGE_ANIMATION);
      expect(contextValue!.readOnly).toBe(false);
      expect(contextValue!.debug).toBe(false);
    });

    it("should merge partial node theme with defaults", () => {
      let contextValue: FlowEntityContextValue | undefined;

      function Consumer() {
        contextValue = useFlowEntityContext();
        return null;
      }

      render(
        <FlowEntityProvider theme={{ node: { backgroundColor: "#ff0000" } }}>
          <Consumer />
        </FlowEntityProvider>
      );

      expect(contextValue!.theme.node.backgroundColor).toBe("#ff0000");
      // Other defaults should be preserved
      expect(contextValue!.theme.node.borderColor).toBe(DEFAULT_NODE_THEME.borderColor);
      expect(contextValue!.theme.node.textColor).toBe(DEFAULT_NODE_THEME.textColor);
    });

    it("should merge partial edge theme with defaults", () => {
      let contextValue: FlowEntityContextValue | undefined;

      function Consumer() {
        contextValue = useFlowEntityContext();
        return null;
      }

      render(
        <FlowEntityProvider theme={{ edge: { strokeColor: "#00ff00", strokeWidth: 4 } }}>
          <Consumer />
        </FlowEntityProvider>
      );

      expect(contextValue!.theme.edge.strokeColor).toBe("#00ff00");
      expect(contextValue!.theme.edge.strokeWidth).toBe(4);
      // Other defaults should be preserved
      expect(contextValue!.theme.edge.arrowSize).toBe(DEFAULT_EDGE_THEME.arrowSize);
    });

    it("should merge nested portColors in node theme", () => {
      let contextValue: FlowEntityContextValue | undefined;

      function Consumer() {
        contextValue = useFlowEntityContext();
        return null;
      }

      render(
        <FlowEntityProvider theme={{ node: { portColors: { connected: "#123456" } } }}>
          <Consumer />
        </FlowEntityProvider>
      );

      expect(contextValue!.theme.node.portColors!.connected).toBe("#123456");
      // Other port colors should be preserved
      expect(contextValue!.theme.node.portColors!.default).toBe(
        DEFAULT_NODE_THEME.portColors!.default
      );
      expect(contextValue!.theme.node.portColors!.error).toBe(DEFAULT_NODE_THEME.portColors!.error);
    });

    it("should merge nested animationStateColors in edge theme", () => {
      let contextValue: FlowEntityContextValue | undefined;

      function Consumer() {
        contextValue = useFlowEntityContext();
        return null;
      }

      render(
        <FlowEntityProvider theme={{ edge: { animationStateColors: { flowing: "#abcdef" } } }}>
          <Consumer />
        </FlowEntityProvider>
      );

      expect(contextValue!.theme.edge.animationStateColors!.flowing).toBe("#abcdef");
      // Other animation colors should be preserved
      expect(contextValue!.theme.edge.animationStateColors!.success).toBe(
        DEFAULT_EDGE_THEME.animationStateColors!.success
      );
    });

    it("should merge canvas-level theme properties", () => {
      let contextValue: FlowEntityContextValue | undefined;

      function Consumer() {
        contextValue = useFlowEntityContext();
        return null;
      }

      render(
        <FlowEntityProvider
          theme={{
            canvasBackground: "#000000",
            gridColor: "#333333",
            selectionColor: "rgba(255, 0, 0, 0.5)",
          }}
        >
          <Consumer />
        </FlowEntityProvider>
      );

      expect(contextValue!.theme.canvasBackground).toBe("#000000");
      expect(contextValue!.theme.gridColor).toBe("#333333");
      expect(contextValue!.theme.selectionColor).toBe("rgba(255, 0, 0, 0.5)");
    });

    it("should merge partial portConfig with defaults", () => {
      let contextValue: FlowEntityContextValue | undefined;

      function Consumer() {
        contextValue = useFlowEntityContext();
        return null;
      }

      render(
        <FlowEntityProvider portConfig={{ portSize: 20, showLabels: false }}>
          <Consumer />
        </FlowEntityProvider>
      );

      expect(contextValue!.portConfig.portSize).toBe(20);
      expect(contextValue!.portConfig.showLabels).toBe(false);
      // Other defaults should be preserved
      expect(contextValue!.portConfig.enableTypeChecking).toBe(
        DEFAULT_PORT_CONFIG.enableTypeChecking
      );
    });

    it("should merge partial executionVisuals with defaults", () => {
      let contextValue: FlowEntityContextValue | undefined;

      function Consumer() {
        contextValue = useFlowEntityContext();
        return null;
      }

      render(
        <FlowEntityProvider executionVisuals={{ showProgress: false }}>
          <Consumer />
        </FlowEntityProvider>
      );

      expect(contextValue!.executionVisuals.showProgress).toBe(false);
      expect(contextValue!.executionVisuals.enablePulse).toBe(
        DEFAULT_EXECUTION_VISUALS.enablePulse
      );
    });

    it("should merge partial edgeAnimation with defaults", () => {
      let contextValue: FlowEntityContextValue | undefined;

      function Consumer() {
        contextValue = useFlowEntityContext();
        return null;
      }

      render(
        <FlowEntityProvider edgeAnimation={{ particleCount: 10, enabled: false }}>
          <Consumer />
        </FlowEntityProvider>
      );

      expect(contextValue!.edgeAnimation.particleCount).toBe(10);
      expect(contextValue!.edgeAnimation.enabled).toBe(false);
      expect(contextValue!.edgeAnimation.particleSpeed).toBe(DEFAULT_EDGE_ANIMATION.particleSpeed);
    });

    it("should pass through runtime reference", () => {
      const mockRuntime = { execute: vi.fn() };
      let contextValue: FlowEntityContextValue | undefined;

      function Consumer() {
        contextValue = useFlowEntityContext();
        return null;
      }

      render(
        <FlowEntityProvider runtime={mockRuntime}>
          <Consumer />
        </FlowEntityProvider>
      );

      expect(contextValue!.runtime).toBe(mockRuntime);
    });

    it("should set readOnly flag", () => {
      let contextValue: FlowEntityContextValue | undefined;

      function Consumer() {
        contextValue = useFlowEntityContext();
        return null;
      }

      render(
        <FlowEntityProvider readOnly={true}>
          <Consumer />
        </FlowEntityProvider>
      );

      expect(contextValue!.readOnly).toBe(true);
    });

    it("should set debug flag", () => {
      let contextValue: FlowEntityContextValue | undefined;

      function Consumer() {
        contextValue = useFlowEntityContext();
        return null;
      }

      render(
        <FlowEntityProvider debug={true}>
          <Consumer />
        </FlowEntityProvider>
      );

      expect(contextValue!.debug).toBe(true);
    });
  });

  // ===========================================================================
  // useFlowEntityContext
  // ===========================================================================

  describe("useFlowEntityContext", () => {
    it("should throw error when used outside provider", () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => useFlowEntityContext());
      }).toThrow("useFlowEntityContext must be used within a FlowEntityProvider");

      consoleSpy.mockRestore();
    });

    it("should return context when used inside provider", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowEntityProvider>{children}</FlowEntityProvider>
      );

      const { result } = renderHook(() => useFlowEntityContext(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.theme).toBeDefined();
      expect(result.current.portConfig).toBeDefined();
    });
  });

  // ===========================================================================
  // useOptionalFlowEntityContext
  // ===========================================================================

  describe("useOptionalFlowEntityContext", () => {
    it("should return undefined when used outside provider", () => {
      const { result } = renderHook(() => useOptionalFlowEntityContext());

      expect(result.current).toBeUndefined();
    });

    it("should return context when used inside provider", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowEntityProvider>{children}</FlowEntityProvider>
      );

      const { result } = renderHook(() => useOptionalFlowEntityContext(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current!.theme).toBeDefined();
    });
  });

  // ===========================================================================
  // Utility Hooks
  // ===========================================================================

  describe("useFlowTheme", () => {
    it("should return theme from context", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowEntityProvider theme={{ node: { backgroundColor: "#123456" } }}>
          {children}
        </FlowEntityProvider>
      );

      const { result } = renderHook(() => useFlowTheme(), { wrapper });

      expect(result.current.node.backgroundColor).toBe("#123456");
    });
  });

  describe("usePortConfig", () => {
    it("should return port config from context", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowEntityProvider portConfig={{ portSize: 15 }}>{children}</FlowEntityProvider>
      );

      const { result } = renderHook(() => usePortConfig(), { wrapper });

      expect(result.current.portSize).toBe(15);
    });
  });

  describe("useFlowReadOnly", () => {
    it("should return false by default", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowEntityProvider>{children}</FlowEntityProvider>
      );

      const { result } = renderHook(() => useFlowReadOnly(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("should return true when readOnly is set", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowEntityProvider readOnly={true}>{children}</FlowEntityProvider>
      );

      const { result } = renderHook(() => useFlowReadOnly(), { wrapper });

      expect(result.current).toBe(true);
    });
  });

  // ===========================================================================
  // Memoization
  // ===========================================================================

  describe("memoization", () => {
    it("should maintain stable context value when props do not change", () => {
      const contextValues: FlowEntityContextValue[] = [];

      function Consumer() {
        const ctx = useFlowEntityContext();
        contextValues.push(ctx);
        return null;
      }

      const { rerender } = render(
        <FlowEntityProvider>
          <Consumer />
        </FlowEntityProvider>
      );

      rerender(
        <FlowEntityProvider>
          <Consumer />
        </FlowEntityProvider>
      );

      // Context value should be the same reference if props haven't changed
      expect(contextValues[0]).toBe(contextValues[1]);
    });

    it("should update context value when props change", () => {
      const contextValues: FlowEntityContextValue[] = [];

      function Consumer() {
        const ctx = useFlowEntityContext();
        contextValues.push(ctx);
        return null;
      }

      const { rerender } = render(
        <FlowEntityProvider readOnly={false}>
          <Consumer />
        </FlowEntityProvider>
      );

      rerender(
        <FlowEntityProvider readOnly={true}>
          <Consumer />
        </FlowEntityProvider>
      );

      // Context value should be different when props change
      expect(contextValues[0]).not.toBe(contextValues[1]);
      expect(contextValues[0].readOnly).toBe(false);
      expect(contextValues[1].readOnly).toBe(true);
    });
  });
});
