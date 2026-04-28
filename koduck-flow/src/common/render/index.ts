/**
 * Koduck Flow 渲染系统
 *
 * 统一导出所有渲染相关的模块和类型
 */

// 核心渲染接口和类型
export {
  type IRenderContext,
  type RenderPerformanceStats,
  type IRenderConfig,
  type CachedRender,
  type IRender,
  type ICanvasRenderer,
  type IReactRenderer,
  type ISSRRenderer,
  type ILegacyRender,
  type RenderStrategy,
  type RenderSelection,
  type IRenderStrategy,
  type RenderResult,
  type ConcurrentRenderOptions,
} from "./types";

// 基础渲染器类
export { BaseRenderer } from "./base-renderer";

// 缓存管理器
export { RenderCacheManager, type CacheEntry, type CacheConfig } from "./cache-manager";

// Metrics 工具
export {
  createRenderMetricsRecorder,
  batchRenderWithMetrics,
  type RenderMetricsRecorder,
} from "./render-metrics-utils";

// 渲染管理器
export {
  RenderManager,
  type RenderStrategy as RenderManagerStrategy,
  type RenderResult as RenderManagerResult,
  createRenderManager,
} from "./render-manager/index";

// 渲染管理器接口合约 (Phase 7)
export type {
  IEntityLifecycleTracker,
  IRenderCacheCoordinator,
  IRenderOrchestrator,
  IDirtyRegionCoordinator,
  IRenderEventBridge,
  RenderModuleRenderOutput,
  RenderCanvasArtifacts,
} from "./render-manager/contracts";

// Canvas 渲染器
export {
  CanvasRender,
  type CanvasRenderOperation,
  type CanvasPerformanceOptimization,
} from "./canvas-render";

// WebGPU 渲染器
export { WebGPURender, type WebGPUPerformanceOptimization } from "./webgpu-render";

// React 渲染器
export { ReactRender, type ReactRenderCache, type AsyncRenderCache } from "./react-render";

// 渲染器选择器
export { RenderSelector } from "./render-selector";
export {
  RenderStrategySelector,
  type IRenderStrategyPlugin,
  type RenderStrategyCapabilityDescriptor,
  RenderStrategyNotApplicableError,
  type RenderStrategySelectorOptions,
} from "./render-strategy-selector";
export {
  ReactDefaultStrategyPlugin,
  createReactStrategyPlugin,
  type ReactStrategyPluginOptions,
} from "./plugins/react";
export {
  WebGPUDefaultStrategyPlugin,
  createWebGPUStrategyPlugin,
  type WebGPUStrategyPluginOptions,
} from "./plugins/webgpu";
export {
  SSRDefaultStrategyPlugin,
  createSSRStrategyPlugin,
  type SSRStrategyPluginOptions,
} from "./plugins/ssr";
export {
  type StrategyPluginConfig,
  type WebGPUPluginConfig,
  type SSRPluginConfig,
  type StrategyPluginInstanceLike,
  type RenderStrategySelectorRuntimeConfig,
} from "./strategy-config";
