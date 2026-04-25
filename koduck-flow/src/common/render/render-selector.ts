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
 * 渲染器选择器
 *
 * 负责智能选择最优渲染器，支持多种渲染策略
 * 职责：根据实体特征、性能指标和设备能力选择最佳渲染器
 */
export class RenderSelector implements IRenderStrategy {
  private canvasRenderer: ICanvasRenderer | undefined;
  private reactRenderer: ReactRender | undefined;
  private webgpuRenderer: WebGPURender | undefined;
  readonly deviceCapabilities = deviceCapabilities;

  // ✅ 缓存相关字段 (纯内部，不对外)
  private renderManager?: { getVersion?: () => number }; // RenderManager引用
  private managerVersion = 0; // 版本号
  private selectionCache = new Map<string, RenderSelection>(); // 选择缓存

  // 性能监控
  private performanceMetrics: PerformanceMetrics = {
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

    // 触发设备能力检测（异步，不阻塞构造函数）
    this.initializeDeviceCapabilities();
  }

  getStrategyName(): string {
    return "RenderSelector";
  }

  /**
   * 智能选择最优渲染器
   */
  selectOptimalRenderer(entity: IEntity, context: IRenderContext): RenderSelection {
    const effectiveContext = context ?? this.createDefaultContext(entity);
    // 检查实体是否有效
    if (!entity) {
      throw new Error("Entity cannot be null or undefined");
    }

    // 获取设备能力（同步，如果未初始化会使用默认值）
    const caps = this.refreshCapabilities();

    // ✅ 1. 内部版本检查
    this._checkVersionAndSync();

    // ✅ 2. 内部缓存检查
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

    // ✅ 3. 基于多重条件选择渲染器
    let selection: RenderSelection;

    if (entity.type?.endsWith("canvas")) {
      // Canvas 实体：优先考虑 WebGPU，其次 Canvas 2D
      const shouldUseWebGPU =
        caps.hasWebGPU && // WebGPU 支持
        this.webgpuRenderer && // WebGPU 渲染器存在
        entity.type?.endsWith("canvas") && // Canvas 实体
        this.analyzeComplexity(entity) > 0.7; // 高复杂度实体

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
      // 非 Canvas 实体：使用 React 渲染
      selection = {
        renderer: this.reactRenderer!,
        mode: "react",
        reason: "Non-canvas entity → React component rendering",
        confidence: PERFORMANCE_THRESHOLDS.HIGH_CONFIDENCE,
      };
    }

    // ✅ 4. 缓存结果
    this._cacheResult(cacheKey, selection);

    return selection;
  }

  /**
   * 批量选择：按渲染器分组（使用共享工具）
   */
  selectForBatch(entities: IEntity[]): Map<IRender, IEntity[]> {
    // ✅ 内部版本检查
    this._checkVersionAndSync();

    // 使用 SelectionCore 的批量分组工具
    return SelectionCore.groupEntitiesByRenderer(entities, (entity) =>
      this.selectOptimalRenderer(entity, this.createDefaultContext(entity))
    );
  }

  /**
   * 分析实体复杂度（使用共享工具）
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
   * 更新渲染器引用
   */
  updateRenderers(renderers: {
    canvas?: ICanvasRenderer;
    react?: ReactRender;
    webgpu?: WebGPURender;
  }): void {
    // ✅ 渲染器更新时自动清理缓存
    this._clearCache();

    if (renderers.canvas) this.canvasRenderer = renderers.canvas;
    if (renderers.react) this.reactRenderer = renderers.react;
    if (renderers.webgpu) this.webgpuRenderer = renderers.webgpu;
  }

  /**
   * ✅ 内部版本检查和同步
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
   * ✅ 内部生成缓存键
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
   * ✅ 内部验证缓存有效性
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

    // 检查渲染管理器版本是否改变
    if (this.renderManager?.getVersion?.() !== this.managerVersion) {
      selectorLogger.debug({
        event: RenderSelectorEvent.CacheValidation,
        message: "Cache invalid: render manager version changed",
      });
      return false;
    }

    // 检查设备能力是否改变
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

    // 检查性能指标是否显著变化
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
   * ✅ 内部缓存结果
   */
  private _cacheResult(key: string, selection: RenderSelection): void {
    // 简单LRU：超过阈值时删除最旧的
    if (this.selectionCache.size >= CACHE_LIMITS.SELECTION_CACHE_SIZE) {
      const firstKey = this.selectionCache.keys().next().value;
      if (firstKey) {
        this.selectionCache.delete(firstKey);
      }
    }

    this.selectionCache.set(key, selection);
  }

  /**
   * ✅ 内部清理缓存
   */
  private _clearCache(): void {
    this.selectionCache.clear();
  }

  /**
   * ✅ 内部设置RenderManager (供外部调用，如构造函数或其他地方)
   */
  setRenderManager(renderManager: { getVersion?: () => number }): void {
    this.renderManager = renderManager;
    this.managerVersion = renderManager?.getVersion?.() || 0;
  }

  private createDefaultContext(entity: IEntity): IRenderContext {
    return SelectionCore.createDefaultContext(entity);
  }
}
