/**
 * @file ExecutionStateManager
 * @description Centralized manager for entity execution states with subscription support.
 * Manages execution state (idle, pending, running, success, error, skipped, cancelled)
 * and optional progress tracking for all flow entities.
 *
 * @see docs/design/flow-entity-step-plan-en.md Phase 3 - Task 3.1
 */

import type { IDisposable } from "../../../common/disposable";
import type { ExecutionState } from "../types";
import { logger } from "../../../common/logger";

// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * Listener callback for execution state changes
 */
export type ExecutionStateListener = (state: ExecutionState, previousState: ExecutionState) => void;

/**
 * Listener callback for progress changes
 */
export type ProgressListener = (progress: number, entityId: string) => void;

/**
 * Entity execution info containing state and optional progress
 */
export interface EntityExecutionInfo {
  /** Current execution state */
  state: ExecutionState;
  /** Execution progress percentage (0-100), undefined if not applicable */
  progress?: number;
  /** Timestamp when state was last updated */
  updatedAt: number;
  /** Error message if state is 'error' */
  errorMessage?: string;
  /** Duration in ms if execution has completed */
  durationMs?: number;
}

/**
 * Snapshot of all entity execution states
 */
export interface ExecutionStateSnapshot {
  /** Map of entity ID to execution info */
  entities: Map<string, EntityExecutionInfo>;
  /** Timestamp when snapshot was taken */
  timestamp: number;
}

/**
 * Configuration options for ExecutionStateManager
 */
export interface ExecutionStateManagerConfig {
  /** Whether to emit debug logs */
  enableLogging?: boolean;
  /** Default state for new entities */
  defaultState?: ExecutionState;
  /** Whether to track execution timing */
  trackTiming?: boolean;
}

/**
 * Engine event payload for entity start
 */
export interface EntityStartEvent {
  entityId: string;
  type: string;
}

/**
 * Engine event payload for entity finish
 */
export interface EntityFinishEvent {
  entityId: string;
  type: string;
  status: "success" | "error" | "skipped" | "cancelled";
  durationMs: number;
  error?: Error;
}

// =============================================================================
// ExecutionStateManager Implementation
// =============================================================================

/**
 * Centralized manager for entity execution states with subscription support.
 *
 * Provides a pub/sub pattern for components to subscribe to execution state changes
 * for specific entities. Integrates with DefaultEngine events to automatically
 * update states based on execution lifecycle.
 *
 * @example
 * ```typescript
 * const manager = new ExecutionStateManager();
 *
 * // Subscribe to state changes
 * const unsubscribe = manager.subscribe('node-1', (state, prevState) => {
 *   console.log(`State changed: ${prevState} -> ${state}`);
 * });
 *
 * // Update state
 * manager.setState('node-1', 'running');
 *
 * // Get current state
 * const state = manager.getState('node-1'); // 'running'
 *
 * // Cleanup
 * unsubscribe();
 * manager.dispose();
 * ```
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 3.1
 */
export class ExecutionStateManager implements IDisposable {
  /** Map of entity ID to current execution state */
  private readonly _states = new Map<string, ExecutionState>();

  /** Map of entity ID to progress percentage (0-100) */
  private readonly _progress = new Map<string, number>();

  /** Map of entity ID to state update timestamp */
  private readonly _timestamps = new Map<string, number>();

  /** Map of entity ID to error message */
  private readonly _errors = new Map<string, string>();

  /** Map of entity ID to execution duration */
  private readonly _durations = new Map<string, number>();

  /** Map of entity ID to execution start time */
  private readonly _startTimes = new Map<string, number>();

  /** Map of entity ID to set of state listeners */
  private readonly _stateListeners = new Map<string, Set<ExecutionStateListener>>();

  /** Map of entity ID to set of progress listeners */
  private readonly _progressListeners = new Map<string, Set<ProgressListener>>();

  /** Global listeners that receive all state changes */
  private readonly _globalListeners = new Set<
    (entityId: string, state: ExecutionState, previousState: ExecutionState) => void
  >();

  /** Whether this manager has been disposed */
  private _disposed = false;

