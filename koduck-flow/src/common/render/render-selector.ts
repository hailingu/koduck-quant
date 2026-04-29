import type { IEntity } from "../entity/";
import type {
  IRender,
  IRenderContext,
  IRenderStrategy,
  RenderSelection,
  ICanvasRenderer,
} from "./types";
import type { ReactRender } from "./react-render";
import type { WebGPURender } from "./webgpu-render";
import { logger } from "../logger";
import { PERFORMANCE_THRESHOLDS, CACHE_LIMITS, GPU_TIERS } from "./render-constants";
import { deviceCapabilities, type DeviceCapabilities } from "./device-capabilities";
import { SelectionCore, type PerformanceMetrics } from "./selection-core";

const selectorLogger = logger.withContext({
  tag: "render-selector",
  metadata: { component: "RenderSelector" },
});

export const RenderSelectorEvent = {
  Initialized: "render-selector:initialized",
  CacheHit: "render-selector:cache-hit",
  CacheValidation: "render-selector:cache-validation",
} as const;

/**
 * Renderer selector
 *
 * Responsible for intelligently selecting the optimal renderer, supporting multiple rendering strategies.
 * Responsibility: select the best renderer based on entity characteristics, performance metrics, and device capabilities.
 */
export class RenderSelector implements IRenderStrategy {
  private canvasRenderer: ICanvasRenderer | undefined;
  private reactRenderer: ReactRender | undefined;
  private webgpuRenderer: WebGPURender | undefined;
  readonly deviceCapabilities = deviceCapabilities;

  // ✅ Cache-related fields (internal only, not exposed externally)
  private renderManager?: { getVersion?: () => number }; // RenderManager reference
  private managerVersion = 0; // Version number
  private readonly selectionCache = new Map<string, RenderSelection>(); // Selection cache

  // Performance monitoring
  private readonly performanceMetrics: PerformanceMetrics = {
    fps: PERFORMANCE_THRESHOLDS.TARGET_FPS,
    memory: 0.5,
    lastUpdateTime: Date.now(),
  };

  constructor(renderers: { canvas?: ICanvasRenderer; react?: ReactRender; webgpu?: WebGPURender }) {
    this.canvasRenderer = renderers.canvas;
    this.reactRenderer = renderers.react;
    this.webgpuRenderer = renderers.webgpu;
    selectorLogger.debug({
      event: RenderSelectorEvent.Initialized,
      message: "RenderSelector initialized",
      metadata: {
        hasCanvasRenderer: Boolean(this.canvasRenderer),
        hasReactRenderer: Boolean(this.reactRenderer),
        hasWebgpuRenderer: Boolean(this.webgpuRenderer),
      },
    });

    // Trigger device capability detection (asynchronous, non-blocking in constructor)
    this.initializeDeviceCapabilities();
  }

  getStrategyName(): string {
    return "RenderSelector";
  }

  /**
   * Intelligently select the optimal renderer
   */
  selectOptimalRenderer(entity: IEntity, context: IRenderContext): RenderSelection {
    const effectiveContext = context ?? this.createDefaultContext(entity);
    // Check if entity is valid
    if (!entity) {
      throw new Error("Entity cannot be null or undefined");
    }

    // Get device capabilities (synchronous, uses defaults if not initialized)
    const caps = this.refreshCapabilities();

    // ✅ 1. Internal version check
    this._checkVersionAndSync();

    // ✅ 2. Internal cache check
    const cacheKey = this._getCacheKey(entity);
    const cached = this.selectionCache.get(cacheKey);
    if (cached && this._isValidCached(cached)) {
      selectorLogger.debug({
        event: RenderSelectorEvent.CacheHit,
        message: "Using cached render selection",
        metadata: {
          cacheKey,
          renderer: cached.renderer.getName?.() ?? cached.mode,
          confidence: cached.confidence,
          contextTimestamp: effectiveContext.timestamp,
        },
      });
      return cached;
    }

    // ✅ 3. Select renderer based on multiple conditions
    let selection: RenderSelection;

    if (entity.type?.endsWith("canvas")) {
      // Canvas entities: prefer WebGPU, fallback to Canvas 2D
      const shouldUseWebGPU =
        caps.hasWebGPU && // WebGPU support
        this.webgpuRenderer && // WebGPU renderer exists
        entity.type?.endsWith("canvas") && // Canvas entity
        this.analyzeComplexity(entity) > 0.7; // High-complexity entity

      if (shouldUseWebGPU) {
        selection = {
          renderer: this.webgpuRenderer!,
          mode: "webgpu",
          reason: "High-complexity canvas entity → WebGPU hardware acceleration",
          confidence: PERFORMANCE_THRESHOLDS.HIGH_CONFIDENCE,
        };
      } else {
        selection = {
          renderer: this.canvasRenderer!,
          mode: "canvas",
          reason: "Canvas entity → Canvas 2D rendering",
          confidence: PERFORMANCE_THRESHOLDS.MEDIUM_CONFIDENCE,
        };
      }
    } else {
      // Non-Canvas entities: use React rendering
      selection = {
        renderer: this.reactRenderer!,
        mode: "react",
        reason: "Non-canvas entity → React component rendering",
        confidence: PERFORMANCE_THRESHOLDS.HIGH_CONFIDENCE,
      };
    }

    // ✅ 4. Cache result
    this._cacheResult(cacheKey, selection);

    return selection;
  }

  /**
   * Batch selection: group by renderer (using shared utilities)
   */
  selectForBatch(entities: IEntity[]): Map<IRender, IEntity[]> {
    // ✅ Internal version check
    this._checkVersionAndSync();

    // Use SelectionCore batch grouping utility
    return SelectionCore.groupEntitiesByRenderer(entities, (entity) =>
      this.selectOptimalRenderer(entity, this.createDefaultContext(entity))
    );
  }

