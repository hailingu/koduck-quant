/**
 * @file ExecutionStateProvider unit tests
 * @description Tests for ExecutionStateProvider React context including
 * provider functionality, hooks, and engine integration.
 *
 * @see docs/design/flow-entity-step-plan-en.md Phase 3 - Task 3.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import React from "react";

import {
  ExecutionStateProvider,
  ExecutionStateContext,
  useExecutionStateContext,
  useExecutionStateContextOptional,
  useExecutionStateManager,
  ExecutionStateManager,
} from "../../../../src/components/flow-entity/execution";
import type { ExecutionState } from "../../../../src/components/flow-entity/types";

// =============================================================================
// Test Components
// =============================================================================

/**
 * Test component that uses the context
 */
function TestConsumer({ entityId }: { entityId: string }): React.JSX.Element {
  const context = useExecutionStateContext();
  const state = context.getState(entityId);
  const progress = context.getProgress(entityId);

  return (
    <div>
      <span data-testid="state">{state}</span>
      <span data-testid="progress">{progress ?? "none"}</span>
    </div>
  );
}

/**
 * Test component that uses optional context
 */
function TestOptionalConsumer(): React.JSX.Element {
  const context = useExecutionStateContextOptional();
  return <span data-testid="has-context">{context ? "yes" : "no"}</span>;
}

/**
 * Test component that accesses manager directly
 */
function TestManagerConsumer(): React.JSX.Element {
  const manager = useExecutionStateManager();
  return <span data-testid="has-manager">{manager ? "yes" : "no"}</span>;
}

/**
 * Test component that subscribes to state changes
 */
function TestSubscriber({
  entityId,
  onStateChange,
}: {
  entityId: string;
  onStateChange: (state: ExecutionState, prev: ExecutionState) => void;
}): React.JSX.Element {
  const context = useExecutionStateContext();

  React.useEffect(() => {
    return context.subscribe(entityId, onStateChange);
  }, [entityId, context, onStateChange]);

  return <span data-testid="subscriber">subscribed</span>;
}

// =============================================================================
// Tests
// =============================================================================

