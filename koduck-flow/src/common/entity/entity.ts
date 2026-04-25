/**
 * Entity Module - Core Entity Base Class Implementation
 *
 * Provides the default concrete implementation of the IEntity interface.
 * All entities in Duck Flow inherit from or implement this class/interface.
 *
 * **Purpose**:
 * - Implements basic entity contract with id, data, config management
 * - Provides lifecycle management (initialization, disposal)
 * - Offers type identification and resource cleanup
 * - Supports generic data and configuration payloads
 *
 * **Design Principles**:
 * - **Minimal**: Only implements core entity requirements
 * - **Extensible**: Generic type parameters for flexible data/config
 * - **Safe**: Private data with null-protection in setters
 * - **Traceable**: Unique ID generation for each entity
 *
 * **Typical Usage**:
 * ```typescript
 * // Define custom entity with specific data and config types
 * interface MyEntityData extends Data {
 *   name: string;
 *   version: number;
 * }
 *
 * interface MyEntityConfig extends IEntityArguments {
 *   theme?: string;
 * }
 *
 * // Create instance
 * const entity = new Entity<MyEntityData, MyEntityConfig>();
 * entity.data = { name: "My Entity", version: 1 };
 * entity.config = { theme: "dark" };
 *
 * // Use entity
 * console.log(entity.id);       // Unique ID
 * console.log(entity.type);      // "Entity" or subclass name
 * console.log(entity.isDisposed); // false
 *
 * // Clean up when done
 * entity.dispose();
 * console.log(entity.isDisposed); // true
 * ```
 *
 * **Performance Notes**:
 * - ID generation: O(1) using nanoid()
 * - Property access: O(1) via getters/setters
 * - Disposal: O(1), only clears references
 *
 * **Thread Safety**:
 * - No built-in synchronization
 * - Safe for concurrent reads after initialization
 * - Not safe for concurrent modifications
 *
 * @template D - Data type, extends Data (typically Record<string, unknown>)
 * @template C - Configuration type, extends IEntityArguments
 *
 * @see {@link IEntity} - Interface this class implements
 * @see {@link IDisposable} - Disposal contract
 */

import { nanoid } from "nanoid";
import type { Data } from "../data";
import { type IEntity, type IEntityArguments, type IEntityConstructor } from "./types";

/**
 * Backward-compatible type alias for EntityArguments.
 * Use IEntityArguments directly for new code.
 *
 * @deprecated Use IEntityArguments instead
 * @see {@link IEntityArguments}
 */
export type EntityArguments = IEntityArguments;

/**
 * Default Entity Implementation
 *
 * Concrete class providing complete implementation of IEntity interface.
 * Manages entity lifecycle including creation, state management, and disposal.
 * Suitable for use as base class or standalone entity.
 *
 * **Features**:
 * - Automatic unique ID generation (nanoid)
 * - Flexible data and configuration storage
 * - Type identification via constructor
 * - Resource cleanup via dispose()
 * - Protection against access after disposal
 *
 * **Type Parameters**:
 * - D: Data type (default: Data = Record<string, unknown>)
 * - C: Configuration type (default: IEntityArguments)
 *
 * **Example**:
 * ```typescript
 * const entity = new Entity<{ name: string }>();
 * entity.data = { name: "Flow Node" };
 * entity.config = {};
 * console.log(entity.type); // "Entity"
 * ```
 */