  /**
   * Analyze entity complexity (using shared utilities)
   */
  private analyzeComplexity(entity: IEntity): number {
    return SelectionCore.analyzeComplexity(entity);
  }

  public detectGPUTier(rendererName: string): number {
    const normalized = (rendererName ?? "").toLowerCase();
    if (!normalized) {
      return GPU_TIERS.INTEGRATED;
    }

    if (
      normalized.includes("nvidia") &&
      (normalized.includes("rtx") || normalized.includes("gtx"))
    ) {
      return GPU_TIERS.HIGH_END;
    }

    if (normalized.includes("amd") || normalized.includes("radeon")) {
      return GPU_TIERS.MIDRANGE;
    }

    if (normalized.includes("intel")) {
      return GPU_TIERS.INTEGRATED;
    }

    return GPU_TIERS.INTEGRATED;
  }

  public initializeDeviceCapabilities(): void {
    void this.deviceCapabilities.detect().catch((error) => {
      selectorLogger.debug("Device capability detection failed", { error });
    });
  }

  private refreshCapabilities(): DeviceCapabilities {
    const detected = this.deviceCapabilities.getSync();
    const override = (this.deviceCapabilities as unknown as { hasWebGPU?: boolean }).hasWebGPU;
    if (typeof override === "boolean") {
      return {
        ...detected,
        hasWebGPU: override,
      };
    }
    return detected;
  }

  /**
   * Update renderer references
   */
  updateRenderers(renderers: {
    canvas?: ICanvasRenderer;
    react?: ReactRender;
    webgpu?: WebGPURender;
  }): void {
    // ✅ Automatically clear cache when renderers are updated
    this._clearCache();

    if (renderers.canvas) this.canvasRenderer = renderers.canvas;
    if (renderers.react) this.reactRenderer = renderers.react;
    if (renderers.webgpu) this.webgpuRenderer = renderers.webgpu;
  }

  /**
   * ✅ Internal version check and sync
   */
  private _checkVersionAndSync(): void {
    if (!this.renderManager?.getVersion) return;

    const currentVersion = this.renderManager.getVersion();
    if (currentVersion !== this.managerVersion) {
      this._clearCache();
      this.managerVersion = currentVersion;
    }
  }

  /**
   * ✅ Internal cache key generation
   */
  private _getCacheKey(entity: IEntity): string {
    const complexity = Math.floor(this.analyzeComplexity(entity) * 10);
    const fps = Math.floor(this.performanceMetrics.fps / 15);
    const memory = Math.floor(this.performanceMetrics.memory * 5);
    const caps = this.refreshCapabilities();
    const hasWebGPU = caps.hasWebGPU ? 1 : 0;

    return `${entity.type}_${complexity}_${fps}_${memory}_${hasWebGPU}`;
  }

  /**
   * ✅ Internal cache validity verification
   */
  private _isValidCached(selection: RenderSelection): boolean {
    selectorLogger.debug({
      event: RenderSelectorEvent.CacheValidation,
      message: "Validating cached render selection",
      metadata: {
        renderer: selection.renderer.getName?.() ?? selection.mode,
        reason: selection.reason,
        confidence: selection.confidence,
      },
    });

    // Check if render manager version has changed
    if (this.renderManager?.getVersion?.() !== this.managerVersion) {
      selectorLogger.debug({
        event: RenderSelectorEvent.CacheValidation,
        message: "Cache invalid: render manager version changed",
      });
      return false;
    }

    // Check if device capabilities have changed
    const currentCaps = this.refreshCapabilities();
    if (
      currentCaps.hasWebGPU !==
        (this.deviceCapabilities as unknown as DeviceCapabilities).hasWebGPU ||
      currentCaps.gpuTier !== (this.deviceCapabilities as unknown as DeviceCapabilities).gpuTier
    ) {
      selectorLogger.debug({
        event: RenderSelectorEvent.CacheValidation,
        message: "Cache invalid: device capabilities changed",
      });
      return false;
    }

    // Check if performance metrics have changed significantly
    const timeSinceUpdate = Date.now() - this.performanceMetrics.lastUpdateTime;
    if (timeSinceUpdate > CACHE_LIMITS.TTL_SECONDS * 1000) {
      selectorLogger.debug({
        event: RenderSelectorEvent.CacheValidation,
        message: "Cache invalid: performance metrics stale",
      });
      return false;
    }

    return true;
  }

  /**
   * ✅ Internal cache result
   */
  private _cacheResult(key: string, selection: RenderSelection): void {
    // Simple LRU: remove oldest when threshold is exceeded
    if (this.selectionCache.size >= CACHE_LIMITS.SELECTION_CACHE_SIZE) {
      const firstKey = this.selectionCache.keys().next().value;
      if (firstKey) {
        this.selectionCache.delete(firstKey);
      }
    }

    this.selectionCache.set(key, selection);
  }

  /**
   * ✅ Internal cache cleanup
   */
  private _clearCache(): void {
    this.selectionCache.clear();
  }

  /**
   * ✅ Internal RenderManager setter (for external calls, e.g., constructor or elsewhere)
   */
  setRenderManager(renderManager: { getVersion?: () => number }): void {
    this.renderManager = renderManager;
    this.managerVersion = renderManager?.getVersion?.() || 0;
  }

  private createDefaultContext(entity: IEntity): IRenderContext {
    return SelectionCore.createDefaultContext(entity);
  }
}
