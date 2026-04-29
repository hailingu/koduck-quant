/**
 * Koduck Flow Render System
 *
 * Unified exports of all rendering-related modules and types
 */

// Core render interfaces and types
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

// Base renderer class
export { BaseRenderer } from "./base-renderer";

// Cache manager
export { RenderCacheManager, type CacheEntry, type CacheConfig } from "./cache-manager";

// Metrics utilities
export {
  createRenderMetricsRecorder,
  batchRenderWithMetrics,
  type RenderMetricsRecorder,
} from "./render-metrics-utils";

// Render manager
export {
  RenderManager,
  type RenderStrategy as RenderManagerStrategy,
  type RenderResult as RenderManagerResult,
  createRenderManager,
} from "./render-manager/index";

// Render manager interface contracts (Phase 7)
export type {
  IEntityLifecycleTracker,
  IRenderCacheCoordinator,
  IRenderOrchestrator,
  IDirtyRegionCoordinator,
  IRenderEventBridge,
  RenderModuleRenderOutput,
  RenderCanvasArtifacts,
} from "./render-manager/contracts";

// Canvas renderer
export {
  CanvasRender,
  type CanvasRenderOperation,
  type CanvasPerformanceOptimization,
} from "./canvas-render";

// WebGPU renderer
export { WebGPURender, type WebGPUPerformanceOptimization } from "./webgpu-render";

// React renderer
export { ReactRender, type ReactRenderCache, type AsyncRenderCache } from "./react-render";

// Renderer selector
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
