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
  /** Timeout (ms) for the maximum waiting time of registry render calls */
  renderTimeout?: number;
  /**
   * Whether to automatically trigger rendering when EntityManager adds an entity (default false)
   * - false: Flow decides when to provide IRenderContext and call RenderManager to render
   * - true: RenderManager will attempt to render onEntityAdded (using internal default context)
   */
  autoRenderOnAdd?: boolean;
  renderContext?: IRenderContext;
  /** Plugin-based strategy selector configuration */
  strategySelector?: RenderStrategySelectorRuntimeConfig;
  [key: string]: unknown;
}

/**
 * Renderer performance statistics interface
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
 * Cache render result
 */
export interface CachedRender {
  /** Image data */
  imageData: ImageData;
  /** Render bounds */
  bounds: { x: number; y: number; width: number; height: number };
  /** Cache timestamp */
  timestamp: number;
  /** Data size (bytes) */
  size: number;
  /** Data version */
  version: string;
}

/**
 * Unified renderer interface
 * Combines entity rendering and canvas rendering functionality using a method-based design
 */
export interface IRender extends IDisposable {
  /** Get renderer name */
  getName(): string;

  /** Get renderer type */
  getType(): "react" | "canvas" | "svg" | "webgl" | "webgpu" | "ssr";

  /** Render a single entity */
  render(entity: IEntity): React.ReactElement | string | Promise<string> | null | void;

  /** Check if an entity can be rendered */
  canRender(entity: IEntity): boolean;

  /** Batch render entities (optional) */
  batchRender?(entities: IEntity[]): void;

  /** Determine if current render context can be handled */
  canHandle?(context: IRenderContext): boolean;

  /** Get renderer priority (higher value means higher priority) */
  getPriority?(): number;

  /** Canvas context rendering */
  renderContext?(context: IRenderContext): void;

  /** Get performance statistics */
  getPerformanceStats(): RenderPerformanceStats;

  /** Configure renderer (optional) */
  configure?(config: IRenderConfig): void;

  setRegistryManager(registryManager: IRegistryManager<IEntity, IMeta>): void;

  /** Optional server-side rendering: directly output string */
  renderToString?(entity: IEntity, context: IRenderContext): string | Promise<string>;
}

/**
 * Canvas renderer-specific interface
 * Extends IRender and enforces Canvas-related methods
 */
export interface ICanvasRenderer extends IRender {
  getType(): "canvas";

  // Canvas rendering methods become required
  canHandle(context: IRenderContext): boolean;
  getPriority(): number;
  setRenderContext(context: IRenderContext): void;
  updateRenderContext(updates: Partial<IRenderContext>): void;
  getRenderContext(): IRenderContext | undefined;
}

/**
 * React renderer-specific interface
 * Extends IRender and focuses on React rendering
 */
export interface IReactRenderer extends IRender {
  getType(): "react";

  // React rendering methods with strengthened types
  render(entity: IEntity): React.ReactElement | null;
  canRender(entity: IEntity): boolean;
}

/**
 * Server-side renderer interface
 */
export interface ISSRRenderer extends IRender {
  getType(): "ssr";

  render(entity: IEntity): React.ReactElement | string | Promise<string> | null;
  canRender(entity: IEntity): boolean;
  renderToString(entity: IEntity, context: IRenderContext): string | Promise<string>;
}

/**
 * Retain original simple render interface for backward compatibility
 */
export interface ILegacyRender {
  render(): React.ReactElement;
}

/**
 * Render strategy type
 */
export type RenderStrategy = "auto" | "react" | "canvas" | string;

/**
 * Render selection result interface
 */
export interface RenderSelection {
  renderer: IRender;
  mode: "canvas" | "react" | "webgpu" | "ssr";
  reason: string;
  confidence: number; // 0-1, confidence of the selection
  renderToString?: (entity: IEntity, context: IRenderContext) => string | Promise<string>;
}

/**
 * Render strategy interface
 */
export interface IRenderStrategy {
  /**
   * Intelligently select the optimal renderer
   */
  selectOptimalRenderer(entity: IEntity, context: IRenderContext): RenderSelection;

  /**
   * Batch selection: group by renderer
   */
  selectForBatch(entities: IEntity[]): Map<IRender, IEntity[]>;

  /**
   * Strategy name
   */
  getStrategyName(): string;
}

/**
 * Render result interface
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
 * Concurrent render options
 */
export interface ConcurrentRenderOptions {
  priority?: "high" | "normal" | "low";
  useTransition?: boolean;
  enableSuspense?: boolean;
}
