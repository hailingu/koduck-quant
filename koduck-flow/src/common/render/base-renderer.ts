import React from "react";
import type { IEntity } from "../entity/types";
import type { IMeta, IRegistryManager } from "../registry/types";
import type { IRender, RenderPerformanceStats, IRenderConfig } from "./types";
import { meter, ScopedMeter } from "../metrics";

/**
 * 所有渲染器的抽象基类
 * 统一管理性能统计、metrics、registry 等共享功能
 *
 * @remarks
 * 此基类抽取了所有渲染器共享的功能：
 * - 性能统计跟踪
 * - Metrics 收集
 * - Registry 管理
 * - 基础接口实现
 *
 * 子类只需实现渲染相关的核心逻辑即可。
 *
 * @example
 * ```typescript
 * class CustomRender extends BaseRenderer implements ICanvasRenderer {
 *   constructor(registryManager?: IRegistryManager<IEntity, IMeta>) {
 *     super("CustomRender", "canvas", registryManager);
 *   }
 *
 *   getType(): "canvas" {
 *     return "canvas";
 *   }
 *
 *   render(entity: IEntity): void {
 *     const startTime = performance.now();
 *     try {
 *       // 自定义渲染逻辑
 *     } finally {
 *       this.recordRenderMetrics(startTime, entity);
 *     }
 *   }
 *
 *   canRender(entity: IEntity): boolean {
 *     return true;
 *   }
 *
 *   dispose(): void {
 *     // 清理资源
 *   }
 * }
 * ```
 */
export abstract class BaseRenderer implements Partial<IRender> {
  // 共享属性
  protected registryManager: IRegistryManager<IEntity, IMeta> | undefined;

  /**
   * 性能统计数据
   * 记录渲染次数、耗时、缓存命中率等
   */
  protected performanceStats = {
    totalRenderTime: 0,
    renderCount: 0,
    cacheHitCount: 0,
    cacheMissCount: 0,
    averageRenderTime: 0,
  };

  /**
   * Metrics 收集器
   * 用于向监控系统报告性能指标
   */
  protected readonly m: ScopedMeter;

  /**
   * 渲染器名称
   */
  protected readonly rendererName: string;

  /**
   * 渲染器类型
   */
  protected readonly rendererType: string;

  /**
   * 创建渲染器实例
   *
   * @param name - 渲染器名称（如 "CanvasRender"）
   * @param type - 渲染器类型（如 "canvas"）
   * @param registryManager - 可选的 registry 管理器
   */
  constructor(name: string, type: string, registryManager?: IRegistryManager<IEntity, IMeta>) {
    this.rendererName = name;
    this.rendererType = type;
    this.registryManager = registryManager;
    this.m = new ScopedMeter(meter("render"), {
      renderer: type,
      component: name,
    });
  }

  // ==================== 共享方法实现 ====================

  /**
   * 获取渲染器名称
   */
  getName(): string {
    return this.rendererName;
  }

  /**
   * 获取渲染器类型
   * 子类必须实现此方法以返回具体类型
   */
  abstract getType(): "react" | "canvas" | "svg" | "webgl" | "webgpu" | "ssr";

  /**
   * 设置 registry 管理器
   */
  setRegistryManager(registryManager: IRegistryManager<IEntity, IMeta>): void {
    this.registryManager = registryManager;
  }

  /**
   * 获取性能统计数据
   */
  getPerformanceStats(): RenderPerformanceStats {
    return {
      ...this.performanceStats,
      name: this.rendererName,
      type: this.rendererType,
    };
  }

  /**
   * 配置渲染器（可选实现）
   */
  configure?(config: IRenderConfig): void;

  // ==================== 受保护的工具方法 ====================

  /**
   * 更新性能统计
   *
   * @param startTime - 渲染开始时间（performance.now()）
   */
  protected updatePerformanceStats(startTime: number): void {
    const renderTime = performance.now() - startTime;
    this.performanceStats.renderCount++;
    this.performanceStats.totalRenderTime += renderTime;
    this.performanceStats.averageRenderTime =
      this.performanceStats.totalRenderTime / this.performanceStats.renderCount;
  }

  /**
   * 记录渲染 metrics
   *
   * @param startTime - 渲染开始时间
   * @param entity - 被渲染的实体
   * @param additionalAttributes - 额外的 metrics 属性
   */
  protected recordRenderMetrics(
    startTime: number,
    entity: IEntity,
    additionalAttributes?: Record<string, string | number | boolean>
  ): void {
    const dur = performance.now() - startTime;
    const attributes = {
      entityType: entity.type,
      ...additionalAttributes,
    };

    this.m.counter("render.count").add(1, attributes);
    this.m.histogram("render.duration.ms", { unit: "ms" }).record(dur, attributes);
  }

  /**
   * 记录缓存命中
   *
   * @param entityType - 实体类型
   */
  protected recordCacheHit(entityType: string): void {
    this.performanceStats.cacheHitCount++;
    this.m.counter("cache.hit").add(1, { entityType });
  }

  /**
   * 记录缓存未命中
   *
   * @param entityType - 实体类型
   */
  protected recordCacheMiss(entityType: string): void {
    this.performanceStats.cacheMissCount++;
    this.m.counter("cache.miss").add(1, { entityType });
  }

  /**
   * 记录渲染错误
   *
   * @param entityType - 实体类型
   * @param errorType - 错误类型
   */
  protected recordRenderError(entityType: string, errorType: string): void {
    this.m.counter("render.error").add(1, { entityType, errorType });
  }

  /**
   * 记录批量渲染 metrics
   *
   * @param size - 批量大小
   * @param duration - 耗时（毫秒）
   */
  protected recordBatchMetrics(size: number, duration: number): void {
    this.m.histogram("batch.size", { unit: "count" }).record(size);
    this.m.histogram("batch.duration.ms", { unit: "ms" }).record(duration);
    this.m.counter("batch.count").add(1);
  }

  // ==================== 抽象方法 - 子类必须实现 ====================

  /**
   * 渲染单个实体
   * 子类必须实现此方法来定义具体的渲染逻辑
   */
  abstract render(entity: IEntity): React.ReactElement | string | Promise<string> | null | void;

  /**
   * 检查是否能渲染指定实体
   * 子类必须实现此方法来判断渲染能力
   */
  abstract canRender(entity: IEntity): boolean;

  /**
   * 释放资源
   * 子类必须实现此方法来清理资源
   */
  abstract dispose(): void;
}
