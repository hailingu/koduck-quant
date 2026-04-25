/**
 * @file useExecutionState Hook
 * @description React hook to subscribe to execution state changes for a flow entity.
 * Provides reactive state updates when the entity's execution state changes.
 *
 * @see docs/design/flow-entity-step-plan-en.md Phase 3 - Task 3.2
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useExecutionStateContext,
  useExecutionStateContextOptional,
} from "../execution/ExecutionStateProvider";
import type { ExecutionState } from "../types";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for configuring the useExecutionState hook
 */
export interface UseExecutionStateOptions {
  /**
   * The entity ID to subscribe to
   */
  entityId: string;

  /**
   * Callback when state changes
   */
  onStateChange?: (state: ExecutionState, previousState: ExecutionState) => void;

  /**
   * Callback when progress changes
   */
  onProgressChange?: (progress: number) => void;

  /**
   * Whether to subscribe to progress updates
   * @default true
   */
  subscribeToProgress?: boolean;
}

/**
 * Return value of the useExecutionState hook
 */
export interface UseExecutionStateResult {
  /** Current execution state */
  state: ExecutionState;

  /** Previous execution state (undefined on first render) */
  previousState: ExecutionState | undefined;

  /** Current progress percentage (0-100), undefined if not set */
  progress: number | undefined;

  /** Whether the entity is currently executing (running or pending) */
  isExecuting: boolean;

  /** Whether the entity has completed (success, error, skipped, or cancelled) */
  isCompleted: boolean;

  /** Whether the entity is in an error state */
  isError: boolean;

  /** Whether the entity is in a success state */
  isSuccess: boolean;

  /** Whether the entity is idle */
  isIdle: boolean;

  /** Set the execution state programmatically */
  setState: (newState: ExecutionState) => void;

  /** Set progress programmatically */
  setProgress: (progress: number) => void;

