/**
 * @file ExecutionStateProvider
 * @description React context provider for ExecutionStateManager.
 * Provides centralized execution state management to the component tree.
 *
 * @see docs/design/flow-entity-step-plan-en.md Phase 3 - Task 3.1
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import {
  ExecutionStateManager,
  type ExecutionStateManagerConfig,
  type EntityExecutionInfo,
  type ExecutionStateListener,
  type ProgressListener,
  type EntityStartEvent,
  type EntityFinishEvent,
  type ExecutionStateSnapshot,
} from "./execution-state-manager";
import type { ExecutionState } from "../types";

// =============================================================================
// Context Types
// =============================================================================

/**
 * Context value provided by ExecutionStateProvider
 */
export interface ExecutionStateContextValue {
  /** The underlying ExecutionStateManager instance */
  manager: ExecutionStateManager;

  /** Get execution state for an entity */
  getState: (entityId: string) => ExecutionState;

  /** Set execution state for an entity */
  setState: (
    entityId: string,
    state: ExecutionState,
    options?: { errorMessage?: string; durationMs?: number }
  ) => void;

  /** Get progress for an entity */
  getProgress: (entityId: string) => number | undefined;

  /** Set progress for an entity */
  setProgress: (entityId: string, progress: number) => void;

  /** Get complete execution info for an entity */
  getEntityInfo: (entityId: string) => EntityExecutionInfo;

  /** Check if entity is currently executing */
  isExecuting: (entityId: string) => boolean;

  /** Check if entity has completed */
  isCompleted: (entityId: string) => boolean;

  /** Subscribe to state changes for an entity */
  subscribe: (entityId: string, listener: ExecutionStateListener) => () => void;

  /** Subscribe to progress changes for an entity */
  subscribeProgress: (entityId: string, listener: ProgressListener) => () => void;

  /** Subscribe to all state changes */
  subscribeAll: (
    listener: (entityId: string, state: ExecutionState, previousState: ExecutionState) => void
  ) => () => void;

  /** Reset entity to default state */
  resetState: (entityId: string) => void;

  /** Reset all entities */
  resetAll: () => void;

  /** Create handlers for engine integration */
  createEngineHandlers: () => {
    onEntityStart: (event: EntityStartEvent) => void;
    onEntityFinish: (event: EntityFinishEvent) => void;
  };

  /** Connect to an engine instance */
  connectToEngine: (engine: {
    onEntityStart: { on: (handler: (event: EntityStartEvent) => void) => () => void };
    onEntityFinish: { on: (handler: (event: EntityFinishEvent) => void) => () => void };
  }) => () => void;

  /** Create a snapshot of all states */
  createSnapshot: () => ExecutionStateSnapshot;

  /** Get count of entities by state */
  getStateCounts: () => Record<ExecutionState, number>;
}

/**
 * Props for ExecutionStateProvider
 */
export interface ExecutionStateProviderProps {
  /** Child components */
  children: ReactNode;
  /** Optional configuration for the manager */
  config?: ExecutionStateManagerConfig;
  /** Optional existing manager instance to use */
  manager?: ExecutionStateManager;
  /** Optional engine to automatically connect to */
  engine?: {
    onEntityStart: { on: (handler: (event: EntityStartEvent) => void) => () => void };
    onEntityFinish: { on: (handler: (event: EntityFinishEvent) => void) => () => void };
  };
}

// =============================================================================
// Context Definition
// =============================================================================

/**
 * React context for execution state management
 */
export const ExecutionStateContext = createContext<ExecutionStateContextValue | null>(null);

ExecutionStateContext.displayName = "ExecutionStateContext";

// =============================================================================
// Provider Component
// =============================================================================

/**
 * Provider component for execution state management.
 *
 * Wraps the component tree with ExecutionStateManager access.
 * Automatically handles cleanup on unmount.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ExecutionStateProvider>
 *   <FlowCanvas nodes={nodes} edges={edges} />
 * </ExecutionStateProvider>
 *
 * // With configuration
 * <ExecutionStateProvider config={{ enableLogging: true }}>
 *   <FlowCanvas nodes={nodes} edges={edges} />
 * </ExecutionStateProvider>
 *
 * // With engine integration
 * <ExecutionStateProvider engine={engine}>
 *   <FlowCanvas nodes={nodes} edges={edges} />
 * </ExecutionStateProvider>
 * ```
 */