  /** Configuration options */
  private readonly _config: Required<ExecutionStateManagerConfig>;

  /**
   * Create a new ExecutionStateManager
   *
   * @param config - Optional configuration options
   */
  constructor(config?: ExecutionStateManagerConfig) {
    this._config = {
      enableLogging: config?.enableLogging ?? false,
      defaultState: config?.defaultState ?? "idle",
      trackTiming: config?.trackTiming ?? true,
    };

    if (this._config.enableLogging) {
      logger.debug("[ExecutionStateManager] Initialized", {
        config: this._config,
      });
    }
  }

  // ===========================================================================
  // State Management
  // ===========================================================================

  /**
   * Get the current execution state for an entity
   *
   * @param entityId - The entity ID to query
   * @returns The current execution state, or default state if not set
   */
  getState(entityId: string): ExecutionState {
    return this._states.get(entityId) ?? this._config.defaultState;
  }

  /**
   * Set the execution state for an entity
   *
   * @param entityId - The entity ID to update
   * @param state - The new execution state
   * @param options - Optional additional info (error message, etc.)
   * @param options.errorMessage
   * @param options.durationMs
   */
  setState(
    entityId: string,
    state: ExecutionState,
    options?: { errorMessage?: string; durationMs?: number }
  ): void {
    this.assertNotDisposed();

    const previousState = this._states.get(entityId) ?? this._config.defaultState;

    // Skip if state hasn't changed
    if (previousState === state) {
      return;
    }

    // Update state
    this._states.set(entityId, state);
    this._timestamps.set(entityId, Date.now());

    // Track start time for running state
    if (state === "running" && this._config.trackTiming) {
      this._startTimes.set(entityId, Date.now());
    }

    // Handle error message
    if (options?.errorMessage) {
      this._errors.set(entityId, options.errorMessage);
    } else if (state !== "error") {
      this._errors.delete(entityId);
    }

    // Handle duration
    if (options?.durationMs !== undefined) {
      this._durations.set(entityId, options.durationMs);
    } else if (
      this._config.trackTiming &&
      (state === "success" || state === "error" || state === "cancelled" || state === "skipped")
    ) {
      const startTime = this._startTimes.get(entityId);
      if (startTime) {
        this._durations.set(entityId, Date.now() - startTime);
        this._startTimes.delete(entityId);
      }
    }

    // Reset progress when entering terminal states
    if (state === "success" || state === "error" || state === "cancelled" || state === "skipped") {
      this._progress.delete(entityId);
    }

    if (this._config.enableLogging) {
      logger.debug("[ExecutionStateManager] State changed", {
        entityId,
        previousState,
        newState: state,
        errorMessage: options?.errorMessage,
      });
    }

    // Notify entity-specific listeners
    this.notifyStateListeners(entityId, state, previousState);

    // Notify global listeners
    this.notifyGlobalListeners(entityId, state, previousState);
  }

  /**
   * Set multiple entity states at once (batch update)
   *
   * @param updates - Map of entity ID to new state
   */
  setStates(updates: Map<string, ExecutionState>): void {
    this.assertNotDisposed();

    Array.from(updates.entries()).forEach(([entityId, state]) => {
      this.setState(entityId, state);
    });
  }

  /**
   * Reset an entity to the default state
   *
   * @param entityId - The entity ID to reset
   */
  resetState(entityId: string): void {
    this.setState(entityId, this._config.defaultState);
    this._progress.delete(entityId);
    this._errors.delete(entityId);
    this._durations.delete(entityId);
    this._startTimes.delete(entityId);
  }

  /**
   * Reset all entities to default state
   */
  resetAll(): void {
    this.assertNotDisposed();

    const entityIds = Array.from(this._states.keys());
    for (const entityId of entityIds) {
      this.resetState(entityId);
    }

    if (this._config.enableLogging) {
      logger.debug("[ExecutionStateManager] All states reset", {
        entityCount: entityIds.length,
      });
    }
  }

  // ===========================================================================
  // Progress Management
  // ===========================================================================

