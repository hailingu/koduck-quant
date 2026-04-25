import { logger } from "../logger";
import type { LoggerContextAdapter } from "../logger";
import type { IEntity } from "../entity";
import type { IRender, IRenderContext, IRenderStrategy, RenderSelection } from "./types";
import type { RenderStrategySelectorOptions } from "./strategy-selector-options";

/**
 * 插件能力描述：用于声明策略所支持的渲染模式、特性与依赖项。
 */
export interface RenderStrategyCapabilityDescriptor {
  /** 插件唯一标识 */
  id: string;
  /** 友好名称（用于 UI 展示） */
  displayName: string;
  /** 插件版本，便于审计 */
  version: string;
  /** 支持的渲染模式，例如 react、canvas、webgpu 等 */
  supportedModes: Array<RenderSelection["mode"] | string>;
  /** 可选的标签，描述策略擅长的场景（高并发、低功耗等） */
  tags?: string[];
  /** 插件依赖的运行时能力，如 "webgpu", "offscreen-canvas" 等 */
  requiredCapabilities?: string[];
  /** 插件可选利用的能力 */
  optionalCapabilities?: string[];
  /** 数值越大优先级越高，用于排序 */
  priority: number;
  /** 扩展元数据 */
  metadata?: Record<string, unknown>;
  /** 描述信息 */
  description?: string;
}

/**
 * 渲染策略插件接口，扩展 IRenderStrategy 并暴露能力描述。
 */
export interface IRenderStrategyPlugin extends IRenderStrategy {
  /** 策略唯一标识 */
  readonly id: string;
  /** 能力描述 */
  readonly descriptor: RenderStrategyCapabilityDescriptor;
  /**
   * 可选的预检查，用于快速判断是否适配当前实体与上下文。
   * 返回 false 表示策略不适用，将跳过 selectOptimalRenderer 调用。
   */
  canHandle?(entity: IEntity, context: IRenderContext): boolean;
}

/**
 * 当策略声明不适用当前实体时抛出的错误类型，用于区分真实异常。
 */
export class RenderStrategyNotApplicableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderStrategyNotApplicableError";
  }
}

/**
 * RenderStrategySelector 负责注册、管理并选择最合适的渲染策略插件。
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

  /** 策略名称用于与 RenderManager 兼容 */
  getStrategyName(): string {
    return "RenderStrategySelector";
  }

  /**
   * 注册策略插件。
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
   * 注销策略插件。
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
   * 列出当前注册的策略能力描述，按优先级降序排列。
   */
  listStrategyDescriptors(): RenderStrategyCapabilityDescriptor[] {
    return this.getOrderedStrategies().map((strategy) => strategy.descriptor);
  }

  /**
   * 获取某个策略实例。
   */
  getStrategy(id: string): IRenderStrategyPlugin | undefined {
    return this.strategies.get(id);
  }

  /**
   * IRenderStrategy 接口实现：选择最优渲染器。
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
   * IRenderStrategy 接口实现：批量选择策略并按渲染器分组。
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
   * 获取策略能力概览，按标签归类。
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
