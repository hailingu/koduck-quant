import React from "react";
import type { IDisposable } from "../disposable";
import type { IEntity } from "../entity/types";
import type { IRegistryManager, IMeta } from "../registry/types";
import type { IRenderContext } from "./context";
import type { RenderStrategySelectorRuntimeConfig } from "./strategy-config";

export type { IRenderContext } from "./context";

/**
 * Render specific configuration built on top of the generic IConfig contract.
 * This keeps render configuration behavior (validate/export/import/etc.) while
 * allowing renderer-specific options such as batching, caching and WebGPU flags.
 */
export interface IRenderConfig {
  batchSize?: number;
  batchInterval?: number;
  enableBatching?: boolean;
  enableCache?: boolean;
  maxCacheAge?: number;
  /** 超时（ms）用于 registry 渲染调用的最大等待时间 */
  renderTimeout?: number;
  /**
   * 当 EntityManager 添加实体时是否自动触发渲染（默认为 false）
   * - false: 由 Flow 决定何时提供 IRenderContext 并调用 RenderManager 渲染
   * - true: RenderManager 会尝试在 onEntityAdded 时渲染（使用内部默认 context）
   */
  autoRenderOnAdd?: boolean;
  renderContext?: IRenderContext;
  /** 插件化策略选择器配置 */
  strategySelector?: RenderStrategySelectorRuntimeConfig;
  [key: string]: unknown;
}

/**
 * 渲染器性能统计接口
 */
export interface RenderPerformanceStats {
  renderCount: number;
  totalRenderTime: number;
  averageRenderTime: number;
  cacheHitCount?: number;
  cacheMissCount?: number;
  cacheHitRatio?: number;
  type: string;
  name: string;
  [key: string]: unknown;
}

/**
 * 缓存渲染结果
 */
export interface CachedRender {
  /** 图像数据 */
  imageData: ImageData;
  /** 渲染边界 */
  bounds: { x: number; y: number; width: number; height: number };
  /** 缓存时间戳 */
  timestamp: number;
  /** 数据大小(字节) */
  size: number;
  /** 数据版本 */
  version: string;
}

/**
 * 统一的渲染器接口
 * 合并了Entity渲染和Canvas渲染功能，采用基于方法的设计
 */
export interface IRender extends IDisposable {
  /** 获取渲染器名称 */
  getName(): string;

  /** 获取渲染器类型 */
  getType(): "react" | "canvas" | "svg" | "webgl" | "webgpu" | "ssr";

  /** 渲染单个实体 */
  render(entity: IEntity): React.ReactElement | string | Promise<string> | null | void;

  /** 检查是否支持渲染某个实体 */
  canRender(entity: IEntity): boolean;

  /** 批量渲染实体（可选） */
  batchRender?(entities: IEntity[]): void;

  /** 判断是否能处理当前渲染上下文 */
  canHandle?(context: IRenderContext): boolean;

  /** 获取渲染器优先级 (数值越大优先级越高) */
  getPriority?(): number;

  /** Canvas上下文渲染 */
  renderContext?(context: IRenderContext): void;

  /** 获取性能统计 */
  getPerformanceStats(): RenderPerformanceStats;

  /** 配置渲染器（可选） */
  configure?(config: IRenderConfig): void;

  setRegistryManager(registryManager: IRegistryManager<IEntity, IMeta>): void;

  /** 服务端渲染可选：直接输出字符串 */
  renderToString?(entity: IEntity, context: IRenderContext): string | Promise<string>;
}

/**
 * Canvas渲染器专用接口
 * 继承IRender并强制实现Canvas相关方法
 */
export interface ICanvasRenderer extends IRender {
  getType(): "canvas";

  // Canvas渲染方法变为必需
  canHandle(context: IRenderContext): boolean;
  getPriority(): number;
  setRenderContext(context: IRenderContext): void;
  updateRenderContext(updates: Partial<IRenderContext>): void;
  getRenderContext(): IRenderContext | undefined;
}

/**
 * React渲染器专用接口
 * 继承IRender并专注于React渲染
 */
export interface IReactRenderer extends IRender {
  getType(): "react";

  // React渲染方法强化类型
  render(entity: IEntity): React.ReactElement | null;
  canRender(entity: IEntity): boolean;
}

/**
 * 服务端渲染器接口
 */
export interface ISSRRenderer extends IRender {
  getType(): "ssr";

  render(entity: IEntity): React.ReactElement | string | Promise<string> | null;
  canRender(entity: IEntity): boolean;
  renderToString(entity: IEntity, context: IRenderContext): string | Promise<string>;
}

/**
 * 保留原有的简单渲染接口用于向后兼容
 */
export interface ILegacyRender {
  render(): React.ReactElement;
}

/**
 * 渲染策略类型
 */
export type RenderStrategy = "auto" | "react" | "canvas" | string;

/**
 * 渲染选择结果接口
 */
export interface RenderSelection {
  renderer: IRender;
  mode: "canvas" | "react" | "webgpu" | "ssr";
  reason: string;
  confidence: number; // 0-1, 选择的置信度
  renderToString?: (entity: IEntity, context: IRenderContext) => string | Promise<string>;
}

/**
 * 渲染策略接口
 */
export interface IRenderStrategy {
  /**
   * 智能选择最优渲染器
   */
  selectOptimalRenderer(entity: IEntity, context: IRenderContext): RenderSelection;

  /**
   * 批量选择：按渲染器分组
   */
  selectForBatch(entities: IEntity[]): Map<IRender, IEntity[]>;

  /**
   * 策略名称
   */
  getStrategyName(): string;
}

/**
 * 渲染结果接口
 */
export interface RenderResult {
  success: boolean;
  element?: React.ReactElement | string | Promise<string> | undefined;
  error?: Error | undefined;
  rendererId: string;
  entityId: string;
  timestamp: number;
}

/**
 * 并发渲染选项
 */
export interface ConcurrentRenderOptions {
  priority?: "high" | "normal" | "low";
  useTransition?: boolean;
  enableSuspense?: boolean;
}
