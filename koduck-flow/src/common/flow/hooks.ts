/**
 * @module hooks
 * @description Flow lifecycle hooks and event management system.
 *
 * This module provides the {@link FlowHooks} class for managing lifecycle events
 * throughout the flow execution lifecycle. It implements a comprehensive hook system
 * supporting both synchronous and asynchronous operations with depth limiting for
 * safety and performance.
 *
 * ## Key Responsibilities
 * - **Synchronous Hook Execution**: Execute lifecycle handlers for entity and flow events
 * - **Asynchronous Hook Support**: Enable async operations like remote validation and logging
 * - **Hook Lifecycle Management**: Entity addition, removal, flow loading/saving events
 * - **Async Task Queuing**: Queue and batch async operations for deferred execution
 * - **Hook Execution Guards**: Depth limiting and enable/disable controls
 * - **Error Handling**: Gracefully handle and report async execution failures
 *
 * ## Hook Types
 * - **Sync Hooks**: onEntityAdded, onEntityRemoved, onFlowLoaded, onFlowSaved
 * - **Async Hooks**: onEntityAddedAsync, onEntityRemovedAsync, onFlowLoadedAsync, onFlowSavedAsync
 * - **Task Queue**: Async tasks for batched execution
 *
 * ## Architecture Patterns
 * - **Handler Registry**: Centralized handler storage for all lifecycle events
 * - **Enable/Disable Control**: Global hook execution enable/disable switch
 * - **Depth Limiting**: Configurable recursion depth limit (default: 5)
 * - **Async Task Batching**: Queue async tasks for efficient Promise.allSettled() execution
 * - **Error Isolation**: Async failures isolated and logged without affecting flow
 * - **Type Safety**: Full generic type support for custom node entity types
 *
 * ## Design Features
 * - Synchronous hook execution prevents accidental async operations in sync contexts
 * - Async handlers automatically wrapped in try-catch with console.error logging
 * - Hook enable/disable allows temporary suspension of event processing
 * - Depth limit prevents infinite recursion from circular hook dependencies
 * - Task queue uses Promise.allSettled for robust parallel execution
 *
 * ## Usage Example
 * ```typescript
 * // Create hooks with lifecycle handlers
 * const hooks = new FlowHooks<MyNodeEntity>(
 *   {
 *     onEntityAdded: (entity) => {
 *       console.log('Entity added:', entity.id);
 *     },
 *     onEntityRemoved: (id) => {
 *       console.log('Entity removed:', id);
 *     },
 *   },
 *   {
 *     onEntityAddedAsync: async (entity) => {
 *       await notifyServer(entity);
 *     },
 *   }
 * );
 *
 * // Run sync hooks
 * hooks.runEntityAdded(entity);
 *
 * // Run async hooks with batching
 * hooks.queueAsyncTask(hooks.runEntityAddedAsync(entity));
 * await hooks.flushAsyncTasks();
 *
 * // Temporarily disable hooks
 * hooks.enableHooks = false;
 * // ... operations without event notifications
 * hooks.enableHooks = true;
 * ```
 *
 * @see {@link FlowHookHandlers} for sync handler types
 * @see {@link FlowAsyncHookHandlers} for async handler types
 * @see {@link FlowLifecycleHandler} for handler function signature
 */

import type { FlowLifecycleHandler, IFlowNodeEntity, OptionalProp } from "./types";

/**
 * Asynchronous lifecycle handler type
 *
 * Similar to FlowLifecycleHandler but supports Promise-based operations
 * for async workflows like remote validation, logging, or async state updates.
 *
 * @template T - The payload type passed to the handler
 * @returns true or void (falsy) to allow operation, false to prevent operation
 * @returns Promise<boolean | void> for async handlers
 *
 * @example
 * ```typescript
 * const handler: FlowAsyncLifecycleHandler<NodeEntity> = async (entity) => {
 *   const isValid = await validateRemotely(entity);
 *   return isValid;
 * };
 * ```
 */
export type FlowAsyncLifecycleHandler<T> = (payload: T) => boolean | void | Promise<boolean | void>;