  /** Reset to idle state */
  reset: () => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook to subscribe to execution state changes for a flow entity.
 *
 * @param options - Configuration options including entityId and callbacks
 * @returns Object containing current state, progress, and derived status flags
 *
 * @example
 * ```tsx
 * function NodeStatus({ nodeId }: { nodeId: string }) {
 *   const { state, progress, isExecuting, isError } = useExecutionState({
 *     entityId: nodeId,
 *     onStateChange: (state, prev) => {
 *       console.log(`State changed from ${prev} to ${state}`);
 *     },
 *   });
 *
 *   return (
 *     <div className={`status-${state}`}>
 *       {isExecuting && progress !== undefined && (
 *         <ProgressBar value={progress} />
 *       )}
 *       {isError && <ErrorIcon />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useExecutionState(options: UseExecutionStateOptions): UseExecutionStateResult {
  const { entityId, onStateChange, onProgressChange, subscribeToProgress = true } = options;

  // Get context
  const context = useExecutionStateContext();

  // Local state for reactivity
  const [state, setLocalState] = useState<ExecutionState>(() => context.getState(entityId));
  const [previousState, setPreviousState] = useState<ExecutionState | undefined>(undefined);
  const [progress, setLocalProgress] = useState<number | undefined>(() =>
    context.getProgress(entityId)
  );

  // Subscribe to state changes
  useEffect(() => {
    // Get initial state
    const initialState = context.getState(entityId);
    setLocalState(initialState);

    // Subscribe to state changes
    const unsubscribe = context.subscribe(entityId, (newState, prevState) => {
      setLocalState(newState);
      setPreviousState(prevState);
      onStateChange?.(newState, prevState);
    });

    return unsubscribe;
  }, [entityId, context, onStateChange]);

  // Subscribe to progress changes
  useEffect(() => {
    if (!subscribeToProgress) {
      return;
    }

    // Get initial progress
    const initialProgress = context.getProgress(entityId);
    setLocalProgress(initialProgress);

    // Subscribe to progress changes
    const unsubscribe = context.subscribeProgress(entityId, (newProgress) => {
      setLocalProgress(newProgress);
      onProgressChange?.(newProgress);
    });

    return unsubscribe;
  }, [entityId, context, subscribeToProgress, onProgressChange]);

  // Derived state flags
  const isExecuting = useMemo(() => state === "running" || state === "pending", [state]);

  const isCompleted = useMemo(
    () => state === "success" || state === "error" || state === "skipped" || state === "cancelled",
    [state]
  );

  const isError = useMemo(() => state === "error", [state]);

  const isSuccess = useMemo(() => state === "success", [state]);

  const isIdle = useMemo(() => state === "idle", [state]);

  // Action handlers
  const setState = useCallback(
    (newState: ExecutionState) => {
      context.setState(entityId, newState);
    },
    [context, entityId]
  );

  const setProgress = useCallback(
    (newProgress: number) => {
      context.setProgress(entityId, newProgress);
    },
    [context, entityId]
  );

  const reset = useCallback(() => {
    context.resetState(entityId);
    setLocalProgress(undefined);
    setPreviousState(state);
  }, [context, entityId, state]);

  return {
    state,
    previousState,
    progress,
    isExecuting,
    isCompleted,
    isError,
    isSuccess,
    isIdle,
    setState,
    setProgress,
    reset,
  };
}

/**
 * Optional result type when hook is used outside provider
 */
export interface UseExecutionStateOptionalResult {
  /** Current execution state, defaults to 'idle' if outside provider */
  state: ExecutionState;

  /** Previous execution state (undefined on first render or outside provider) */
  previousState: ExecutionState | undefined;

  /** Current progress percentage (0-100), undefined if not set */
  progress: number | undefined;

  /** Whether the entity is currently executing (running or pending) */
  isExecuting: boolean;

  /** Whether the entity has completed (success, error, skipped, or cancelled) */
  isCompleted: boolean;

  /** Whether the entity is in an error state */
  isError: boolean;

  /** Whether the entity is in a success state */
  isSuccess: boolean;

  /** Whether the entity is idle */
  isIdle: boolean;

  /** Set the execution state programmatically. No-op if outside provider. */
  setState: (newState: ExecutionState) => void;

  /** Set progress programmatically. No-op if outside provider. */
  setProgress: (progress: number) => void;

  /** Reset to idle state. No-op if outside provider. */
  reset: () => void;

  /** Whether the hook is connected to an ExecutionStateProvider */
  isConnected: boolean;
}

/**
 * Optional version of useExecutionState that works outside of ExecutionStateProvider.
 * Returns default idle state when used outside provider context.
 *
 * This is useful for components that need to optionally display execution state
 * without requiring the provider to be present.
 *
 * @param options - Hook configuration options
 * @returns Execution state with isConnected flag indicating provider presence
 *
 * @example
 * ```tsx
 * function OptionalStatusIndicator({ nodeId }: { nodeId: string }) {
 *   const { state, isConnected } = useExecutionStateOptional({ entityId: nodeId });
 *
 *   // Only show status if connected to provider
 *   if (!isConnected) {
 *     return null;
 *   }
 *
 *   return <span className={`state-${state}`}>{state}</span>;
 * }
 * ```
 */
export function useExecutionStateOptional(
  options: UseExecutionStateOptions
): UseExecutionStateOptionalResult {
  const { entityId, onStateChange, onProgressChange, subscribeToProgress = true } = options;

  // Get optional context - may be null if outside provider
  const context = useExecutionStateContextOptional();
  const isConnected = context !== null;

  // Local state for reactivity - default to 'idle' when not connected
  const [state, setLocalState] = useState<ExecutionState>(() =>
    context ? context.getState(entityId) : "idle"
  );
  const [previousState, setPreviousState] = useState<ExecutionState | undefined>(undefined);
  const [progress, setLocalProgress] = useState<number | undefined>(() =>
    context ? context.getProgress(entityId) : undefined
  );

  // Subscribe to state changes when connected
  useEffect(() => {
    if (!context) {
      setLocalState("idle");
      return;
    }

    // Get initial state
    const initialState = context.getState(entityId);
    setLocalState(initialState);

    // Subscribe to state changes
    const unsubscribe = context.subscribe(entityId, (newState, prevState) => {
      setLocalState(newState);
      setPreviousState(prevState);
      onStateChange?.(newState, prevState);
    });

    return unsubscribe;
  }, [entityId, context, onStateChange]);

  // Subscribe to progress changes when connected
  useEffect(() => {
    if (!context || !subscribeToProgress) {
      return;
    }

    // Get initial progress
    const initialProgress = context.getProgress(entityId);
    setLocalProgress(initialProgress);

    // Subscribe to progress changes
    const unsubscribe = context.subscribeProgress(entityId, (newProgress) => {
      setLocalProgress(newProgress);
      onProgressChange?.(newProgress);
    });

    return unsubscribe;
  }, [entityId, context, subscribeToProgress, onProgressChange]);

  // Derived state flags
  const isExecuting = useMemo(() => state === "running" || state === "pending", [state]);

  const isCompleted = useMemo(
    () => state === "success" || state === "error" || state === "skipped" || state === "cancelled",
    [state]
  );

  const isError = useMemo(() => state === "error", [state]);
  const isSuccess = useMemo(() => state === "success", [state]);
  const isIdle = useMemo(() => state === "idle", [state]);

  // Action functions - no-op when not connected
  const setState = useCallback(
    (newState: ExecutionState) => {
      if (context) {
        context.setState(entityId, newState);
      }
    },
    [context, entityId]
  );

  const setProgress = useCallback(
    (newProgress: number) => {
      if (context) {
        context.setProgress(entityId, newProgress);
      }
    },
    [context, entityId]
  );

  const reset = useCallback(() => {
    if (context) {
      context.resetState(entityId);
      setLocalProgress(undefined);
      setPreviousState(state);
    }
  }, [context, entityId, state]);

  return {
    state,
    previousState,
    progress,
    isExecuting,
    isCompleted,
    isError,
    isSuccess,
    isIdle,
    setState,
    setProgress,
    reset,
    isConnected,
  };
}

// =============================================================================
// Convenience Hooks
// =============================================================================

/**
 * Minimal hook that only returns the execution state.
 * Useful when you only need the state without progress or callbacks.
 *
 * @param entityId - The entity ID to subscribe to
 * @returns Current execution state
 *
 * @example
 * ```tsx
 * function SimpleStatus({ nodeId }: { nodeId: string }) {
 *   const state = useExecutionStateValue(nodeId);
 *   return <span className={`state-${state}`}>{state}</span>;
 * }
 * ```
 */
export function useExecutionStateValue(entityId: string): ExecutionState {
  const context = useExecutionStateContext();
  const [state, setLocalState] = useState<ExecutionState>(() => context.getState(entityId));

  useEffect(() => {
    const initialState = context.getState(entityId);
    setLocalState(initialState);

    const unsubscribe = context.subscribe(entityId, (newState) => {
      setLocalState(newState);
    });

    return unsubscribe;
  }, [entityId, context]);

  return state;
}

/**
 * Hook that returns both state and progress values.
 * Useful for progress indicators that need both values.
 *
 * @param entityId - The entity ID to subscribe to
 * @returns Tuple of [state, progress]
 *
 * @example
 * ```tsx
 * function ProgressIndicator({ nodeId }: { nodeId: string }) {
 *   const [state, progress] = useExecutionStateWithProgress(nodeId);
 *   return (
 *     <div>
 *       <span>{state}</span>
 *       {progress !== undefined && <span>{progress}%</span>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useExecutionStateWithProgress(
  entityId: string
): [ExecutionState, number | undefined] {
  const context = useExecutionStateContext();
  const [state, setLocalState] = useState<ExecutionState>(() => context.getState(entityId));
  const [progress, setLocalProgress] = useState<number | undefined>(() =>
    context.getProgress(entityId)
  );

  useEffect(() => {
    const initialState = context.getState(entityId);
    setLocalState(initialState);

    const unsubscribe = context.subscribe(entityId, (newState) => {
      setLocalState(newState);
    });

    return unsubscribe;
  }, [entityId, context]);

  useEffect(() => {
    const initialProgress = context.getProgress(entityId);
    setLocalProgress(initialProgress);

    const unsubscribe = context.subscribeProgress(entityId, (newProgress) => {
      setLocalProgress(newProgress);
    });

    return unsubscribe;
  }, [entityId, context]);

  return [state, progress];
}

/**
 * Hook that checks if an entity is in a specific state.
 * Useful for conditional rendering based on state.
 *
 * @param entityId - The entity ID to check
 * @param targetState - The state to check for
 * @returns Whether the entity is in the target state
 *
 * @example
 * ```tsx
 * function RunningIndicator({ nodeId }: { nodeId: string }) {
 *   const isRunning = useIsExecutionState(nodeId, "running");
 *   return isRunning ? <Spinner /> : null;
 * }
 * ```
 */
export function useIsExecutionState(entityId: string, targetState: ExecutionState): boolean {
  const state = useExecutionStateValue(entityId);
  return state === targetState;
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Factory function to create a useExecutionState hook with pre-bound options.
 * Useful for creating entity-specific hooks.
 *
 * @param defaultOptions - Default options to apply to all hook calls
 * @returns A hook function with the default options applied
 *
 * @example
 * ```tsx
 * // Create a hook with logging enabled
 * const useLoggedExecutionState = createUseExecutionState({
 *   onStateChange: (state, prev) => console.log(`${prev} -> ${state}`),
 * });
 *
 * function NodeStatus({ nodeId }: { nodeId: string }) {
 *   const { state } = useLoggedExecutionState({ entityId: nodeId });
 *   return <span>{state}</span>;
 * }
 * ```
 */
export function createUseExecutionState(
  defaultOptions: Partial<Omit<UseExecutionStateOptions, "entityId">>
): (options: UseExecutionStateOptions) => UseExecutionStateResult {
  return (options: UseExecutionStateOptions) => {
    return useExecutionState({
      ...defaultOptions,
      ...options,
    });
  };
}