  /**
   * Get the current progress for an entity
   *
   * @param entityId - The entity ID to query
   * @returns Progress percentage (0-100), or undefined if not tracked
   */
  getProgress(entityId: string): number | undefined {
    return this._progress.get(entityId);
  }

  /**
   * Set the progress for an entity
   *
   * @param entityId - The entity ID to update
   * @param progress - Progress percentage (0-100)
   */
  setProgress(entityId: string, progress: number): void {
    this.assertNotDisposed();

    // Clamp progress to valid range
    const clampedProgress = Math.max(0, Math.min(100, progress));
    const previousProgress = this._progress.get(entityId);

    // Skip if progress hasn't changed significantly (within 0.1%)
    if (previousProgress !== undefined && Math.abs(previousProgress - clampedProgress) < 0.1) {
      return;
    }

    this._progress.set(entityId, clampedProgress);

    // Notify progress listeners
    this.notifyProgressListeners(entityId, clampedProgress);
  }

  // ===========================================================================
  // Entity Info Getters
  // ===========================================================================

  /**
   * Get complete execution info for an entity
   *
   * @param entityId - The entity ID to query
   * @returns Complete execution info including state, progress, timing
   */
  getEntityInfo(entityId: string): EntityExecutionInfo {
    const info: EntityExecutionInfo = {
      state: this.getState(entityId),
      updatedAt: this._timestamps.get(entityId) ?? 0,
    };
    const progress = this.getProgress(entityId);
    const errorMessage = this._errors.get(entityId);
    const durationMs = this._durations.get(entityId);
    if (progress !== undefined) {
      info.progress = progress;
    }
    if (errorMessage !== undefined) {
      info.errorMessage = errorMessage;
    }
    if (durationMs !== undefined) {
      info.durationMs = durationMs;
    }
    return info;
  }

  /**
   * Get error message for an entity
   *
   * @param entityId - The entity ID to query
   * @returns Error message if entity is in error state, undefined otherwise
   */
  getError(entityId: string): string | undefined {
    return this._errors.get(entityId);
  }

  /**
   * Get execution duration for an entity
   *
   * @param entityId - The entity ID to query
   * @returns Duration in ms, or undefined if not available
   */
  getDuration(entityId: string): number | undefined {
    return this._durations.get(entityId);
  }

  /**
   * Check if an entity is in an active execution state (pending or running)
   *
   * @param entityId - The entity ID to check
   * @returns True if entity is pending or running
   */
  isExecuting(entityId: string): boolean {
    const state = this.getState(entityId);
    return state === "pending" || state === "running";
  }

  /**
   * Check if an entity has completed execution (success, error, skipped, or cancelled)
   *
   * @param entityId - The entity ID to check
   * @returns True if entity is in a terminal state
   */
  isCompleted(entityId: string): boolean {
    const state = this.getState(entityId);
    return state === "success" || state === "error" || state === "skipped" || state === "cancelled";
  }

  // ===========================================================================
  // Subscription Management
  // ===========================================================================