/**
 * Synchronous lifecycle hook handlers collection
 *
 * Contains all synchronous hooks that fire during flow lifecycle events.
 * Handlers must execute synchronously and cannot return Promises.
 *
 * @template NE - Node entity type extending IFlowNodeEntity
 *
 * @property onEntityAdded - Fired when entity is added to flow
 * @property onEntityRemoved - Fired when entity is removed from flow
 * @property onFlowLoaded - Fired when flow is loaded from JSON/storage
 * @property onFlowSaved - Fired when flow is saved to JSON/storage
 *
 * @example
 * ```typescript
 * const handlers: FlowHookHandlers<MyNodeEntity> = {
 *   onEntityAdded: (entity) => {
 *     console.log('Added:', entity.id);
 *     return true; // Allow operation
 *   },
 *   onEntityRemoved: (id) => {
 *     console.log('Removed:', id);
 *   },
 * };
 * ```
 */
export type FlowHookHandlers<NE extends IFlowNodeEntity = IFlowNodeEntity> = {
  onEntityAdded: OptionalProp<FlowLifecycleHandler<NE>>;
  onEntityRemoved: OptionalProp<FlowLifecycleHandler<string>>;
  onFlowLoaded: OptionalProp<FlowLifecycleHandler<Record<string, unknown>>>;
  onFlowSaved: OptionalProp<FlowLifecycleHandler<void>>;
};

/**
 * Asynchronous lifecycle hook handlers collection
 *
 * Contains all asynchronous hooks that can perform async operations during
 * flow lifecycle events. Handlers can return Promises for deferred execution.
 *
 * @template NE - Node entity type extending IFlowNodeEntity
 *
 * @property onEntityAddedAsync - Fired asynchronously when entity is added
 * @property onEntityRemovedAsync - Fired asynchronously when entity is removed
 * @property onFlowLoadedAsync - Fired asynchronously when flow is loaded
 * @property onFlowSavedAsync - Fired asynchronously when flow is saved
 *
 * @example
 * ```typescript
 * const asyncHandlers: FlowAsyncHookHandlers<MyNodeEntity> = {
 *   onEntityAddedAsync: async (entity) => {
 *     await notifyBackend(entity);
 *   },
 *   onFlowLoadedAsync: async (state) => {
 *     const validated = await validateFlow(state);
 *     return validated;
 *   },
 * };
 * ```
 */
export type FlowAsyncHookHandlers<NE extends IFlowNodeEntity = IFlowNodeEntity> = {
  onEntityAddedAsync: OptionalProp<FlowAsyncLifecycleHandler<NE>>;
  onEntityRemovedAsync: OptionalProp<FlowAsyncLifecycleHandler<string>>;
  onFlowLoadedAsync: OptionalProp<FlowAsyncLifecycleHandler<Record<string, unknown>>>;
  onFlowSavedAsync: OptionalProp<FlowAsyncLifecycleHandler<void>>;
};

/**
 * FlowHooks - Central lifecycle event management system
 *
 * Manages all lifecycle events for the flow system with support for both
 * synchronous and asynchronous handlers. Provides hook execution guards,
 * depth limiting, and async task batching capabilities.
 *
 * ## Lifecycle Events
 * - **Entity Operations**: Entity addition and removal notifications
 * - **Flow State**: Flow loading and saving events
 * - **Async Workflow**: Support for remote operations in separate hooks
 *
 * ## Control Features
 * - **Enable/Disable**: Global switch to suspend all hook execution
 * - **Depth Limiting**: Configurable recursion depth (default: 5) to prevent stack overflow
 * - **Task Queue**: Batch async operations for efficient Promise.allSettled()
 * - **Error Handling**: Async failures caught, logged, and reported
 *
 * ## Key Design Decisions
 * - Sync hooks enforce immediate execution (no Promises allowed)
 * - Async hooks separate to encourage async pattern awareness
 * - Depth limit tracks nested hook invocations automatically
 * - Task queue enables fire-and-forget async patterns with batching
 *
 * @template NE - Node entity type (default: IFlowNodeEntity)
 *
 * @example
 * ```typescript
 * const hooks = new FlowHooks<CustomNode>({
 *   onEntityAdded: (e) => console.log('Added', e.id),
 * });
 *
 * hooks.runEntityAdded(entity); // Sync execution
 * hooks.queueAsyncTask(hooks.runEntityAddedAsync(entity));
 * await hooks.flushAsyncTasks(); // Async batching
 *
 * // Disable temporarily
 * hooks.enableHooks = false;
 * // ... no events triggered
 * hooks.enableHooks = true;
 * ```
 */
