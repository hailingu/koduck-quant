import type { IEntity } from "../../entity";
import type { IRenderContext, RenderSelection, IRender } from "../types";
import {
  RenderStrategyNotApplicableError,
  type IRenderStrategyPlugin,
  type RenderStrategyCapabilityDescriptor,
} from "../render-strategy-selector";
import { SelectionCore } from "../selection-core";

/**
 * Strategy plugin abstract base class
 * Provides generic implementation for strategy plugins, reducing duplicate code
 *
 * @example
 * ```typescript
 * class MyStrategyPlugin extends BaseStrategyPlugin<IMyRenderer> {
 *   constructor(renderer: IMyRenderer, options: MyPluginOptions = {}) {
 *     super(renderer, {
 *       id: options.id ?? 'my-plugin',
 *       displayName: 'My Plugin',
 *       version: '1.0.0',
 *       supportedModes: ['my-mode'],
 *       priority: 100,
 *       ...options
 *     });
 *   }
 *
 *   canHandle(entity: IEntity, context: IRenderContext): boolean {
 *     // Custom judgment logic
 *     return entity.type === 'my-type';
 *   }
 *
 *   protected doSelect(entity: IEntity, context: IRenderContext): RenderSelection {
 *     // Custom selection logic
 *     return {
 *       renderer: this.renderer as unknown as IRender,
 *       mode: 'my-mode',
 *       reason: 'My plugin selected',
 *       confidence: 0.9
 *     };
 *   }
 * }
 * ```
 */
export abstract class BaseStrategyPlugin<T = IRender> implements IRenderStrategyPlugin {
  public readonly id: string;
  public readonly descriptor: RenderStrategyCapabilityDescriptor;

  protected readonly renderer: T;

  /**
   * Constructor
   *
   * @param renderer Renderer instance
   * @param descriptor Capability descriptor
   */
  constructor(renderer: T, descriptor: RenderStrategyCapabilityDescriptor) {
    this.renderer = renderer;
    this.id = descriptor.id;
    this.descriptor = descriptor;
  }

  /**
   * Get strategy name
   */
  getStrategyName(): string {
    return `${this.id}:strategy`;
  }

  /**
   * Determine if can handle entity
   * Subclasses must implement this method
   *
   * @param entity Entity
   * @param context Render context
   * @returns Whether it can handle
   */
  abstract canHandle(entity: IEntity, context: IRenderContext): boolean;

  /**
   * Select optimal renderer
   * Template method providing generic validation logic
   *
   * @param entity Entity
   * @param context Render context
   * @returns Render selection result
   */
  selectOptimalRenderer(entity: IEntity, context: IRenderContext): RenderSelection {
    // Validate entity
    if (!entity) {
      throw new RenderStrategyNotApplicableError(
        `${this.descriptor.displayName} requires a valid entity`
      );
    }

    // Validate renderer
    if (!this.renderer) {
      throw new RenderStrategyNotApplicableError(
        `${this.descriptor.displayName} renderer is not available`
      );
    }

    // Check if can handle
    if (!this.canHandle(entity, context)) {
      throw new RenderStrategyNotApplicableError(
        `Entity is not suitable for ${this.descriptor.displayName}`
      );
    }

    // Check if renderer supports this entity
    if (this.hasCanRender() && !this.rendererCanRender(entity)) {
      throw new RenderStrategyNotApplicableError(
        `${this.descriptor.displayName} reports unsupported entity (${entity.id ?? "unknown"})`
      );
    }

    // Call subclass selection logic
    return this.doSelect(entity, context);
  }

  /**
   * Batch selection: group by renderer
   * Provides default implementation, subclasses can override
   *
   * @param entities Entity array
   * @returns Entity Map grouped by renderer
   */
  selectForBatch(entities: IEntity[]): Map<IRender, IEntity[]> {
    if (!this.renderer) {
      throw new RenderStrategyNotApplicableError(
        `${this.descriptor.displayName} renderer is not available for batch`
      );
    }

    if (entities.length === 0) {
      throw new RenderStrategyNotApplicableError(
        `No entities provided for ${this.descriptor.displayName} batch selection`
      );
    }

    // Filter applicable entities
    const applicable = entities.filter((entity) => {
      try {
        const context = this.createContext(entity);
        return this.canHandle(entity, context);
      } catch {
        return false;
      }
    });

    if (applicable.length === 0) {
      throw new RenderStrategyNotApplicableError(
        `No entities suitable for ${this.descriptor.displayName} batch rendering`
      );
    }

    return new Map([[this.renderer as unknown as IRender, applicable]]);
  }

  /**
   * Core selection logic implemented by subclasses
   * This method is called after generic validation
   *
   * @param entity Entity
   * @param context Render context
   * @returns Render selection result
   */
  protected abstract doSelect(entity: IEntity, context: IRenderContext): RenderSelection;

  /**
   * Create default context
   * Uses tool methods provided by SelectionCore
   *
   * @param entity Entity
   * @returns Render context
   */
  protected createContext(entity: IEntity): IRenderContext {
    return SelectionCore.createDefaultContext(entity);
  }

  /**
   * Check if renderer has canRender method
   */
  private hasCanRender(): boolean {
    return (
      typeof this.renderer === "object" &&
      this.renderer !== null &&
      "canRender" in this.renderer &&
      typeof (this.renderer as { canRender?: unknown }).canRender === "function"
    );
  }

  /**
   * Call renderer's canRender method
   */
  private rendererCanRender(entity: IEntity): boolean {
    if (!this.hasCanRender()) return true;
    const canRenderFn = (this.renderer as { canRender: (entity: IEntity) => boolean }).canRender;
    return canRenderFn(entity);
  }
}

/**
 * Simple strategy plugin base class
 * Provides a simpler implementation approach, suitable for most cases
 */
export abstract class SimpleStrategyPlugin<T = IRender> extends BaseStrategyPlugin<T> {
  protected readonly confidence: number;
  protected readonly mode: RenderSelection["mode"];
  protected readonly reason: string;

  constructor(
    renderer: T,
    descriptor: RenderStrategyCapabilityDescriptor,
    options: {
      confidence?: number;
      mode: RenderSelection["mode"];
      reason?: string;
    }
  ) {
    super(renderer, descriptor);
    this.confidence = options.confidence ?? 0.9;
    this.mode = options.mode;
    this.reason = options.reason ?? `${descriptor.displayName} 选中`;
  }

  /**
   * Default selection implementation
   * Subclasses can override this method to customize behavior
   */
  protected doSelect(): RenderSelection {
    return {
      renderer: this.renderer as unknown as IRender,
      mode: this.mode,
      reason: this.reason,
      confidence: this.confidence,
    };
  }
}
