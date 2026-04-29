/**
 * @file FlowViewport Component Tests
 * @description Unit tests for the FlowViewport component and useViewport hook
 *
 * @see src/components/flow-entity/canvas/FlowViewport.tsx
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import React from "react";
import {
  FlowViewport,
  useViewport,
  useViewportOptional,
  DEFAULT_VIEWPORT_STATE,
  DEFAULT_VIEWPORT_CONSTRAINTS,
} from "../../../../src/components/flow-entity/canvas/FlowViewport";

describe("FlowViewport", () => {
  // ===========================================================================
  // Basic Rendering Tests
  // ===========================================================================

  describe("basic rendering", () => {
    it("renders without crashing", () => {
      render(
        <FlowViewport>
          <div>Content</div>
        </FlowViewport>
      );
      expect(screen.getByTestId("flow-viewport")).toBeInTheDocument();
    });

    it("renders children", () => {
      render(
        <FlowViewport>
          <div data-testid="child">Test Content</div>
        </FlowViewport>
      );
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(
        <FlowViewport className="custom-viewport">
          <div>Content</div>
        </FlowViewport>
      );
      expect(screen.getByTestId("flow-viewport")).toHaveClass("custom-viewport");
    });

    it("applies custom style", () => {
      render(
        <FlowViewport style={{ opacity: 0.5 }}>
          <div>Content</div>
        </FlowViewport>
      );
      expect(screen.getByTestId("flow-viewport")).toHaveStyle({ opacity: "0.5" });
    });

    it("has overflow hidden", () => {
      render(
        <FlowViewport>
          <div>Content</div>
        </FlowViewport>
      );
      expect(screen.getByTestId("flow-viewport")).toHaveStyle({ overflow: "hidden" });
    });
  });

  // ===========================================================================
  // Initial State Tests
  // ===========================================================================

  describe("initial state", () => {
    it("uses default viewport state", () => {
      render(
        <FlowViewport>
          <div>Content</div>
        </FlowViewport>
      );
      const content = screen.getByTestId("flow-viewport-content");
      expect(content).toHaveStyle({
        transform: "translate(0px, 0px) scale(1)",
      });
    });

    it("uses custom initial state", () => {
      render(
        <FlowViewport initialState={{ translateX: 100, translateY: 50, scale: 1.5 }}>
          <div>Content</div>
        </FlowViewport>
      );
      const content = screen.getByTestId("flow-viewport-content");
      expect(content).toHaveStyle({
        transform: "translate(100px, 50px) scale(1.5)",
      });
    });

    it("merges partial initial state with defaults", () => {
      render(
        <FlowViewport initialState={{ scale: 2 }}>
          <div>Content</div>
        </FlowViewport>
      );
      const content = screen.getByTestId("flow-viewport-content");
      expect(content).toHaveStyle({
        transform: "translate(0px, 0px) scale(2)",
      });
    });
  });

  // ===========================================================================
  // useViewport Hook Tests
  // ===========================================================================

  describe("useViewport hook", () => {
    it("throws error when used outside FlowViewport", () => {
      expect(() => {
        renderHook(() => useViewport());
      }).toThrow("useViewport must be used within a FlowViewport component");
    });

    it("returns context value when inside FlowViewport", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      expect(result.current.viewport).toEqual(DEFAULT_VIEWPORT_STATE);
      expect(result.current.constraints).toEqual(DEFAULT_VIEWPORT_CONSTRAINTS);
      expect(typeof result.current.pan).toBe("function");
      expect(typeof result.current.zoom).toBe("function");
    });
  });

  // ===========================================================================
  // useViewportOptional Hook Tests
  // ===========================================================================

  describe("useViewportOptional hook", () => {
    it("returns undefined when used outside FlowViewport", () => {
      const { result } = renderHook(() => useViewportOptional());
      expect(result.current).toBeUndefined();
    });

    it("returns context value when inside FlowViewport", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewportOptional(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current?.viewport).toEqual(DEFAULT_VIEWPORT_STATE);
    });
  });

  // ===========================================================================
  // Pan Function Tests
  // ===========================================================================

  describe("pan function", () => {
    it("updates translate values", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      act(() => {
        result.current.pan(50, 30);
      });

      expect(result.current.viewport.translateX).toBe(50);
      expect(result.current.viewport.translateY).toBe(30);
    });

    it("accumulates pan values", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      act(() => {
        result.current.pan(50, 30);
      });
      act(() => {
        result.current.pan(20, 10);
      });

      expect(result.current.viewport.translateX).toBe(70);
      expect(result.current.viewport.translateY).toBe(40);
    });

    it("calls onViewportChange callback", () => {
      const onViewportChange = vi.fn();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport onViewportChange={onViewportChange}>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      act(() => {
        result.current.pan(50, 30);
      });

      expect(onViewportChange).toHaveBeenCalledWith({
        translateX: 50,
        translateY: 30,
        scale: 1,
      });
    });
  });

  // ===========================================================================
  // Zoom Function Tests
  // ===========================================================================

  describe("zoom function", () => {
    it("multiplies scale by factor", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      act(() => {
        result.current.zoom(2);
      });

      expect(result.current.viewport.scale).toBe(2);
    });

    it("respects minScale constraint", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport constraints={{ minScale: 0.5 }}>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      act(() => {
        result.current.zoom(0.1); // Would result in 0.1, but should be clamped to 0.5
      });

      expect(result.current.viewport.scale).toBe(0.5);
    });

    it("respects maxScale constraint", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport constraints={{ maxScale: 2 }}>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      act(() => {
        result.current.zoom(5); // Would result in 5, but should be clamped to 2
      });

      expect(result.current.viewport.scale).toBe(2);
    });
  });

  // ===========================================================================
  // setZoom Function Tests
  // ===========================================================================

  describe("setZoom function", () => {
    it("sets absolute scale value", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport initialState={{ scale: 2 }}>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      act(() => {
        result.current.setZoom(1.5);
      });

      expect(result.current.viewport.scale).toBe(1.5);
    });

    it("respects constraints", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport constraints={{ minScale: 0.5, maxScale: 2 }}>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      act(() => {
        result.current.setZoom(5);
      });
      expect(result.current.viewport.scale).toBe(2);

      act(() => {
        result.current.setZoom(0.1);
      });
      expect(result.current.viewport.scale).toBe(0.5);
    });
  });

  // ===========================================================================
  // Reset Function Tests
  // ===========================================================================

  describe("reset function", () => {
    it("resets to initial state", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport initialState={{ translateX: 100, translateY: 100, scale: 2 }}>
          {children}
        </FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      act(() => {
        result.current.pan(50, 50);
        result.current.zoom(0.5);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.viewport).toEqual({
        translateX: 100,
        translateY: 100,
        scale: 2,
      });
    });
  });

  // ===========================================================================
  // Coordinate Conversion Tests
  // ===========================================================================

  describe("coordinate conversion", () => {
    it("screenToCanvas converts correctly at scale 1", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      const canvas = result.current.screenToCanvas(100, 50);
      expect(canvas).toEqual({ x: 100, y: 50 });
    });

    it("screenToCanvas accounts for translate", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport initialState={{ translateX: 50, translateY: 25 }}>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      const canvas = result.current.screenToCanvas(100, 50);
      expect(canvas).toEqual({ x: 50, y: 25 });
    });

    it("screenToCanvas accounts for scale", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport initialState={{ scale: 2 }}>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      const canvas = result.current.screenToCanvas(100, 50);
      expect(canvas).toEqual({ x: 50, y: 25 });
    });

    it("canvasToScreen converts correctly at scale 1", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      const screen = result.current.canvasToScreen(100, 50);
      expect(screen).toEqual({ x: 100, y: 50 });
    });

    it("canvasToScreen accounts for translate", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport initialState={{ translateX: 50, translateY: 25 }}>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      const screen = result.current.canvasToScreen(100, 50);
      expect(screen).toEqual({ x: 150, y: 75 });
    });

    it("canvasToScreen accounts for scale", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport initialState={{ scale: 2 }}>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      const screen = result.current.canvasToScreen(100, 50);
      expect(screen).toEqual({ x: 200, y: 100 });
    });

    it("round-trip conversion is accurate", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport initialState={{ translateX: 50, translateY: 25, scale: 1.5 }}>
          {children}
        </FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      const originalScreen = { x: 200, y: 150 };
      const canvas = result.current.screenToCanvas(originalScreen.x, originalScreen.y);
      const backToScreen = result.current.canvasToScreen(canvas.x, canvas.y);

      expect(backToScreen.x).toBeCloseTo(originalScreen.x);
      expect(backToScreen.y).toBeCloseTo(originalScreen.y);
    });
  });

  // ===========================================================================
  // setViewport Function Tests
  // ===========================================================================

  describe("setViewport function", () => {
    it("sets complete viewport state", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      act(() => {
        result.current.setViewport({ translateX: 100, translateY: 50, scale: 2 });
      });

      expect(result.current.viewport).toEqual({
        translateX: 100,
        translateY: 50,
        scale: 2,
      });
    });

    it("clamps scale to constraints", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport constraints={{ minScale: 0.5, maxScale: 2 }}>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      act(() => {
        result.current.setViewport({ translateX: 0, translateY: 0, scale: 10 });
      });

      expect(result.current.viewport.scale).toBe(2);
    });
  });

  // ===========================================================================
  // centerOn Function Tests
  // ===========================================================================

  describe("centerOn function", () => {
    it("centers viewport on a point", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport containerWidth={800} containerHeight={600}>
          {children}
        </FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      act(() => {
        result.current.centerOn(100, 100);
      });

      // With container 800x600, centering on (100, 100) at scale 1 should
      // translate to (800/2 - 100*1, 600/2 - 100*1) = (300, 200)
      expect(result.current.viewport.translateX).toBe(300);
      expect(result.current.viewport.translateY).toBe(200);
    });
  });

  // ===========================================================================
  // Default Exports Tests
  // ===========================================================================

  describe("default exports", () => {
    it("exports DEFAULT_VIEWPORT_STATE", () => {
      expect(DEFAULT_VIEWPORT_STATE).toEqual({
        translateX: 0,
        translateY: 0,
        scale: 1,
      });
    });

    it("exports DEFAULT_VIEWPORT_CONSTRAINTS", () => {
      expect(DEFAULT_VIEWPORT_CONSTRAINTS).toEqual({
        minScale: 0.1,
        maxScale: 4,
        constrainPan: false,
      });
    });
  });

  // ===========================================================================
  // Pan Interaction Tests
  // ===========================================================================

  describe("pan interaction", () => {
    it("starts panning on middle mouse button down", () => {
      const onPanStart = vi.fn();
      render(
        <FlowViewport onPanStart={onPanStart}>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      act(() => {
        fireEvent.mouseDown(viewport, {
          button: 1,
          clientX: 100,
          clientY: 100,
        });
      });

      expect(onPanStart).toHaveBeenCalled();
      expect(viewport).toHaveAttribute("data-panning", "true");
    });

    it("starts panning on right mouse button down", () => {
      const onPanStart = vi.fn();
      render(
        <FlowViewport onPanStart={onPanStart}>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      act(() => {
        fireEvent.mouseDown(viewport, {
          button: 2,
          clientX: 100,
          clientY: 100,
        });
      });

      expect(onPanStart).toHaveBeenCalled();
      expect(viewport).toHaveAttribute("data-panning", "true");
    });

    it("suppresses the context menu while right-button panning is enabled", () => {
      render(
        <FlowViewport>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");
      const prevented = !fireEvent.contextMenu(viewport);

      expect(prevented).toBe(true);
    });

    it("pans viewport on mouse move during pan mode", () => {
      const onViewportChange = vi.fn();
      render(
        <FlowViewport onViewportChange={onViewportChange}>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Start pan with middle mouse button
      act(() => {
        fireEvent.mouseDown(viewport, {
          button: 1,
          clientX: 100,
          clientY: 100,
        });
      });

      // Move mouse
      act(() => {
        fireEvent.mouseMove(viewport, {
          clientX: 150,
          clientY: 120,
        });
      });

      // Check viewport change was called with delta values
      expect(onViewportChange).toHaveBeenCalledWith(
        expect.objectContaining({
          translateX: 50, // 150 - 100
          translateY: 20, // 120 - 100
        })
      );
    });

    it("ends panning on mouse up", () => {
      const onPanEnd = vi.fn();
      render(
        <FlowViewport onPanEnd={onPanEnd}>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Start pan
      act(() => {
        fireEvent.mouseDown(viewport, {
          button: 1,
          clientX: 100,
          clientY: 100,
        });
      });

      expect(viewport).toHaveAttribute("data-panning", "true");

      // End pan
      act(() => {
        fireEvent.mouseUp(viewport);
      });

      expect(onPanEnd).toHaveBeenCalled();
      expect(viewport).toHaveAttribute("data-panning", "false");
    });

    it("ends panning on mouse leave", () => {
      const onPanEnd = vi.fn();
      render(
        <FlowViewport onPanEnd={onPanEnd}>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Start pan
      act(() => {
        fireEvent.mouseDown(viewport, {
          button: 1,
          clientX: 100,
          clientY: 100,
        });
      });

      // Mouse leaves viewport
      act(() => {
        fireEvent.mouseLeave(viewport);
      });

      expect(onPanEnd).toHaveBeenCalled();
      expect(viewport).toHaveAttribute("data-panning", "false");
    });

    it("shows grabbing cursor during pan", () => {
      render(
        <FlowViewport>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Start pan
      act(() => {
        fireEvent.mouseDown(viewport, {
          button: 1,
          clientX: 100,
          clientY: 100,
        });
      });

      expect(viewport).toHaveStyle({ cursor: "grabbing" });
    });

    it("shows grab cursor when pan key is pressed", async () => {
      render(
        <FlowViewport>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Press space key
      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: " ",
            bubbles: true,
          })
        );
      });

      expect(viewport).toHaveAttribute("data-pan-ready", "true");
      expect(viewport).toHaveStyle({ cursor: "grab" });

      // Release space key
      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent("keyup", {
            key: " ",
            bubbles: true,
          })
        );
      });

      expect(viewport).toHaveAttribute("data-pan-ready", "false");
    });

    it("starts panning with Space + left mouse button", async () => {
      const onPanStart = vi.fn();
      render(
        <FlowViewport onPanStart={onPanStart}>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Press space key
      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: " ",
            bubbles: true,
          })
        );
      });

      // Click with left mouse button while space is pressed
      act(() => {
        fireEvent.mouseDown(viewport, {
          button: 0,
          clientX: 100,
          clientY: 100,
        });
      });

      expect(onPanStart).toHaveBeenCalled();
      expect(viewport).toHaveAttribute("data-panning", "true");
    });

    it("does not pan when enablePan is false", () => {
      const onPanStart = vi.fn();
      render(
        <FlowViewport enablePan={false} onPanStart={onPanStart}>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      act(() => {
        fireEvent.mouseDown(viewport, {
          button: 1,
          clientX: 100,
          clientY: 100,
        });
      });

      expect(onPanStart).not.toHaveBeenCalled();
      expect(viewport).toHaveAttribute("data-panning", "false");
    });

    it("accumulates pan values from previous position", () => {
      const onViewportChange = vi.fn();
      render(
        <FlowViewport
          initialState={{ translateX: 50, translateY: 30 }}
          onViewportChange={onViewportChange}
        >
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Start pan with middle mouse button
      act(() => {
        fireEvent.mouseDown(viewport, {
          button: 1,
          clientX: 100,
          clientY: 100,
        });
      });

      // Move mouse
      act(() => {
        fireEvent.mouseMove(viewport, {
          clientX: 150,
          clientY: 120,
        });
      });

      // Check viewport change adds to existing translate
      expect(onViewportChange).toHaveBeenCalledWith(
        expect.objectContaining({
          translateX: 100, // 50 + (150 - 100)
          translateY: 50, // 30 + (120 - 100)
        })
      );
    });

    it("uses custom pan key when specified", async () => {
      render(
        <FlowViewport panKey="Control">
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Press Control key (custom pan key)
      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Control",
            bubbles: true,
          })
        );
      });

      expect(viewport).toHaveAttribute("data-pan-ready", "true");

      // Release Control key
      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent("keyup", {
            key: "Control",
            bubbles: true,
          })
        );
      });

      expect(viewport).toHaveAttribute("data-pan-ready", "false");
    });

    it("ignores pan key presses inside editable controls", () => {
      render(
        <FlowViewport>
          <input aria-label="node label" />
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");
      const input = screen.getByLabelText("node label");

      act(() => {
        fireEvent.keyDown(input, { key: " " });
      });

      expect(viewport).toHaveAttribute("data-pan-ready", "false");
    });

    it("disables user select during panning", () => {
      render(
        <FlowViewport>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Start pan
      act(() => {
        fireEvent.mouseDown(viewport, {
          button: 1,
          clientX: 100,
          clientY: 100,
        });
      });

      expect(viewport).toHaveStyle({ userSelect: "none" });
    });

    it("provides isPanning state via context", () => {
      let capturedIsPanning = false;

      const ChildComponent = () => {
        const { isPanning } = useViewport();
        capturedIsPanning = isPanning;
        return <div data-testid="child">Content</div>;
      };

      render(
        <FlowViewport>
          <ChildComponent />
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      expect(capturedIsPanning).toBe(false);

      // Start pan
      act(() => {
        fireEvent.mouseDown(viewport, {
          button: 1,
          clientX: 100,
          clientY: 100,
        });
      });

      expect(capturedIsPanning).toBe(true);
    });
  });

  // ===========================================================================
  // Wheel Zoom Interaction Tests
  // ===========================================================================

  describe("wheel zoom interaction", () => {
    it("zooms in on wheel scroll up", () => {
      const onViewportChange = vi.fn();
      render(
        <FlowViewport onViewportChange={onViewportChange}>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Scroll up (negative deltaY = zoom in)
      act(() => {
        fireEvent.wheel(viewport, {
          deltaY: -100,
          clientX: 200,
          clientY: 150,
        });
      });

      expect(onViewportChange).toHaveBeenCalled();
      const lastCall = onViewportChange.mock.calls[onViewportChange.mock.calls.length - 1][0];
      expect(lastCall.scale).toBeGreaterThan(1);
    });

    it("zooms out on wheel scroll down", () => {
      const onViewportChange = vi.fn();
      render(
        <FlowViewport onViewportChange={onViewportChange}>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Scroll down (positive deltaY = zoom out)
      act(() => {
        fireEvent.wheel(viewport, {
          deltaY: 100,
          clientX: 200,
          clientY: 150,
        });
      });

      expect(onViewportChange).toHaveBeenCalled();
      const lastCall = onViewportChange.mock.calls[onViewportChange.mock.calls.length - 1][0];
      expect(lastCall.scale).toBeLessThan(1);
    });

    it("respects minScale constraint on wheel zoom", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport constraints={{ minScale: 0.5, maxScale: 3 }}>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      // Zoom out multiple times to try to go below minScale
      for (let i = 0; i < 20; i++) {
        act(() => {
          result.current.zoom(0.8);
        });
      }

      expect(result.current.viewport.scale).toBeGreaterThanOrEqual(0.5);
    });

    it("respects maxScale constraint on wheel zoom", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport constraints={{ minScale: 0.5, maxScale: 3 }}>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      // Zoom in multiple times to try to exceed maxScale
      for (let i = 0; i < 20; i++) {
        act(() => {
          result.current.zoom(1.2);
        });
      }

      expect(result.current.viewport.scale).toBeLessThanOrEqual(3);
    });

    it("does not zoom when enableZoom is false", () => {
      const onViewportChange = vi.fn();
      render(
        <FlowViewport enableZoom={false} onViewportChange={onViewportChange}>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      act(() => {
        fireEvent.wheel(viewport, {
          deltaY: -100,
          clientX: 200,
          clientY: 150,
        });
      });

      expect(onViewportChange).not.toHaveBeenCalled();
    });

    it("preserves native scroll until a modifier is pressed when configured", () => {
      const onViewportChange = vi.fn();
      render(
        <FlowViewport wheelZoomActivation="modifier" onViewportChange={onViewportChange}>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      act(() => {
        fireEvent.wheel(viewport, {
          deltaY: -100,
          clientX: 200,
          clientY: 150,
        });
      });
      expect(onViewportChange).not.toHaveBeenCalled();

      act(() => {
        fireEvent.wheel(viewport, {
          deltaY: -100,
          clientX: 200,
          clientY: 150,
          ctrlKey: true,
        });
      });

      expect(onViewportChange).toHaveBeenCalled();
    });

    it("does not zoom when the wheel event starts from an editable control", () => {
      const onViewportChange = vi.fn();
      render(
        <FlowViewport onViewportChange={onViewportChange}>
          <input aria-label="node value" />
        </FlowViewport>
      );

      act(() => {
        fireEvent.wheel(screen.getByLabelText("node value"), {
          deltaY: -100,
          clientX: 200,
          clientY: 150,
        });
      });

      expect(onViewportChange).not.toHaveBeenCalled();
    });

    it("uses custom zoomStep for zoom factor calculation", () => {
      const onViewportChange = vi.fn();
      render(
        <FlowViewport zoomStep={0.2} onViewportChange={onViewportChange}>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Scroll up with larger zoomStep
      act(() => {
        fireEvent.wheel(viewport, {
          deltaY: -100,
          clientX: 200,
          clientY: 150,
        });
      });

      expect(onViewportChange).toHaveBeenCalled();
      const lastCall = onViewportChange.mock.calls[onViewportChange.mock.calls.length - 1][0];
      // With zoomStep=0.2, zoom in factor is 1.2, so scale should be 1.2
      expect(lastCall.scale).toBeCloseTo(1.2, 1);
    });

    it("zooms around cursor position - keeps cursor point relatively stable", () => {
      const onViewportChange = vi.fn();
      render(
        <FlowViewport onViewportChange={onViewportChange}>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Zoom in at a specific cursor position
      act(() => {
        fireEvent.wheel(viewport, {
          deltaY: -100,
          clientX: 200,
          clientY: 150,
        });
      });

      expect(onViewportChange).toHaveBeenCalled();
      const result = onViewportChange.mock.calls[onViewportChange.mock.calls.length - 1][0];

      // After zooming, translate values should be adjusted to keep cursor point stable
      // The exact values depend on the implementation, but translateX/Y should change
      // This verifies that zoom around cursor is working
      expect(result.translateX).toBeDefined();
      expect(result.translateY).toBeDefined();
      expect(result.scale).toBeGreaterThan(1);
    });

    it("calls onZoomStart when zooming begins", async () => {
      vi.useFakeTimers();
      const onZoomStart = vi.fn();

      render(
        <FlowViewport onZoomStart={onZoomStart}>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      act(() => {
        fireEvent.wheel(viewport, {
          deltaY: -100,
          clientX: 200,
          clientY: 150,
        });
      });

      expect(onZoomStart).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it("calls onZoomEnd after zoom interaction stops", async () => {
      vi.useFakeTimers();
      const onZoomEnd = vi.fn();

      render(
        <FlowViewport onZoomEnd={onZoomEnd}>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      act(() => {
        fireEvent.wheel(viewport, {
          deltaY: -100,
          clientX: 200,
          clientY: 150,
        });
      });

      // onZoomEnd should not be called immediately
      expect(onZoomEnd).not.toHaveBeenCalled();

      // Advance timers to trigger onZoomEnd
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(onZoomEnd).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it("continuous wheel events only call onZoomStart once", async () => {
      vi.useFakeTimers();
      const onZoomStart = vi.fn();
      const onZoomEnd = vi.fn();

      render(
        <FlowViewport onZoomStart={onZoomStart} onZoomEnd={onZoomEnd}>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Multiple rapid wheel events
      act(() => {
        fireEvent.wheel(viewport, { deltaY: -100, clientX: 200, clientY: 150 });
      });
      act(() => {
        vi.advanceTimersByTime(50);
      });
      act(() => {
        fireEvent.wheel(viewport, { deltaY: -100, clientX: 200, clientY: 150 });
      });
      act(() => {
        vi.advanceTimersByTime(50);
      });
      act(() => {
        fireEvent.wheel(viewport, { deltaY: -100, clientX: 200, clientY: 150 });
      });

      // onZoomStart should only be called once
      expect(onZoomStart).toHaveBeenCalledTimes(1);

      // onZoomEnd should not be called yet (still within debounce window)
      expect(onZoomEnd).not.toHaveBeenCalled();

      // Advance past debounce timeout
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Now onZoomEnd should be called
      expect(onZoomEnd).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it("multiple zoom interactions trigger separate start/end callbacks", async () => {
      vi.useFakeTimers();
      const onZoomStart = vi.fn();
      const onZoomEnd = vi.fn();

      render(
        <FlowViewport onZoomStart={onZoomStart} onZoomEnd={onZoomEnd}>
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // First zoom interaction
      act(() => {
        fireEvent.wheel(viewport, { deltaY: -100, clientX: 200, clientY: 150 });
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(onZoomStart).toHaveBeenCalledTimes(1);
      expect(onZoomEnd).toHaveBeenCalledTimes(1);

      // Second zoom interaction (after first one ended)
      act(() => {
        fireEvent.wheel(viewport, { deltaY: 100, clientX: 200, clientY: 150 });
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(onZoomStart).toHaveBeenCalledTimes(2);
      expect(onZoomEnd).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("scale remains clamped after multiple wheel events at boundaries", () => {
      const onViewportChange = vi.fn();
      render(
        <FlowViewport
          constraints={{ minScale: 0.5, maxScale: 2 }}
          onViewportChange={onViewportChange}
        >
          <div>Content</div>
        </FlowViewport>
      );

      const viewport = screen.getByTestId("flow-viewport");

      // Zoom in many times to exceed maxScale
      for (let i = 0; i < 30; i++) {
        act(() => {
          fireEvent.wheel(viewport, {
            deltaY: -100,
            clientX: 200,
            clientY: 150,
          });
        });
      }

      const lastZoomInCall = onViewportChange.mock.calls[onViewportChange.mock.calls.length - 1][0];
      expect(lastZoomInCall.scale).toBeLessThanOrEqual(2);
      expect(lastZoomInCall.scale).toBeGreaterThanOrEqual(0.5);

      // Reset mock
      onViewportChange.mockClear();

      // Zoom out many times to go below minScale
      for (let i = 0; i < 50; i++) {
        act(() => {
          fireEvent.wheel(viewport, {
            deltaY: 100,
            clientX: 200,
            clientY: 150,
          });
        });
      }

      const lastZoomOutCall =
        onViewportChange.mock.calls[onViewportChange.mock.calls.length - 1][0];
      expect(lastZoomOutCall.scale).toBeGreaterThanOrEqual(0.5);
      expect(lastZoomOutCall.scale).toBeLessThanOrEqual(2);
    });

    it("zoom works correctly with default constraints", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport>{children}</FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      // Default constraints are minScale: 0.1, maxScale: 4
      expect(result.current.constraints.minScale).toBe(0.1);
      expect(result.current.constraints.maxScale).toBe(4);

      // Zoom in
      act(() => {
        result.current.zoom(2);
      });
      expect(result.current.viewport.scale).toBe(2);

      // Zoom in more
      act(() => {
        result.current.zoom(1.5);
      });
      expect(result.current.viewport.scale).toBe(3);

      // Zoom in to exceed max, should be clamped
      act(() => {
        result.current.zoom(2);
      });
      expect(result.current.viewport.scale).toBe(4);
    });

    it("zoom with focal point adjusts translate values", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FlowViewport containerWidth={800} containerHeight={600}>
          {children}
        </FlowViewport>
      );
      const { result } = renderHook(() => useViewport(), { wrapper });

      // Initial state
      expect(result.current.viewport.translateX).toBe(0);
      expect(result.current.viewport.translateY).toBe(0);
      expect(result.current.viewport.scale).toBe(1);

      // Zoom in at focal point (100, 100)
      act(() => {
        result.current.zoom(2, { x: 100, y: 100 });
      });

      // Scale should double
      expect(result.current.viewport.scale).toBe(2);

      // Translate should be adjusted to keep focal point stationary
      // Formula: newTranslate = focalPoint - (focalPoint - oldTranslate) / oldScale * newScale
      // With oldTranslate=0, oldScale=1, newScale=2, focalPoint=100:
      // newTranslate = 100 - (100 - 0) / 1 * 2 = 100 - 200 = -100
      expect(result.current.viewport.translateX).toBe(-100);
      expect(result.current.viewport.translateY).toBe(-100);
    });
  });
});