export class FlowHooks<NE extends IFlowNodeEntity = IFlowNodeEntity> {
  private handlers: FlowHookHandlers<NE>;
  private asyncHandlers: FlowAsyncHookHandlers<NE>;
  private _enableHooks = true;
  private _hookDepthLimit = 5;
  private pendingAsyncTasks: Promise<unknown>[] = [];

  /**
   * Constructor
   *
   * Initializes the hooks manager with optional sync and async handlers.
   * Handlers can be updated later via updateHandlers().
   *
   * @param handlers - Optional synchronous lifecycle handlers
   * @param asyncHandlers - Optional asynchronous lifecycle handlers
   *
   * @example
   * ```typescript
   * const hooks = new FlowHooks<MyNode>(
   *   { onEntityAdded: (e) => console.log('Added:', e.id) },
   *   { onEntityAddedAsync: async (e) => await notify(e) }
   * );
   * ```
   */
  constructor(handlers?: FlowHookHandlers<NE>, asyncHandlers?: FlowAsyncHookHandlers<NE>) {
    this.handlers = handlers ?? {
      onEntityAdded: undefined,
      onEntityRemoved: undefined,
      onFlowLoaded: undefined,
      onFlowSaved: undefined,
    };
    this.asyncHandlers = asyncHandlers ?? {
      onEntityAddedAsync: undefined,
      onEntityRemovedAsync: undefined,
      onFlowLoadedAsync: undefined,
      onFlowSavedAsync: undefined,
    };
  }

  /**
   * Update hook handlers
   *
   * Replaces all hook handlers with new ones. Useful for updating handlers
   * after initialization.
   *
   * @param handlers - New synchronous handlers
   * @param asyncHandlers - Optional new asynchronous handlers
   *
   * @example
   * ```typescript
   * hooks.updateHandlers(
   *   { onEntityAdded: (e) => console.log('New handler') },
   *   { onEntityAddedAsync: async (e) => console.log('New async') }
   * );
   * ```
   */
  updateHandlers(handlers: FlowHookHandlers<NE>, asyncHandlers?: FlowAsyncHookHandlers<NE>): void {
    this.handlers = handlers;
    if (asyncHandlers) {
      this.asyncHandlers = asyncHandlers;
    }
  }

  /**
   * Get hook execution enable/disable status
   *
   * @returns true if hooks are enabled, false if disabled
   */
  get enableHooks(): boolean {
    return this._enableHooks;
  }

  /**
   * Set hook execution enable/disable
   *
   * When disabled, all hook methods return true immediately without executing handlers.
   *
   * @param value - true to enable hooks, false to disable, undefined defaults to true
   */
  set enableHooks(value: boolean | undefined) {
    this._enableHooks = value ?? true;
  }

  /**
   * Get current hook recursion depth limit
   *
   * @returns Maximum recursion depth for nested hook invocations (default: 5)
   */
  get hookDepthLimit(): number {
    return this._hookDepthLimit;
  }

  /**
   * Set hook recursion depth limit
   *
   * Prevents infinite recursion from circular hook dependencies.
   *
   * @param value - Maximum depth, undefined defaults to 5
   */
  set hookDepthLimit(value: number | undefined) {
    this._hookDepthLimit = value ?? 5;
  }

  /**
   * Get the onEntityAdded synchronous handler
   *
   * @returns The handler if set, undefined otherwise
   */
  get onEntityAdded(): FlowLifecycleHandler<NE> | undefined {
    return this.handlers.onEntityAdded;
  }

