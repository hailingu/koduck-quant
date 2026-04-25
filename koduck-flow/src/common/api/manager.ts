/**
 * Manager registry API for DuckFlow system component management.
 *
 * Wraps registration and lookup operations against the runtime manager registry.
 * All calls forward to the runtime proxy, ensuring consumers interact with the same
 * manager lifecycle that the core engine uses. Managers in DuckFlow are system
 * components (like RenderManager, LayoutManager, etc.) that handle specific concerns.
 *
 * The Manager API provides functionality for:
 * 1. Manager registration with optional configuration
 * 2. Manager lookup and type-safe retrieval
 * 3. Manager existence checking
 * 4. Enumeration of all registered managers
 *
 * Usage example:
 * ```typescript
 * import { registerManager, getManager, hasManager } from './manager';
 *
 * // Register a custom manager
 * const success = registerManager('myManager', {
 *   initialize: () => console.log('Initialized'),
 *   execute: (data) => console.log('Executing', data)
 * });
 *
 * // Check and retrieve the manager
 * if (hasManager('myManager')) {
 *   const manager = getManager('myManager');
 *   manager?.execute('test');
 * }
 * ```
 *
 * @module manager
 * @see {@link ./entity | Entity API}
 * @see {@link ./render | Render API}
 * @see {@link ./flow | Flow API}
 */
import { runtime } from "./runtime-context";

/**
 * Registers a manager in the runtime manager registry.
 *
 * Registers a manager (system component) with the active `DuckFlowRuntime`. Once registered,
 * the manager is available to other components through the manager lookup API. The registration
 * is wrapped in error handling that logs failures and returns a boolean result.
 *
 * @param {string} name - The unique name to register the manager under.
 * @param {Record<string, unknown>} manager - The manager object/component to register.
 * @param {Record<string, unknown>} [options] - Optional configuration for the manager.
 * @returns {boolean} true if registration succeeded, false if it failed or threw an error.
 *
 * Usage example:
 * ```typescript
 * import { registerManager } from './manager';
 *
 * const renderManager = {
 * render: (entity) => console.log('Rendering', entity),
 * setDefaultRenderer: (type) => console.log('Setting renderer:', type)
 * };
 *
 * const success = registerManager('render', renderManager, { priority: 'high' });
 * if (success) {
 * console.log('RenderManager registered');
 * } else {
 * console.log('Failed to register RenderManager');
 * }
 * ```
 *
 * @see {@link getManager | getManager} to retrieve a registered manager
 * @see {@link hasManager | hasManager} to check if a manager is registered
 */
export function registerManager(
  name: string,
  manager: Record<string, unknown>,
  options?: Record<string, unknown>
): boolean {
  try {
    runtime.registerManager(name, manager as never, options);
    return true;
  } catch (error) {
    console.error(`Failed to register manager ${name}:`, error);
    return false;
  }
}

/**
 * Retrieves a manager from the registry by name with optional type safety.
 *
 * Retrieves a manager from the active `DuckFlowRuntime` manager registry by its name.
 * Supports generic type parameter for type-safe usage. Returns undefined if the manager
 * is not found or if an error occurs during retrieval.
 *
 * @template T - The type of the manager (defaults to Record<string, unknown>).
 * @param {string} name - The name of the manager to retrieve.
 * @returns {T | undefined} The manager instance or undefined if not found or on error.
 *
 * Usage example:
 * ```typescript
 * import { getManager } from './manager';
 *
 * interface RenderManager {
 * render: (entity: any) => Promise<any>;
 * setDefaultRenderer: (type: string) => void;
 * }
 *
 * const renderManager = getManager<RenderManager>('render');
 * if (renderManager) {
 * await renderManager.render(entity);
 * }
 *
 * const generic = getManager('render');
 * console.log(typeof generic);
 * ```
 *
 * @see {@link hasManager | hasManager} to check existence before retrieval
 * @see {@link registerManager | registerManager} to register a manager
 * @see {@link getAllManagerNames | getAllManagerNames} to list all managers
 */
export function getManager<T = Record<string, unknown>>(name: string): T | undefined {
  try {
    return runtime.getManager(name) as T;
  } catch (error) {
    console.error(`Failed to get manager ${name}:`, error);
    return undefined;
  }
}

/**
 * Checks if a manager is registered in the runtime.
 *
 * Determines whether a manager with the given name exists in the active
 * `DuckFlowRuntime` manager registry. Returns false if any error occurs.
 *
 * @param {string} name - The name of the manager to check for.
 * @returns {boolean} true if manager is registered, false otherwise or on error.
 *
 * Usage example:
 * ```typescript
 * import { hasManager, getManager } from './manager';
 *
 * if (hasManager('render')) {
 * const renderManager = getManager('render');
 * console.log('RenderManager is available');
 * }
 * ```
 *
 * @see {@link getManager | getManager} to retrieve a manager
 * @see {@link registerManager | registerManager} to register a manager
 */
export function hasManager(name: string): boolean {
  try {
    return runtime.hasManager(name);
  } catch {
    return false;
  }
}

/**
 * Retrieves the names of all registered managers.
 *
 * Returns an array of names of all managers currently registered in the active
 * `DuckFlowRuntime`. Useful for debugging or enumerating available system components.
 * Returns an empty array if an error occurs.
 *
 * @returns {string[]} Array of manager names, empty array if none or on error.
 *
 * Usage example:
 * ```typescript
 * import { getAllManagerNames, getManager } from './manager';
 *
 * const managerNames = getAllManagerNames();
 * console.log('Registered managers:', managerNames);
 *
 * managerNames.forEach(name => {
 * const manager = getManager(name);
 * console.log(`Manager '${name}':`, manager);
 * });
 * ```
 *
 * @see {@link hasManager | hasManager} to check if specific manager is registered
 * @see {@link getManager | getManager} to retrieve a specific manager
 * @see {@link registerManager | registerManager} to register a new manager
 */
export function getAllManagerNames(): string[] {
  try {
    return runtime.getRegisteredManagers();
  } catch (error) {
    console.error("Failed to get manager names:", error);
    return [];
  }
}
