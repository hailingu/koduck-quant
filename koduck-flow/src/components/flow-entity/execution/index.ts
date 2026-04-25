/**
 * @file Execution module exports
 * @description Exports for execution state management including ExecutionStateManager
 * and ExecutionStateProvider.
 *
 * @see docs/design/flow-entity-step-plan-en.md Phase 3
 */

// ExecutionStateManager
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

// ExecutionStateProvider (React context)
export {
  ExecutionStateProvider,
  ExecutionStateContext,
  useExecutionStateContext,
  useExecutionStateContextOptional,
  useExecutionStateManager,
  type ExecutionStateContextValue,
  type ExecutionStateProviderProps,
} from "./ExecutionStateProvider";