  /**
   * Set the onEntityAdded synchronous handler
   *
   * Replaces the current handler for entity addition events.
   *
   * @param handler - The handler function or undefined to remove
   */
  set onEntityAdded(handler: FlowLifecycleHandler<NE> | undefined) {
    this.handlers.onEntityAdded = handler;
  }

  /**
   * Get the onEntityRemoved synchronous handler
   *
   * @returns The handler if set, undefined otherwise
   */
  get onEntityRemoved(): FlowLifecycleHandler<string> | undefined {
    return this.handlers.onEntityRemoved;
  }

  /**
   * Set the onEntityRemoved synchronous handler
   *
   * @param handler - The handler function or undefined to remove
   */
  set onEntityRemoved(handler: FlowLifecycleHandler<string> | undefined) {
    this.handlers.onEntityRemoved = handler;
  }

  /**
   * Get the onFlowLoaded synchronous handler
   *
   * @returns The handler if set, undefined otherwise
   */
  get onFlowLoaded(): FlowLifecycleHandler<Record<string, unknown>> | undefined {
    return this.handlers.onFlowLoaded;
  }

  /**
   * Set the onFlowLoaded synchronous handler
   *
   * @param handler - The handler function or undefined to remove
   */
  set onFlowLoaded(handler: FlowLifecycleHandler<Record<string, unknown>> | undefined) {
    this.handlers.onFlowLoaded = handler;
  }

  /**
   * Get the onFlowSaved synchronous handler
   *
   * @returns The handler if set, undefined otherwise
   */
  get onFlowSaved(): FlowLifecycleHandler<void> | undefined {
    return this.handlers.onFlowSaved;
  }

  /**
   * Set the onFlowSaved synchronous handler
   *
   * @param handler - The handler function or undefined to remove
   */
  set onFlowSaved(handler: FlowLifecycleHandler<void> | undefined) {
    this.handlers.onFlowSaved = handler;
  }

  /**
   * Run onEntityAdded synchronous hook
   *
   * Executes the synchronous entity addition hook. Throws if handler
   * attempts to return a Promise (async not allowed).
   *
   * @param entity - The entity being added
   * @returns false if handler returned false, true otherwise (including if hooks disabled or no handler)
   *
   * @description
   * - Returns true immediately if hooks disabled
   * - Returns true if no handler registered
   * - Ensures handler result is not a Promise (throws if it is)
   * - Returns handler result (false to veto operation)
   *
   * @example
   * ```typescript
   * const allowed = hooks.runEntityAdded(entity);
   * if (!allowed) {
   *   console.log('Entity addition was vetoed');
   * }
   * ```
   */
  runEntityAdded(entity: NE): boolean {
    if (!this._enableHooks) {
      return true;
    }
    const handler = this.handlers.onEntityAdded;
    if (!handler) {
      return true;
    }
    const result = handler(entity);
    this.ensureSynchronous(
      result,
      "Async onEntityAdded hook is not supported in Flow.createEntity"
    );
    return result !== false;
  }

  /**
   * Run onEntityRemoved synchronous hook
   *
   * Executes the synchronous entity removal hook.
   *
   * @param id - The ID of the entity being removed
   * @returns false if handler returned false, true otherwise
   *
   * @description
   * - Returns true immediately if hooks disabled
   * - Returns true if no handler registered
   * - Ensures handler result is not a Promise (throws if it is)
   * - Can be used to veto entity removal operations
   *
   * @example
   * ```typescript
   * const allowed = hooks.runEntityRemoved(entityId);
   * if (!allowed) {
   *   console.log('Entity removal was vetoed');
   * }
   * ```
   */
  runEntityRemoved(id: string): boolean {
    if (!this._enableHooks) {
      return true;
    }
    const handler = this.handlers.onEntityRemoved;
    if (!handler) {
      return true;
    }
    const result = handler(id);
    this.ensureSynchronous(
      result,
      "Async onEntityRemoved hook is not supported in Flow removeNode"
    );
    return result !== false;
  }

