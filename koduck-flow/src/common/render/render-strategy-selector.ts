import { logger } from "../logger";
import type { LoggerContextAdapter } from "../logger";
import type { IEntity } from "../entity";
import type { IRender, IRenderContext, IRenderStrategy, RenderSelection } from "./types";
import type { RenderStrategySelectorOptions } from "./strategy-selector-options";

/**
 * Plugin capability descriptor: used to declare the rendering modes, features, and dependencies supported by a strategy.
 */
export interface RenderStrategyCapabilityDescriptor {
  /** Plugin unique identifier */
  id: string;
  /** Friendly name (for UI display) */
  displayName: string;
  /** Plugin version, for auditing purposes */
  version: string;
  /** Supported rendering modes, e.g., react, canvas, webgpu, etc. */
  supportedModes: Array<RenderSelection["mode"] | string>;
  /** Optional tags describing scenarios the strategy excels at (high concurrency, low power, etc.) */
  tags?: string[];
  /** Runtime capabilities required by the plugin, e.g., "webgpu", "offscreen-canvas", etc. */
  requiredCapabilities?: string[];
  /** Optional capabilities the plugin can leverage */
  optionalCapabilities?: string[];
  /** Higher value means higher priority, used for sorting */
  priority: number;
  /** Extended metadata */
  metadata?: Record<string, unknown>;
  /** Description */
  description?: string;
}

/**
 * Render strategy plugin interface, extends IRenderStrategy and exposes capability descriptors.
 */
export interface IRenderStrategyPlugin extends IRenderStrategy {
  /** Strategy unique identifier */
  readonly id: string;
  /** Capability descriptor */
  readonly descriptor: RenderStrategyCapabilityDescriptor;
  /**
   * Optional pre-check to quickly determine if the strategy is suitable for the current entity and context.
   * Returning false means the strategy is not applicable, and selectOptimalRenderer will be skipped.
   */
  canHandle?(entity: IEntity, context: IRenderContext): boolean;
}

/**
 * Error type thrown when a strategy declares it is not applicable to the current entity, used to distinguish from real exceptions.
 */
export class RenderStrategyNotApplicableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderStrategyNotApplicableError";
  }
}

/**
 * RenderStrategySelector is responsible for registering, managing, and selecting the most suitable render strategy plugin.
 */
export class RenderStrategySelector implements IRenderStrategy {
  private readonly strategies = new Map<string, IRenderStrategyPlugin>();
  private orderedCache: IRenderStrategyPlugin[] | null = null;
  private readonly allowOverride: boolean;
  private readonly autoSort: boolean;
  private readonly strategyLogger: LoggerContextAdapter;

  constructor(plugins: IRenderStrategyPlugin[] = [], options: RenderStrategySelectorOptions = {}) {
    this.allowOverride = options.allowOverride ?? false;
    this.autoSort = options.autoSort ?? true;
    const logTag = options.loggerTag ?? "render-strategy-selector";
    this.strategyLogger = logger.withContext({
      tag: logTag,
      metadata: { component: "RenderStrategySelector" },
    });

    plugins.forEach((plugin) => this.registerStrategy(plugin));
  }

  /** Strategy name for compatibility with RenderManager */
  getStrategyName(): string {
    return "RenderStrategySelector";
  }

  /**
   * Register a strategy plugin.
   */
  registerStrategy(plugin: IRenderStrategyPlugin): void {
    if (this.strategies.has(plugin.id) && !this.allowOverride) {
      throw new Error(`Strategy ${plugin.id} already registered`);
    }

    this.strategies.set(plugin.id, plugin);
    this.invalidateCache();
    this.strategyLogger.debug({
      event: "strategy-registered",
      metadata: plugin.descriptor,
    });
  }

  /**
   * Unregister a strategy plugin.
   */
  unregisterStrategy(id: string): boolean {
    const removed = this.strategies.delete(id);
    if (removed) {
      this.invalidateCache();
      this.strategyLogger.debug({
        event: "strategy-unregistered",
        metadata: { id },
      });
    }
    return removed;
  }

  /**
   * List currently registered strategy capability descriptors, sorted by priority in descending order.
   */
  listStrategyDescriptors(): RenderStrategyCapabilityDescriptor[] {
    return this.getOrderedStrategies().map((strategy) => strategy.descriptor);
  }

  /**
   * Get a specific strategy instance.
   */
  getStrategy(id: string): IRenderStrategyPlugin | undefined {
    return this.strategies.get(id);
  }

  /**
   * IRenderStrategy interface implementation: select the optimal renderer.
   */
  selectOptimalRenderer(entity: IEntity, context: IRenderContext): RenderSelection {
    const errors: Error[] = [];

    for (const strategy of this.getOrderedStrategies()) {
      try {
        if (strategy.canHandle && !strategy.canHandle(entity, context)) {
          continue;
        }

        const selection = strategy.selectOptimalRenderer(entity, context);
        if (selection) {
          this.strategyLogger.debug({
            event: "strategy-selected",
            metadata: {
              strategyId: strategy.id,
              renderer: selection.renderer.getName?.() ?? selection.mode,
              confidence: selection.confidence,
            },
          });
          return selection;
        }
      } catch (error) {
        if (error instanceof RenderStrategyNotApplicableError) {
          continue;
        }
        this.strategyLogger.warn({
          event: "strategy-error",
          metadata: { strategyId: strategy.id, message: (error as Error).message },
        });
        errors.push(error as Error);
      }
    }

    const failure = new Error("No render strategy could handle the given entity");
    (failure as { causes?: Error[] }).causes = errors;
    throw failure;
  }

  /**
   * IRenderStrategy interface implementation: batch selection and group by renderer.
   */
  selectForBatch(entities: IEntity[]): Map<IRender, IEntity[]> {
    const groups = new Map<IRender, IEntity[]>();

    entities.forEach((entity) => {
      const selection = this.selectOptimalRenderer(entity, {
        nodes: [entity],
        viewport: { x: 0, y: 0, zoom: 1, width: 0, height: 0 },
        timestamp: Date.now(),
      });

      if (!groups.has(selection.renderer)) {
        groups.set(selection.renderer, []);
      }
      groups.get(selection.renderer)!.push(entity);
    });

    return groups;
  }

  /**
   * Get a strategy capability overview, categorized by tags.
   */
  summarizeCapabilities(): Record<string, RenderStrategyCapabilityDescriptor[]> {
    const summary: Record<string, RenderStrategyCapabilityDescriptor[]> = {};
    this.getOrderedStrategies().forEach((strategy) => {
      const tags = strategy.descriptor.tags?.length ? strategy.descriptor.tags : ["default"];
      tags.forEach((tag) => {
        if (!summary[tag]) {
          summary[tag] = [];
        }
        summary[tag].push(strategy.descriptor);
      });
    });
    return summary;
  }

  private invalidateCache(): void {
    this.orderedCache = null;
  }

  private getOrderedStrategies(): IRenderStrategyPlugin[] {
    if (!this.orderedCache) {
      const list = Array.from(this.strategies.values());
      if (this.autoSort) {
        list.sort((a, b) => b.descriptor.priority - a.descriptor.priority);
      }
      this.orderedCache = list;
    }
    return this.orderedCache;
  }
}

export type { RenderStrategySelectorOptions } from "./strategy-selector-options";