  /**
   * Subscribe to state changes for a specific entity
   *
   * @param entityId - The entity ID to subscribe to
   * @param listener - Callback invoked when state changes
   * @returns Unsubscribe function
   */
  subscribe(entityId: string, listener: ExecutionStateListener): () => void {
    this.assertNotDisposed();

    let listeners = this._stateListeners.get(entityId);
    if (!listeners) {
      listeners = new Set();
      this._stateListeners.set(entityId, listeners);
    }
    listeners.add(listener);

    // Return unsubscribe function
    return () => {
      const set = this._stateListeners.get(entityId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this._stateListeners.delete(entityId);
        }
      }
    };
  }

  /**
   * Subscribe to progress changes for a specific entity
   *
   * @param entityId - The entity ID to subscribe to
   * @param listener - Callback invoked when progress changes
   * @returns Unsubscribe function
   */
  subscribeProgress(entityId: string, listener: ProgressListener): () => void {
    this.assertNotDisposed();

    let listeners = this._progressListeners.get(entityId);
    if (!listeners) {
      listeners = new Set();
      this._progressListeners.set(entityId, listeners);
    }
    listeners.add(listener);

    return () => {
      const set = this._progressListeners.get(entityId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this._progressListeners.delete(entityId);
        }
      }
    };
  }

  /**
   * Subscribe to all state changes globally
   *
   * @param listener - Callback invoked when any entity's state changes
   * @returns Unsubscribe function
   */
  subscribeAll(
    listener: (entityId: string, state: ExecutionState, previousState: ExecutionState) => void
  ): () => void {
    this.assertNotDisposed();
    this._globalListeners.add(listener);

    return () => {
      this._globalListeners.delete(listener);
    };
  }

  /**
   * Get the number of subscribers for an entity
   *
   * @param entityId - The entity ID to query
   * @returns Number of state + progress subscribers
   */
  getSubscriberCount(entityId: string): number {
    const stateCount = this._stateListeners.get(entityId)?.size ?? 0;
    const progressCount = this._progressListeners.get(entityId)?.size ?? 0;
    return stateCount + progressCount;
  }

  // ===========================================================================
  // Engine Integration
  // ===========================================================================

  /**
   * Handle entity start event from engine
   *
   * @param event - Entity start event payload
   */
  handleEntityStart(event: EntityStartEvent): void {
    this.setState(event.entityId, "running");
  }

  /**
   * Handle entity finish event from engine
   *
   * @param event - Entity finish event payload
   */
  handleEntityFinish(event: EntityFinishEvent): void {
    this.setState(event.entityId, event.status, {
      durationMs: event.durationMs,
      ...(event.error?.message === undefined ? {} : { errorMessage: event.error.message }),
    });
  }

  /**
   * Create event handlers for DefaultEngine integration
   *
   * @returns Object with onEntityStart and onEntityFinish handlers
   *
   * @example
   * ```typescript
   * const manager = new ExecutionStateManager();
   * const handlers = manager.createEngineHandlers();
   *
   * engine.onEntityStart.on(handlers.onEntityStart);
   * engine.onEntityFinish.on(handlers.onEntityFinish);
   * ```
   */
  createEngineHandlers(): {
    onEntityStart: (event: EntityStartEvent) => void;
    onEntityFinish: (event: EntityFinishEvent) => void;
  } {
    return {
      onEntityStart: (event) => this.handleEntityStart(event),
      onEntityFinish: (event) => this.handleEntityFinish(event),
    };
  }

  /**
   * Connect this manager to a DefaultEngine instance
   *
   * @param engine - Engine with onEntityStart and onEntityFinish events
   * @param engine.onEntityStart
   * @param engine.onEntityStart.on
   * @param engine.onEntityFinish
   * @param engine.onEntityFinish.on
   * @returns Dispose function to disconnect from engine
   */
  connectToEngine(engine: {
    onEntityStart: { on: (handler: (event: EntityStartEvent) => void) => () => void };
    onEntityFinish: { on: (handler: (event: EntityFinishEvent) => void) => () => void };
  }): () => void {
    const handlers = this.createEngineHandlers();
    const disposeStart = engine.onEntityStart.on(handlers.onEntityStart);
    const disposeFinish = engine.onEntityFinish.on(handlers.onEntityFinish);

    return () => {
      disposeStart();
      disposeFinish();
    };
  }

  // ===========================================================================
  // Snapshot & Serialization
  // ===========================================================================

  /**
   * Create a snapshot of all entity states
   *
   * @returns Snapshot containing all entity execution info
   */
  createSnapshot(): ExecutionStateSnapshot {
    const entities = new Map<string, EntityExecutionInfo>();

    Array.from(this._states.entries()).forEach(([entityId]) => {
      entities.set(entityId, this.getEntityInfo(entityId));
    });

    return {
      entities,
      timestamp: Date.now(),
    };
  }

  /**
   * Restore states from a snapshot
   *
   * @param snapshot - Snapshot to restore from
   */
  restoreFromSnapshot(snapshot: ExecutionStateSnapshot): void {
    this.assertNotDisposed();

    Array.from(snapshot.entities.entries()).forEach(([entityId, info]) => {
      this._states.set(entityId, info.state);
      this._timestamps.set(entityId, info.updatedAt);

      if (info.progress !== undefined) {
        this._progress.set(entityId, info.progress);
      }

      if (info.errorMessage) {
        this._errors.set(entityId, info.errorMessage);
      }

      if (info.durationMs !== undefined) {
        this._durations.set(entityId, info.durationMs);
      }
    });

    if (this._config.enableLogging) {
      logger.debug("[ExecutionStateManager] Restored from snapshot", {
        entityCount: snapshot.entities.size,
        snapshotTime: snapshot.timestamp,
      });
    }
  }

  /**
   * Get count of entities in each state
   *
   * @returns Record of state to count
   */
  getStateCounts(): Record<ExecutionState, number> {
    const counts: Record<ExecutionState, number> = {
      idle: 0,
      pending: 0,
      running: 0,
      success: 0,
      error: 0,
      skipped: 0,
      cancelled: 0,
    };

    Array.from(this._states.values()).forEach((state) => {
      counts[state]++;
    });

    return counts;
  }

  /**
   * Get all entity IDs with a specific state
   *
   * @param state - State to filter by
   * @returns Array of entity IDs with the specified state
   */
  getEntitiesByState(state: ExecutionState): string[] {
    const result: string[] = [];
    Array.from(this._states.entries()).forEach(([entityId, entityState]) => {
      if (entityState === state) {
        result.push(entityId);
      }
    });
    return result;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Notify state listeners for a specific entity
   * @param entityId
   * @param state
   * @param previousState
   */
  private notifyStateListeners(
    entityId: string,
    state: ExecutionState,
    previousState: ExecutionState
  ): void {
    const listeners = this._stateListeners.get(entityId);
    if (listeners) {
      Array.from(listeners).forEach((listener) => {
        try {
          listener(state, previousState);
        } catch (error) {
          logger.warn("[ExecutionStateManager] Error in state listener", {
            entityId,
            error,
          });
        }
      });
    }
  }

  /**
   * Notify global listeners
   * @param entityId
   * @param state
   * @param previousState
   */
  private notifyGlobalListeners(
    entityId: string,
    state: ExecutionState,
    previousState: ExecutionState
  ): void {
    Array.from(this._globalListeners).forEach((listener) => {
      try {
        listener(entityId, state, previousState);
      } catch (error) {
        logger.warn("[ExecutionStateManager] Error in global listener", {
          entityId,
          error,
        });
      }
    });
  }

  /**
   * Notify progress listeners for a specific entity
   * @param entityId
   * @param progress
   */
  private notifyProgressListeners(entityId: string, progress: number): void {
    const listeners = this._progressListeners.get(entityId);
    if (listeners) {
      Array.from(listeners).forEach((listener) => {
        try {
          listener(progress, entityId);
        } catch (error) {
          logger.warn("[ExecutionStateManager] Error in progress listener", {
            entityId,
            error,
          });
        }
      });
    }
  }

  /**
   * Assert that this manager has not been disposed
   */
  private assertNotDisposed(): void {
    if (this._disposed) {
      throw new Error("ExecutionStateManager has been disposed");
    }
  }

  // ===========================================================================
  // IDisposable Implementation
  // ===========================================================================

  /**
   * Clean up all resources
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;

    // Clear all maps
    this._states.clear();
    this._progress.clear();
    this._timestamps.clear();
    this._errors.clear();
    this._durations.clear();
    this._startTimes.clear();

    // Clear all listeners
    this._stateListeners.clear();
    this._progressListeners.clear();
    this._globalListeners.clear();

    if (this._config.enableLogging) {
      logger.debug("[ExecutionStateManager] Disposed");
    }
  }

  /**
   * Check if this manager has been disposed
   */
  get disposed(): boolean {
    return this._disposed;
  }
}

/**
 * Create a new ExecutionStateManager instance
 *
 * @param config - Optional configuration
 * @returns New ExecutionStateManager instance
 */
export function createExecutionStateManager(
  config?: ExecutionStateManagerConfig
): ExecutionStateManager {
  return new ExecutionStateManager(config);
}