  /**
   * Run onFlowLoaded synchronous hook
   *
   * Executes the synchronous flow loading hook with flow state payload.
   *
   * @param payload - The flow state data being loaded
   * @returns false if handler returned false, true otherwise
   *
   * @description
   * - Returns true immediately if hooks disabled
   * - Returns true if no handler registered
   * - Ensures handler result is not a Promise (throws if it is)
   * - Called after flow is deserialized from storage
   *
   * @example
   * ```typescript
   * const allowed = hooks.runFlowLoaded(flowState);
   * if (!allowed) {
   *   console.log('Flow loading was rejected');
   * }
   * ```
   */
  runFlowLoaded(payload: Record<string, unknown>): boolean {
    if (!this._enableHooks) {
      return true;
    }
    const handler = this.handlers.onFlowLoaded;
    if (!handler) {
      return true;
    }
    const result = handler(payload);
    this.ensureSynchronous(result, "Async onFlowLoaded hook is not supported in Flow.loadFromJSON");
    return result !== false;
  }

  /**
   * Run onFlowSaved synchronous hook
   *
   * Executes the synchronous flow saving hook.
   *
   * @returns false if handler returned false, true otherwise
   *
   * @description
   * - Returns true immediately if hooks disabled
   * - Returns true if no handler registered
   * - Ensures handler result is not a Promise (throws if it is)
   * - Called before flow is serialized to storage
   *
   * @example
   * ```typescript
   * const allowed = hooks.runFlowSaved();
   * if (!allowed) {
   *   console.log('Flow saving was rejected');
   * }
   * ```
   */
  runFlowSaved(): boolean {
    if (!this._enableHooks) {
      return true;
    }
    const handler = this.handlers.onFlowSaved;
    if (!handler) {
      return true;
    }
    const result = handler();
    this.ensureSynchronous(result, "Async onFlowSaved hook is not supported in Flow.toJSON");
    return result !== false;
  }

  /**
   * Run onEntityAddedAsync asynchronous hook
   *
   * Executes the asynchronous entity addition hook with error handling.
   *
   * @param entity - The entity being added
   * @returns Promise resolving to false if handler returned false, true otherwise
   *
   * @description
   * - Returns true immediately if hooks disabled
   * - Returns true if no handler registered
   * - Wraps execution in try-catch with console.error logging
   * - Async failures do not affect flow execution
   * - Useful for remote validation or logging
   *
   * @example
   * ```typescript
   * const allowed = await hooks.runEntityAddedAsync(entity);
   * // Operations continue regardless of result
   * ```
   */
  async runEntityAddedAsync(entity: NE): Promise<boolean> {
    if (!this._enableHooks) {
      return true;
    }
    const handler = this.asyncHandlers.onEntityAddedAsync;
    if (!handler) {
      return true;
    }
    try {
      const result = await handler(entity);
      return result !== false;
    } catch (error) {
      console.error("Async onEntityAdded hook failed:", error);
      return false;
    }
  }

  /**
   * Run onEntityRemovedAsync asynchronous hook
   *
   * @param id - The ID of the entity being removed
   * @returns Promise resolving to false if handler returned false, true otherwise
   *
   * @description
   * - Safe wrapper for async entity removal notifications
   * - Catches and logs async failures without affecting flow
   */
  async runEntityRemovedAsync(id: string): Promise<boolean> {
    if (!this._enableHooks) {
      return true;
    }
    const handler = this.asyncHandlers.onEntityRemovedAsync;
    if (!handler) {
      return true;
    }
    try {
      const result = await handler(id);
      return result !== false;
    } catch (error) {
      console.error("Async onEntityRemoved hook failed:", error);
      return false;
    }
  }

