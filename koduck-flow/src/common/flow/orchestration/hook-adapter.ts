/**
 * @module orchestration/hook-adapter
 * @description Hook adapter layer for Flow lifecycle management
 *
 * This module provides an adapter that maps Flow facade properties to FlowHooks
 * and manages hook execution with enable/disable and depth limiting controls.
 * It serves as the interface between the Flow public API and the internal FlowHooks system.
 *
 * ## Responsibilities
 * - **Property Mapping**: Map Flow hook properties (onEntityAdded, etc.) to FlowHooks handlers
 * - **Hook Execution**: Provide run* methods to execute registered hooks
 * - **Control Proxying**: Enable/disable and depth limit controls through properties
 * - **Error Handling**: Maintain consistent error behavior with hook execution
 *
 * ## Hook Types Supported
 * - **Sync Hooks**: onEntityAdded, onEntityRemoved, onFlowLoaded, onFlowSaved
 * - **Async Hooks**: onEntityAddedAsync, onEntityRemovedAsync, onFlowLoadedAsync, onFlowSavedAsync
 *
 * @see {@link FlowHooks} for underlying hook implementation
 */

import type { FlowLifecycleHandler, IFlowNodeEntity } from "../types";
import type { FlowHooks } from "../hooks";

/**
 * HookAdapter - Manages hook property mapping and execution
 *
 * Provides a clean interface for accessing and modifying hooks through property accessors,
 * while delegating actual execution to the underlying FlowHooks instance.
 *
 * ## Design Pattern
 * Adapter pattern: Adapts FlowHooks interface to Flow facade requirements
 * - Provides getter/setter properties for each hook
 * - Delegates execution to FlowHooks methods
 * - Proxies enable/disable and depth limit controls
 *
 * @template NE - Node entity type extending IFlowNodeEntity
 *
 * @example
 * ```typescript
 * const hooks = new FlowHooks<MyNodeEntity>();
 * const adapter = new HookAdapter(hooks);
 *
 * // Set hooks via properties
 * adapter.onEntityAdded = (entity) => console.log('Added:', entity.id);
 * adapter.onEntityRemoved = (id) => console.log('Removed:', id);
 *
 * // Execute hooks
 * const allowed = adapter.runEntityAdded(entity);
 * const removedAllowed = adapter.runEntityRemoved(entityId);
 *
 * // Control hooks
 * adapter.enableHooks = false; // Disable all hooks
 * adapter.hookDepthLimit = 10; // Set recursion limit
 * ```
 */
export class HookAdapter<NE extends IFlowNodeEntity = IFlowNodeEntity> {
  private readonly hooksInstance: FlowHooks<NE>;

  /**
   * Constructor
   *
   * Initializes the adapter with a FlowHooks instance.
   *
   * @param hooksInstance - The underlying FlowHooks instance
   *
   * @example
   * ```typescript
   * const adapter = new HookAdapter(flowCore.getHooks());
   * ```
   */
  constructor(hooksInstance: FlowHooks<NE>) {
    this.hooksInstance = hooksInstance;
  }

  private get hooks(): FlowHooks<NE> {
    return this.hooksInstance;
  }

  /**
   * Get hook execution enable/disable status
   *
   * @returns true if hooks are enabled, false if disabled
   */
  get enableHooks(): boolean {
    return this.hooks.enableHooks;
  }

  /**
   * Set hook execution enable/disable
   *
   * When disabled, all hook execution methods return true immediately without running handlers.
   *
   * @param value - true to enable hooks, false to disable
   */
  set enableHooks(value: boolean) {
    this.hooks.enableHooks = value;
  }

  /**
   * Get current hook recursion depth limit
   *
   * @returns Maximum recursion depth for nested hook invocations
   */
  get hookDepthLimit(): number {
    return this.hooks.hookDepthLimit;
  }

  /**
   * Set hook recursion depth limit
   *
   * Prevents infinite recursion from circular hook dependencies.
   *
   * @param value - Maximum depth (default: 5)
   */
  set hookDepthLimit(value: number) {
    this.hooks.hookDepthLimit = value;
  }

  /**
   * Get the onEntityAdded synchronous handler
   *
   * @returns The handler if set, undefined otherwise
   */
  get onEntityAdded(): FlowLifecycleHandler<NE> | undefined {
    return this.hooks.onEntityAdded;
  }

  /**
   * Set the onEntityAdded synchronous handler
   *
   * Replaces the current handler for entity addition events.
   *
   * @param handler - The handler function or undefined to remove
   */
  set onEntityAdded(handler: FlowLifecycleHandler<NE> | undefined) {
    this.hooks.onEntityAdded = handler;
  }

  /**
   * Get the onEntityRemoved synchronous handler
   *
   * @returns The handler if set, undefined otherwise
   */
  get onEntityRemoved(): FlowLifecycleHandler<string> | undefined {
    return this.hooks.onEntityRemoved;
  }

  /**
   * Set the onEntityRemoved synchronous handler
   *
   * @param handler - The handler function or undefined to remove
   */
  set onEntityRemoved(handler: FlowLifecycleHandler<string> | undefined) {
    this.hooks.onEntityRemoved = handler;
  }