export function ExecutionStateProvider({
  children,
  config,
  manager: externalManager,
  engine,
}: ExecutionStateProviderProps): React.JSX.Element {
  // Create or use provided manager
  const managerRef = useRef<ExecutionStateManager | null>(null);

  if (!managerRef.current) {
    managerRef.current = externalManager ?? new ExecutionStateManager(config);
  }

  const manager = managerRef.current;

  // Connect to engine if provided
  useEffect(() => {
    if (engine && manager) {
      const disconnect = manager.connectToEngine(engine);
      return disconnect;
    }
    return undefined;
  }, [engine, manager]);

  // Cleanup on unmount (only if we created the manager)
  useEffect(() => {
    return () => {
      if (!externalManager && managerRef.current) {
        managerRef.current.dispose();
        managerRef.current = null;
      }
    };
  }, [externalManager]);

  // Memoize context value
  const contextValue = useMemo<ExecutionStateContextValue>(
    () => ({
      manager,
      getState: (entityId) => manager.getState(entityId),
      setState: (entityId, state, options) => manager.setState(entityId, state, options),
      getProgress: (entityId) => manager.getProgress(entityId),
      setProgress: (entityId, progress) => manager.setProgress(entityId, progress),
      getEntityInfo: (entityId) => manager.getEntityInfo(entityId),
      isExecuting: (entityId) => manager.isExecuting(entityId),
      isCompleted: (entityId) => manager.isCompleted(entityId),
      subscribe: (entityId, listener) => manager.subscribe(entityId, listener),
      subscribeProgress: (entityId, listener) => manager.subscribeProgress(entityId, listener),
      subscribeAll: (listener) => manager.subscribeAll(listener),
      resetState: (entityId) => manager.resetState(entityId),
      resetAll: () => manager.resetAll(),
      createEngineHandlers: () => manager.createEngineHandlers(),
      connectToEngine: (eng) => manager.connectToEngine(eng),
      createSnapshot: () => manager.createSnapshot(),
      getStateCounts: () => manager.getStateCounts(),
    }),
    [manager]
  );

  return (
    <ExecutionStateContext.Provider value={contextValue}>{children}</ExecutionStateContext.Provider>
  );
}

ExecutionStateProvider.displayName = "ExecutionStateProvider";

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to access the ExecutionStateContext.
 * Throws if used outside of ExecutionStateProvider.
 *
 * @returns ExecutionStateContextValue
 * @throws Error if used outside provider
 */
export function useExecutionStateContext(): ExecutionStateContextValue {
  const context = useContext(ExecutionStateContext);

  if (!context) {
    throw new Error("useExecutionStateContext must be used within an ExecutionStateProvider");
  }

  return context;
}

/**
 * Hook to optionally access the ExecutionStateContext.
 * Returns null if used outside of ExecutionStateProvider.
 *
 * @returns ExecutionStateContextValue or null
 */
export function useExecutionStateContextOptional(): ExecutionStateContextValue | null {
  return useContext(ExecutionStateContext);
}

/**
 * Hook to get the ExecutionStateManager instance
 *
 * @returns ExecutionStateManager or null if outside provider
 */
export function useExecutionStateManager(): ExecutionStateManager | null {
  const context = useContext(ExecutionStateContext);
  return context?.manager ?? null;
}

// =============================================================================
// Exports
// =============================================================================

export {
  ExecutionStateManager,
  createExecutionStateManager,
  type ExecutionStateManagerConfig,
  type EntityExecutionInfo,
  type ExecutionStateListener,
  type ProgressListener,
  type EntityStartEvent,
  type EntityFinishEvent,
  type ExecutionStateSnapshot,
} from "./execution-state-manager";