describe("ExecutionStateProvider", () => {
  afterEach(() => {
    cleanup();
  });

  // ===========================================================================
  // Provider Rendering
  // ===========================================================================

  describe("rendering", () => {
    it("should render children", () => {
      render(
        <ExecutionStateProvider>
          <div data-testid="child">Child content</div>
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByTestId("child")).toHaveTextContent("Child content");
    });

    it("should provide context to children", () => {
      render(
        <ExecutionStateProvider>
          <TestOptionalConsumer />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("has-context")).toHaveTextContent("yes");
    });
  });

  // ===========================================================================
  // Context Value
  // ===========================================================================

  describe("context value", () => {
    it("should provide getState function", () => {
      render(
        <ExecutionStateProvider>
          <TestConsumer entityId="entity-1" />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("state")).toHaveTextContent("idle");
    });

    it("should provide setState function", () => {
      let contextRef: ReturnType<typeof useExecutionStateContext> | null = null;

      const TestComponent = (): React.JSX.Element => {
        const context = useExecutionStateContext();
        contextRef = context;
        const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

        React.useEffect(() => {
          return context.subscribe("entity-1", () => forceUpdate());
        }, [context]);

        return <span data-testid="state">{context.getState("entity-1")}</span>;
      };

      render(
        <ExecutionStateProvider>
          <TestComponent />
        </ExecutionStateProvider>
      );

      // Initially idle
      expect(screen.getByTestId("state")).toHaveTextContent("idle");

      // Update state using act
      act(() => {
        contextRef?.setState("entity-1", "running");
      });

      expect(screen.getByTestId("state")).toHaveTextContent("running");
    });

    it("should provide progress functions", () => {
      let contextRef: ReturnType<typeof useExecutionStateContext> | null = null;

      const TestComponent = (): React.JSX.Element => {
        const context = useExecutionStateContext();
        contextRef = context;
        const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

        React.useEffect(() => {
          return context.subscribeProgress("entity-1", () => forceUpdate());
        }, [context]);

        return <span data-testid="progress">{context.getProgress("entity-1") ?? ""}</span>;
      };

      render(
        <ExecutionStateProvider>
          <TestComponent />
        </ExecutionStateProvider>
      );

      // Initially no progress
      expect(screen.getByTestId("progress")).toHaveTextContent("");

      // Set progress using act
      act(() => {
        contextRef?.setProgress("entity-1", 75);
      });

      expect(screen.getByTestId("progress")).toHaveTextContent("75");
    });

    it("should provide isExecuting function", () => {
      const TestComponent = (): React.JSX.Element => {
        const context = useExecutionStateContext();
        context.setState("entity-1", "running");
        return (
          <span data-testid="executing">{context.isExecuting("entity-1") ? "yes" : "no"}</span>
        );
      };

      render(
        <ExecutionStateProvider>
          <TestComponent />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("executing")).toHaveTextContent("yes");
    });

    it("should provide isCompleted function", () => {
      const TestComponent = (): React.JSX.Element => {
        const context = useExecutionStateContext();
        context.setState("entity-1", "success");
        return (
          <span data-testid="completed">{context.isCompleted("entity-1") ? "yes" : "no"}</span>
        );
      };

      render(
        <ExecutionStateProvider>
          <TestComponent />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("completed")).toHaveTextContent("yes");
    });

    it("should provide getEntityInfo function", () => {
      const TestComponent = (): React.JSX.Element => {
        const context = useExecutionStateContext();
        context.setState("entity-1", "running");
        const info = context.getEntityInfo("entity-1");
        return (
          <div>
            <span data-testid="info-state">{info.state}</span>
            <span data-testid="info-updated">{info.updatedAt > 0 ? "yes" : "no"}</span>
          </div>
        );
      };

      render(
        <ExecutionStateProvider>
          <TestComponent />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("info-state")).toHaveTextContent("running");
      expect(screen.getByTestId("info-updated")).toHaveTextContent("yes");
    });

    it("should provide reset functions", () => {
      const TestComponent = (): React.JSX.Element => {
        const context = useExecutionStateContext();

        React.useEffect(() => {
          context.setState("entity-1", "running");
          context.resetState("entity-1");
        }, [context]);

        return <span data-testid="state">{context.getState("entity-1")}</span>;
      };

      render(
        <ExecutionStateProvider>
          <TestComponent />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("state")).toHaveTextContent("idle");
    });

    it("should provide getStateCounts function", () => {
      const TestComponent = (): React.JSX.Element => {
        const context = useExecutionStateContext();
        context.setState("entity-1", "running");
        context.setState("entity-2", "running");
        const counts = context.getStateCounts();
        return <span data-testid="running-count">{counts.running}</span>;
      };

      render(
        <ExecutionStateProvider>
          <TestComponent />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("running-count")).toHaveTextContent("2");
    });
  });

  // ===========================================================================
  // Configuration
  // ===========================================================================

  describe("configuration", () => {
    it("should accept custom configuration", () => {
      const TestComponent = (): React.JSX.Element => {
        const context = useExecutionStateContext();
        return <span data-testid="state">{context.getState("unknown")}</span>;
      };

      render(
        <ExecutionStateProvider config={{ defaultState: "pending" }}>
          <TestComponent />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("state")).toHaveTextContent("pending");
    });

    it("should accept external manager", () => {
      const externalManager = new ExecutionStateManager();
      externalManager.setState("entity-1", "success");

      render(
        <ExecutionStateProvider manager={externalManager}>
          <TestConsumer entityId="entity-1" />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("state")).toHaveTextContent("success");

      // Cleanup external manager
      externalManager.dispose();
    });
  });

  // ===========================================================================
  // Engine Integration
  // ===========================================================================

  describe("engine integration", () => {
    it("should connect to engine when provided", () => {
      const mockStartHandler = vi.fn();
      const mockFinishHandler = vi.fn();

      const mockEngine = {
        onEntityStart: {
          on: vi.fn((handler) => {
            mockStartHandler.mockImplementation(handler);
            return vi.fn();
          }),
        },
        onEntityFinish: {
          on: vi.fn((handler) => {
            mockFinishHandler.mockImplementation(handler);
            return vi.fn();
          }),
        },
      };

      // Use a component that subscribes to state changes
      const TestComponent = (): React.JSX.Element => {
        const context = useExecutionStateContext();
        const [state, setState] = React.useState<ExecutionState>(() =>
          context.getState("entity-1")
        );

        React.useEffect(() => {
          return context.subscribe("entity-1", (newState) => {
            setState(newState);
          });
        }, [context]);

        return <span data-testid="state">{state}</span>;
      };

      render(
        <ExecutionStateProvider engine={mockEngine}>
          <TestComponent />
        </ExecutionStateProvider>
      );

      // Initially idle
      expect(screen.getByTestId("state")).toHaveTextContent("idle");

      // Simulate engine event
      act(() => {
        mockStartHandler({ entityId: "entity-1", type: "node" });
      });

      expect(screen.getByTestId("state")).toHaveTextContent("running");
    });

    it("should provide createEngineHandlers function", () => {
      const TestComponent = (): React.JSX.Element => {
        const context = useExecutionStateContext();
        const handlers = context.createEngineHandlers();
        return (
          <div>
            <span data-testid="has-start">
              {typeof handlers.onEntityStart === "function" ? "yes" : "no"}
            </span>
            <span data-testid="has-finish">
              {typeof handlers.onEntityFinish === "function" ? "yes" : "no"}
            </span>
          </div>
        );
      };

      render(
        <ExecutionStateProvider>
          <TestComponent />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("has-start")).toHaveTextContent("yes");
      expect(screen.getByTestId("has-finish")).toHaveTextContent("yes");
    });
  });

  // ===========================================================================
  // Subscriptions
  // ===========================================================================

  describe("subscriptions", () => {
    it("should support subscribe function", () => {
      const onStateChange = vi.fn();

      const TestComponent = (): React.JSX.Element => {
        const context = useExecutionStateContext();

        React.useEffect(() => {
          const unsubscribe = context.subscribe("entity-1", onStateChange);
          context.setState("entity-1", "running");
          return unsubscribe;
        }, [context]);

        return <span data-testid="test">test</span>;
      };

      render(
        <ExecutionStateProvider>
          <TestComponent />
        </ExecutionStateProvider>
      );

      expect(onStateChange).toHaveBeenCalledWith("running", "idle");
    });

    it("should support subscribeAll function", () => {
      const onStateChange = vi.fn();

      const TestComponent = (): React.JSX.Element => {
        const context = useExecutionStateContext();

        React.useEffect(() => {
          const unsubscribe = context.subscribeAll(onStateChange);
          context.setState("entity-1", "running");
          context.setState("entity-2", "pending");
          return unsubscribe;
        }, [context]);

        return <span data-testid="test">test</span>;
      };

      render(
        <ExecutionStateProvider>
          <TestComponent />
        </ExecutionStateProvider>
      );

      expect(onStateChange).toHaveBeenCalledTimes(2);
    });

    it("should support subscribeProgress function", () => {
      const onProgressChange = vi.fn();

      const TestComponent = (): React.JSX.Element => {
        const context = useExecutionStateContext();

        React.useEffect(() => {
          const unsubscribe = context.subscribeProgress("entity-1", onProgressChange);
          context.setProgress("entity-1", 50);
          return unsubscribe;
        }, [context]);

        return <span data-testid="test">test</span>;
      };

      render(
        <ExecutionStateProvider>
          <TestComponent />
        </ExecutionStateProvider>
      );

      expect(onProgressChange).toHaveBeenCalledWith(50, "entity-1");
    });
  });

  // ===========================================================================
  // Snapshot
  // ===========================================================================

  describe("snapshot", () => {
    it("should provide createSnapshot function", () => {
      const TestComponent = (): React.JSX.Element => {
        const context = useExecutionStateContext();
        context.setState("entity-1", "running");
        const snapshot = context.createSnapshot();
        return (
          <div>
            <span data-testid="snapshot-size">{snapshot.entities.size}</span>
            <span data-testid="snapshot-timestamp">{snapshot.timestamp > 0 ? "yes" : "no"}</span>
          </div>
        );
      };

      render(
        <ExecutionStateProvider>
          <TestComponent />
        </ExecutionStateProvider>
      );

      expect(screen.getByTestId("snapshot-size")).toHaveTextContent("1");
      expect(screen.getByTestId("snapshot-timestamp")).toHaveTextContent("yes");
    });
  });

  // ===========================================================================
  // Hooks
  // ===========================================================================

  describe("useExecutionStateContext", () => {
    it("should throw when used outside provider", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer entityId="test" />);
      }).toThrow("useExecutionStateContext must be used within an ExecutionStateProvider");

      consoleError.mockRestore();
    });
  });

  describe("useExecutionStateContextOptional", () => {
    it("should return null when used outside provider", () => {
      render(<TestOptionalConsumer />);
      expect(screen.getByTestId("has-context")).toHaveTextContent("no");
    });

    it("should return context when used inside provider", () => {
      render(
        <ExecutionStateProvider>
          <TestOptionalConsumer />
        </ExecutionStateProvider>
      );
      expect(screen.getByTestId("has-context")).toHaveTextContent("yes");
    });
  });

  describe("useExecutionStateManager", () => {
    it("should return null when used outside provider", () => {
      render(<TestManagerConsumer />);
      expect(screen.getByTestId("has-manager")).toHaveTextContent("no");
    });

    it("should return manager when used inside provider", () => {
      render(
        <ExecutionStateProvider>
          <TestManagerConsumer />
        </ExecutionStateProvider>
      );
      expect(screen.getByTestId("has-manager")).toHaveTextContent("yes");
    });
  });

  // ===========================================================================
  // Multiple Subscribers
  // ===========================================================================

  describe("multiple subscribers", () => {
    it("should notify multiple components subscribing to same entity", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const TestComponent = (): React.JSX.Element => {
        const context = useExecutionStateContext();

        React.useEffect(() => {
          const unsub1 = context.subscribe("entity-1", listener1);
          const unsub2 = context.subscribe("entity-1", listener2);
          context.setState("entity-1", "running");
          return () => {
            unsub1();
            unsub2();
          };
        }, [context]);

        return <span data-testid="test">test</span>;
      };

      render(
        <ExecutionStateProvider>
          <TestComponent />
        </ExecutionStateProvider>
      );

      expect(listener1).toHaveBeenCalledWith("running", "idle");
      expect(listener2).toHaveBeenCalledWith("running", "idle");
    });
  });
});