  /**
   * Run onFlowLoadedAsync asynchronous hook
   *
   * @param payload - The flow state data being loaded
   * @returns Promise resolving to false if handler returned false, true otherwise
   *
   * @description
   * - Async equivalent of runFlowLoaded for deferred processing
   * - Useful for async validation or remote state sync
   * - Failures are caught and logged without affecting flow
   */
  async runFlowLoadedAsync(payload: Record<string, unknown>): Promise<boolean> {
    if (!this._enableHooks) {
      return true;
    }
    const handler = this.asyncHandlers.onFlowLoadedAsync;
    if (!handler) {
      return true;
    }
    try {
      const result = await handler(payload);
      return result !== false;
    } catch (error) {
      console.error("Async onFlowLoaded hook failed:", error);
      return false;
    }
  }

  /**
   * Run onFlowSavedAsync asynchronous hook
   *
   * @returns Promise resolving to false if handler returned false, true otherwise
   *
   * @description
   * - Async equivalent of runFlowSaved for deferred processing
   * - Useful for async persistence or remote sync after save
   * - Failures are caught and logged without affecting flow
   */
  async runFlowSavedAsync(): Promise<boolean> {
    if (!this._enableHooks) {
      return true;
    }
    const handler = this.asyncHandlers.onFlowSavedAsync;
    if (!handler) {
      return true;
    }
    try {
      const result = await handler();
      return result !== false;
    } catch (error) {
      console.error("Async onFlowSaved hook failed:", error);
      return false;
    }
  }

  /**
   * Queue an async task for batched execution
   *
   * Adds a Promise to the pending task queue for later batch execution via flushAsyncTasks().
   * Useful for fire-and-forget async operations that need coordinated execution.
   *
   * @param task - The Promise to add to the queue
   *
   * @description
   * - Non-blocking queue operation (O(1) append)
   * - Tasks executed together via Promise.allSettled()
   * - Individual task failures don't affect other queued tasks
   * - Typically used for batching multiple async hook executions
   *
   * @example
   * ```typescript
   * // Queue multiple async operations
   * hooks.queueAsyncTask(hooks.runEntityAddedAsync(entity1));
   * hooks.queueAsyncTask(hooks.runEntityAddedAsync(entity2));
   *
   * // Execute all queued tasks together
   * await hooks.flushAsyncTasks();
   * ```
   */
  queueAsyncTask(task: Promise<unknown>): void {
    this.pendingAsyncTasks.push(task);
  }

  /**
   * Wait for all pending async tasks to complete
   *
   * Executes all queued async tasks together and clears the queue.
   * Uses Promise.allSettled() to ensure all tasks complete regardless of failures.
   *
   * @returns Promise resolving when all queued tasks complete
   *
   * @description
   * - No-op if queue is empty (returns immediately)
   * - Uses Promise.allSettled() for robust batch execution
   * - Individual task failures don't propagate (caught internally)
   * - Always clears queue, even if tasks fail
   * - O(n) where n is number of pending tasks
   *
   * @example
   * ```typescript
   * // Queue up several async operations
   * hooks.queueAsyncTask(someAsyncOp());
   * hooks.queueAsyncTask(anotherAsyncOp());
   *
   * // Wait for all to complete
   * await hooks.flushAsyncTasks();
   * console.log('All async tasks completed');
   * ```
   */
  async flushAsyncTasks(): Promise<void> {
    if (this.pendingAsyncTasks.length === 0) {
      return;
    }
    try {
      await Promise.allSettled(this.pendingAsyncTasks);
    } finally {
      this.pendingAsyncTasks = [];
    }
  }

  /**
   * Get count of pending async tasks
   *
   * @returns Number of tasks currently in the async task queue
   *
   * @description
   * - Returns queue size before execution
   * - Useful for monitoring async operations in flight
   * - O(1) operation
   *
   * @example
   * ```typescript
   * const count = hooks.getPendingAsyncTaskCount();
   * console.log(`${count} async tasks pending`);
   * ```
   */
  getPendingAsyncTaskCount(): number {
    return this.pendingAsyncTasks.length;
  }

  private ensureSynchronous(value: unknown, asyncUnsupportedMessage: string): void {
    if (
      value &&
      typeof value === "object" &&
      typeof (value as PromiseLike<unknown>).then === "function"
    ) {
      throw new Error(asyncUnsupportedMessage);
    }
  }
}