export class Entity<D extends Data = Data, C extends IEntityArguments = IEntityArguments>
  implements IEntity<D, C>
{
  protected _id: string;

  private _data: D | undefined;

  private _config: C | undefined;

  private _disposed = false;

  /**
   * Creates a new Entity instance with auto-generated unique ID.
   *
   * Uses nanoid() for ID generation, ensuring uniqueness across distributed systems.
   * Entity starts in non-disposed state and ready for use.
   *
   * @example
   * ```typescript
   * const entity = new Entity();
   * console.log(entity.id); // "V1StGXR_Z5j3eK..."
   * ```
   */
  constructor() {
    this._id = nanoid();
  }

  /**
   * Gets the unique identifier for this entity.
   *
   * ID is generated at construction time using nanoid() and remains unchanged
   * throughout the entity's lifetime. Suitable for use as map key or reference.
   *
   * @returns Unique entity identifier string
   *
   * @example
   * ```typescript
   * const entity = new Entity();
   * const id = entity.id; // "V1StGXR_Z5j3eK..."
   * ```
   */
  get id(): string {
    return this._id;
  }

  /**
   * Gets the data associated with this entity.
   *
   * Data is arbitrary business logic data associated with the entity.
   * Type is determined by the generic parameter D.
   * Initially undefined until explicitly set.
   *
   * @returns Current data payload or undefined if not set
   *
   * @example
   * ```typescript
   * const entity = new Entity<{ name: string }>();
   * console.log(entity.data); // undefined
   * entity.data = { name: "Node 1" };
   * console.log(entity.data.name); // "Node 1"
   * ```
   */
  get data(): D | undefined {
    return this._data;
  }

  /**
   * Gets the configuration associated with this entity.
   *
   * Configuration is usually used for entity setup and behavioral customization.
   * Type is determined by the generic parameter C (typically IEntityArguments).
   * Initially undefined until explicitly set.
   *
   * @returns Current configuration or undefined if not set
   *
   * @example
   * ```typescript
   * interface MyConfig extends IEntityArguments {
   *   theme: string;
   * }
   * const entity = new Entity<Data, MyConfig>();
   * entity.config = { theme: "dark" };
   * ```
   */
  get config(): C | undefined {
    return this._config;
  }

  /**
   * Gets the type identifier for this entity.
   *
   * Determined from the entity's constructor in this order:
   * 1. Static `type` property if defined on constructor
   * 2. Constructor function name as fallback
   * 3. "Entity" as ultimate fallback
   *
   * Used for entity classification and factory creation.
   *
   * @returns Type identifier string
   *
   * @example
   * ```typescript
   * class CustomNode extends Entity {
   *   static type = "CustomNode";
   * }
   * const entity = new CustomNode();
   * console.log(entity.type); // "CustomNode"
   * ```
   */
  get type(): string {
    const constructor = this.constructor as IEntityConstructor;
    return constructor.type || (this.constructor as { name: string }).name || "Entity";
  }

  /**
   * Checks if this entity has been disposed.
   *
   * Once disposed, data and config are cleared and further modifications are rejected.
   * This property helps prevent accidental use of disposed entities.
   *
   * @returns true if disposed, false otherwise
   *
   * @example
   * ```typescript
   * const entity = new Entity();
   * console.log(entity.isDisposed); // false
   * entity.dispose();
   * console.log(entity.isDisposed); // true
   * ```
   */
  get isDisposed(): boolean {
    return this._disposed;
  }

  /**
   * Sets the data associated with this entity.
   *
   * Null values are converted to undefined. Setting data on a disposed entity
   * is silently ignored (no-op) to prevent errors in cleanup code.
   *
   * @param data - Data payload to set, or undefined/null to clear
   *
   * @example
   * ```typescript
   * const entity = new Entity<{ value: number }>();
   * entity.data = { value: 42 };
   * entity.data = null; // Clears to undefined
   * console.log(entity.data); // undefined
   * ```
   */
  set data(data: D | undefined) {
    if (!this._disposed) {
      this._data = data === null ? undefined : data;
    }
  }

  /**
   * Sets the configuration associated with this entity.
   *
   * Null values are converted to undefined. Setting config on a disposed entity
   * is silently ignored (no-op) to prevent errors in cleanup code.
   *
   * @param config - Configuration object to set, or undefined/null to clear
   *
   * @example
   * ```typescript
   * interface MyConfig extends IEntityArguments {
   *   timeout: number;
   * }
   * const entity = new Entity<Data, MyConfig>();
   * entity.config = { timeout: 5000 };
   * entity.config = null; // Clears to undefined
   * ```
   */
  set config(config: C | undefined) {
    if (!this._disposed) {
      this._config = config === null ? undefined : config;
    }
  }

  /**
   * Disposes the entity and releases associated resources.
   *
   * This method:
   * - Clears data and config references
   * - Sets disposed flag to prevent further modifications
   * - Idempotent: Safe to call multiple times
   * - Non-reversible: Cannot reactivate after disposal
   *
   * Use this in cleanup code or before removing entity references to enable GC.
   *
   * After disposal:
   * - All data/config modifications are ignored
   * - id and type remain readable
   * - isDisposed returns true
   *
   * @example
   * ```typescript
   * const entity = new Entity();
   * entity.data = { name: "Test" };
   *
   * entity.dispose();
   * entity.data = { name: "Modified" }; // Silently ignored
   * console.log(entity.data); // Still { name: "Test" }
   *
   * entity.dispose(); // Safe to call again
   * ```
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }

    this._data = undefined;
    this._config = undefined;
    this._disposed = true;
  }
}
