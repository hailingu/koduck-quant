import type { IConfig } from "../../types/config";
import type { IEntity, IEntityArguments, IEntityConstructor } from "../entity/types";

/**
 * Simplified render context interface to avoid circular dependencies
 */
export interface IRenderContext {
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  gl?: WebGLRenderingContext | WebGL2RenderingContext | null;
  [key: string]: unknown;
}

/**
 * Meta information interface
 *
 * Provides basic entity meta information, supports structured extensions
 */
export interface IMeta<TExtras = Record<string, unknown>> {
  /** Entity type identifier */
  type: string;
  /** Optional description */
  description?: string;
  /** Structured extension attributes */
  extras?: TExtras;
}

/**
 * Registry interface
 *
 * Generic registry interface supporting different types of meta information
 */
export interface IRegistry<T extends IEntity, TMeta extends IMeta = IMeta> {
  /** Optional constructor arguments */
  readonly args?: IEntityArguments;
  /** Meta information */
  readonly meta?: TMeta;
  /** Get entity constructor */
  getConstructor(): IEntityConstructor<T>;
}

/**
 * Registry manager interface
 *
 * Defines the standard interface for managing multiple registry instances, supporting:
 * - Setting and getting the default registry
 * - Registering and unregistering registry instances
 * - Extension methods can be added in concrete implementations (e.g., query by name, batch operations, etc.)
 */
export interface IRegistryManager<T extends IEntity, TMeta extends IMeta = IMeta> {
  /** Get default registry (new API) */
  getDefaultRegistry(): IRegistry<T, TMeta> | undefined;

  /** Get registry by name (new API) */
  getRegistry(name: string): IRegistry<T, TMeta> | undefined;

  getRegistryForEntity(entity: IEntity): IRegistry<T, TMeta> | undefined;

  getRegistryForType(type: string): IRegistry<T, TMeta> | undefined;

  /**
   * Add named registry instance
   *
   * @param name Registry name
   * @param registry Registry instance to add
   */
  addRegistry(name: string, registry: IRegistry<T, TMeta>): void;

  /** Set default registry name (new API) */
  setDefaultRegistry(name: string): void;

  /** Remove named registry (implementation extensible) */
  removeRegistry?(name: string): boolean;

  /** Bind type to registry (implementation extensible) */
  bindTypeToRegistry?(type: string, name: string): void;
  unbindType?(type: string): void;
}

export interface ICapabilityAwareRegistry<T extends IEntity, TMeta extends IMeta = IMeta>
  extends IRegistry<T, TMeta> {
  readonly meta?: TMeta & {
    // capabilitiesDetectedAt still retained (can be used for external debugging)
    capabilitiesDetectedAt?: number;
  };

  getConstructor(): IEntityConstructor<T>;
  createEntity(...args: [IEntityArguments?]): T;

  // Capability management methods
  hasCapability(name: string): boolean;
  executeCapability(name: string, ...args: unknown[]): Promise<unknown>;
  getCapabilities(): string[];

  // Batch capability operations
  checkCapabilities?(entity: T, capabilities: string[]): boolean[];
  executeCapabilities?(
    entity: T,
    operations: Array<{ capability: string; args: unknown[] }>
  ): Promise<unknown[]>;
}

/**
 * Renderable entity registry interface
 *
 * Core features:
 * 1. Inherits the existing IRegistry<T, TMeta> interface, fully compatible
 * 2. Supports dynamic configuration of differently shaped nodes (via IRenderCapabilities extension attributes)
 * 3. Supports multi-domain node types (via extras extension attributes)
 * 4. Provides complete render configuration management
 * 5. Fully compatible with RegistryManager
 */
export interface IRenderableRegistry<T extends IEntity = IEntity, TMeta extends IMeta = IMeta>
  extends IRegistry<T, TMeta>,
    IConfig {
  /** Get entity constructor (inherited from IRegistry) */
  getConstructor(): IEntityConstructor<T>;

  /** Create entity instance */
  createEntity(
    nodeType: string,
    position?: { x: number; y: number },
    overrides?: Record<string, unknown>
  ): T;

  /**
   * Determine if entity is renderable
   */
  canRender(entity: IEntity): boolean;
  canRender(type: string): boolean;

  /**
   * Explicit render method: implemented by registry
   * - Returns React element (handled by React renderer) or void (meaning registry draws directly on canvas/webgpu)
   */
  render(entity: IEntity, context?: IRenderContext): Promise<React.ReactElement | void>;

  /**
   * Optional batch render interface (implement when batch optimization is needed)
   */
  batchRender?(entities: IEntity[], context?: IRenderContext): Promise<void | React.ReactElement[]>;
}