  /**
   * Get the onFlowLoaded synchronous handler
   *
   * @returns The handler if set, undefined otherwise
   */
  get onFlowLoaded(): FlowLifecycleHandler<Record<string, unknown>> | undefined {
    return this.hooks.onFlowLoaded;
  }

  /**
   * Set the onFlowLoaded synchronous handler
   *
   * @param handler - The handler function or undefined to remove
   */
  set onFlowLoaded(handler: FlowLifecycleHandler<Record<string, unknown>> | undefined) {
    this.hooks.onFlowLoaded = handler;
  }

  /**
   * Get the onFlowSaved synchronous handler
   *
   * @returns The handler if set, undefined otherwise
   */
  get onFlowSaved(): FlowLifecycleHandler<void> | undefined {
    return this.hooks.onFlowSaved;
  }

  /**
   * Set the onFlowSaved synchronous handler
   *
   * @param handler - The handler function or undefined to remove
   */
  set onFlowSaved(handler: FlowLifecycleHandler<void> | undefined) {
    this.hooks.onFlowSaved = handler;
  }

  /**
   * Run onEntityAdded synchronous hook
   *
   * Executes the entity addition hook with error handling and enable/disable checks.
   *
   * @param entity - The entity being added
   * @returns false if handler returned false or vetoed the operation, true otherwise
   *
   * @example
   * ```typescript
   * const allowed = adapter.runEntityAdded(entity);
   * if (!allowed) {
   *   console.log('Entity addition was vetoed by hook');
   * }
   * ```
   */
  runEntityAdded(entity: NE): boolean {
    return this.hooks.runEntityAdded(entity);
  }

  /**
   * Run onEntityRemoved synchronous hook
   *
   * Executes the entity removal hook.
   *
   * @param id - The ID of the entity being removed
   * @returns false if handler returned false or vetoed the operation, true otherwise
   *
   * @example
   * ```typescript
   * const allowed = adapter.runEntityRemoved(entityId);
   * ```
   */
  runEntityRemoved(id: string): boolean {
    return this.hooks.runEntityRemoved(id);
  }

  /**
   * Run onFlowLoaded synchronous hook
   *
   * Executes the flow loading hook with state payload.
   *
   * @param payload - The flow state data being loaded
   * @returns false if handler returned false or rejected the operation, true otherwise
   *
   * @example
   * ```typescript
   * const allowed = adapter.runFlowLoaded(flowState);
   * ```
   */
  runFlowLoaded(payload: Record<string, unknown>): boolean {
    return this.hooks.runFlowLoaded(payload);
  }

  /**
   * Run onFlowSaved synchronous hook
   *
   * Executes the flow saving hook.
   *
   * @returns false if handler returned false or rejected the operation, true otherwise
   *
   * @example
   * ```typescript
   * const allowed = adapter.runFlowSaved();
   * ```
   */
  runFlowSaved(): boolean {
    return this.hooks.runFlowSaved();
  }

  /**
   * Run onEntityAddedAsync asynchronous hook
   *
   * Executes the asynchronous entity addition hook with error handling.
   * Async failures do not affect flow execution.
   *
   * @param entity - The entity being added
   * @returns Promise resolving to false if handler returned false, true otherwise
   *
   * @example
   * ```typescript
   * const allowed = await adapter.runEntityAddedAsync(entity);
   * ```
   */
  async runEntityAddedAsync(entity: NE): Promise<boolean> {
    return this.hooks.runEntityAddedAsync(entity);
  }

  /**
   * Run onEntityRemovedAsync asynchronous hook
   *
   * Executes the asynchronous entity removal hook.
   *
   * @param id - The ID of the entity being removed
   * @returns Promise resolving to false if handler returned false, true otherwise
   *
   * @example
   * ```typescript
   * const allowed = await adapter.runEntityRemovedAsync(entityId);
   * ```
   */
  async runEntityRemovedAsync(id: string): Promise<boolean> {
    return this.hooks.runEntityRemovedAsync(id);
  }

  /**
   * Run onFlowLoadedAsync asynchronous hook
   *
   * Executes the asynchronous flow loading hook.
   *
   * @param payload - The flow state data being loaded
   * @returns Promise resolving to false if handler returned false, true otherwise
   *
   * @example
   * ```typescript
   * const allowed = await adapter.runFlowLoadedAsync(flowState);
   * ```
   */
  async runFlowLoadedAsync(payload: Record<string, unknown>): Promise<boolean> {
    return this.hooks.runFlowLoadedAsync(payload);
  }

  /**
   * Run onFlowSavedAsync asynchronous hook
   *
   * Executes the asynchronous flow saving hook.
   *
   * @returns Promise resolving to false if handler returned false, true otherwise
   *
   * @example
   * ```typescript
   * const allowed = await adapter.runFlowSavedAsync();
   * ```
   */
  async runFlowSavedAsync(): Promise<boolean> {
    return this.hooks.runFlowSavedAsync();
  }
}
