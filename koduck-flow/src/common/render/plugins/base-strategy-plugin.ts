import type { IEntity } from "../../entity";
import type { IRenderContext, RenderSelection, IRender } from "../types";
import {
  RenderStrategyNotApplicableError,
  type IRenderStrategyPlugin,
  type RenderStrategyCapabilityDescriptor,
} from "../render-strategy-selector";
import { SelectionCore } from "../selection-core";

/**
 * 策略插件抽象基类
 * 提供策略插件的通用实现，减少重复代码
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
 *     // 自定义判断逻辑
 *     return entity.type === 'my-type';
 *   }
 *
 *   protected doSelect(entity: IEntity, context: IRenderContext): RenderSelection {
 *     // 自定义选择逻辑
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
   * 构造函数
   *
   * @param renderer 渲染器实例
   * @param descriptor 能力描述符
   */
  constructor(renderer: T, descriptor: RenderStrategyCapabilityDescriptor) {
    this.renderer = renderer;
    this.id = descriptor.id;
    this.descriptor = descriptor;
  }

  /**
   * 获取策略名称
   */
  getStrategyName(): string {
    return `${this.id}:strategy`;
  }

  /**
   * 判断是否可以处理实体
   * 子类必须实现此方法
   *
   * @param entity 实体
   * @param context 渲染上下文
   * @returns 是否可以处理
   */
  abstract canHandle(entity: IEntity, context: IRenderContext): boolean;

  /**
   * 选择最优渲染器
   * 模板方法，提供通用的验证逻辑
   *
   * @param entity 实体
   * @param context 渲染上下文
   * @returns 渲染选择结果
   */
  selectOptimalRenderer(entity: IEntity, context: IRenderContext): RenderSelection {
    // 验证实体
    if (!entity) {
      throw new RenderStrategyNotApplicableError(
        `${this.descriptor.displayName} requires a valid entity`
      );
    }

    // 验证渲染器
    if (!this.renderer) {
      throw new RenderStrategyNotApplicableError(
        `${this.descriptor.displayName} renderer is not available`
      );
    }

    // 检查是否可以处理
    if (!this.canHandle(entity, context)) {
      throw new RenderStrategyNotApplicableError(
        `Entity is not suitable for ${this.descriptor.displayName}`
      );
    }

    // 检查渲染器是否支持该实体
    if (this.hasCanRender() && !this.rendererCanRender(entity)) {
      throw new RenderStrategyNotApplicableError(
        `${this.descriptor.displayName} reports unsupported entity (${entity.id ?? "unknown"})`
      );
    }

    // 调用子类实现的选择逻辑
    return this.doSelect(entity, context);
  }

  /**
   * 批量选择：按渲染器分组
   * 提供默认实现，子类可以覆盖
   *
   * @param entities 实体数组
   * @returns 按渲染器分组的实体 Map
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

    // 过滤可以处理的实体
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
   * 子类实现的核心选择逻辑
   * 此方法在通用验证之后被调用
   *
   * @param entity 实体
   * @param context 渲染上下文
   * @returns 渲染选择结果
   */
  protected abstract doSelect(entity: IEntity, context: IRenderContext): RenderSelection;

  /**
   * 创建默认上下文
   * 使用 SelectionCore 提供的工具方法
   *
   * @param entity 实体
   * @returns 渲染上下文
   */
  protected createContext(entity: IEntity): IRenderContext {
    return SelectionCore.createDefaultContext(entity);
  }

  /**
   * 检查渲染器是否有 canRender 方法
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
   * 调用渲染器的 canRender 方法
   */
  private rendererCanRender(entity: IEntity): boolean {
    if (!this.hasCanRender()) return true;
    const canRenderFn = (this.renderer as { canRender: (entity: IEntity) => boolean }).canRender;
    return canRenderFn(entity);
  }
}

/**
 * 简单策略插件基类
 * 提供更简单的实现方式，适用于大多数情况
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
   * 默认的选择实现
   * 子类可以覆盖此方法以自定义行为
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
