import type { IEntity } from "../entity/";
import type {
  ICanvasRenderer,
  RenderPerformanceStats,
  IRenderConfig,
  IRenderContext,
} from "./types";
import { RegistryCapabilityUtils, RegistryManager } from "../registry";
import type { ICapabilityAwareRegistry, IMeta } from "../registry/types";
import { logger } from "../logger";
import { BaseRenderer } from "./base-renderer";
import { RenderCacheManager } from "./cache-manager";
import type { ObservableGauge } from "../metrics";

export const WebGPURenderEvent = {
  InitError: "webgpu-render:init-error",
  ContextUpdateError: "webgpu-render:context-update-error",
  NotReady: "webgpu-render:not-ready",
  InvalidEntity: "webgpu-render:invalid-entity",
  FirstRender: "webgpu-render:first-render",
  EntityUnsupported: "webgpu-render:entity-unsupported",
  RenderFailed: "webgpu-render:render-failed",
  NoRegistry: "webgpu-render:no-registry",
  RenderSuccess: "webgpu-render:render-success",
} as const;

const webgpuLogger = logger.withContext({
  tag: "render:webgpu",
  metadata: { component: "WebGPURender" },
});

/**
 * WebGPU performance optimization configuration
 */
interface WebGPUPerformanceOptimization {
  enableComputeShaders: boolean;
  enableInstancing: boolean;
  enableAsyncCompute: boolean;
  maxDrawCallsPerFrame: number;
  shaderCacheSize: number;
  enableDPR: boolean;
}

/**
 * WebGPU renderer implementation
 * Uses the WebGPU API for hardware-accelerated rendering
 *
 * Usage example:
 * ```typescript
 * import { RenderManager, WebGPURender } from './render';
 *
 * const renderManager = RenderManager.getInstance();
 * const webgpuRenderer = new WebGPURender(registryManager);
 *
 * // Register WebGPU renderer
 * renderManager.registerRenderer('webgpu', webgpuRenderer);
 *
 * // Set as default renderer (if WebGPU is supported)
 * if (webgpuRenderer.canHandle(renderContext)) {
 *   renderManager.setDefaultRenderer('webgpu');
 * }
 * ```
 */
class WebGPURender extends BaseRenderer implements ICanvasRenderer {
  private ctx: IRenderContext | undefined;

  // WebGPU-related properties
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = "bgra8unorm";
  private pipeline: GPURenderPipeline | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private indexBuffer: GPUBuffer | null = null;
  private colorBuffer: GPUBuffer | null = null;
  private uniformBuffer: GPUBuffer | null = null;

  // Performance configuration
  private readonly config: WebGPUPerformanceOptimization = {
    enableComputeShaders: true,
    enableInstancing: true,
    enableAsyncCompute: false,
    maxDrawCallsPerFrame: 1000,
    shaderCacheSize: 50,
    enableDPR: true,
  };

  // DPR-related properties (not used for now)
  // private dpr: number = 1;

  // Use unified cache manager to manage shader cache
  private readonly shaderCache = new RenderCacheManager<string, GPUShaderModule>("webgpu-shader", {
    maxSize: 50,
    maxAge: 10 * 60 * 1000, // 10 minutes
    enableMetrics: true,
  });

  // First render flag
  private isFirstRender = true;
  private ogShaderCacheGauge: ObservableGauge | undefined;
  private ogShaderCacheCb:
    | ((
        observe: (o: {
          value: number;
          attributes?: Record<string, string | number | boolean>;
        }) => void
      ) => void)
    | undefined;
  private ogFirstRenderGauge: ObservableGauge | undefined;
  private ogFirstRenderCb:
    | ((
        observe: (o: {
          value: number;
          attributes?: Record<string, string | number | boolean>;
        }) => void
      ) => void)
    | undefined;

  constructor(registryManager?: RegistryManager, config?: Partial<WebGPUPerformanceOptimization>) {
    super("WebGPURender", "webgpu", registryManager);

    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Observable gauge: shader cache size
    const cacheGauge = this.m.observableGauge("cache.size", {
      description: "WebGPU shader cache size",
      unit: "count",
    });
    this.ogShaderCacheCb = (observe) => {
      observe({ value: this.shaderCache.size(), attributes: { kind: "shader" } });
    };
    cacheGauge.addCallback(this.ogShaderCacheCb);
    this.ogShaderCacheGauge = cacheGauge;

    // Observable gauge: first render flag (1 if first render pending)
    const firstGauge = this.m.observableGauge("first_render.pending", {
      description: "Whether first WebGPU render has not happened yet",
      unit: "bool",
    });
    this.ogFirstRenderCb = (observe) => {
      observe({ value: this.isFirstRender ? 1 : 0 });
    };
    firstGauge.addCallback(this.ogFirstRenderCb);
    this.ogFirstRenderGauge = firstGauge;
  }

  /**
   * Get renderer type
   */
  getType(): "canvas" {
    return "canvas"; // Keep interface compatible, but actually WebGPU
  }

  /**
   * Determine if current render context can be handled
   */
  canHandle(context: IRenderContext): boolean {
    return !!context?.canvas && this.isWebGPUSupported();
  }

  /**
   * Get renderer priority
   */
  getPriority(): number {
    return 60; // Higher than Canvas renderer
  }

  /**
   * Check WebGPU support
   */
  private isWebGPUSupported(): boolean {
    return "gpu" in navigator;
  }

  /**
   * Initialize WebGPU
   */
  private async initializeWebGPU(canvas: HTMLCanvasElement): Promise<void> {
    if (!this.isWebGPUSupported()) {
      throw new Error("WebGPU is not supported");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("No WebGPU adapter found");
    }

    this.device = await adapter.requestDevice();

    this.context = canvas.getContext("webgpu") as GPUCanvasContext;
    if (!this.context) {
      throw new Error("Failed to get WebGPU context");
    }

    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied",
    });

    // Create shaders and pipeline
    await this.createShadersAndPipeline();

    // Create buffers
    this.createBuffers();
  }

  /**
   * Create shaders and render pipeline
   */
  private async createShadersAndPipeline(): Promise<void> {
    if (!this.device) return;

    const vertexShaderCode = `
      @vertex
      fn main(@location(0) position: vec2<f32>, @location(1) color: vec3<f32>) -> @builtin(position) vec4<f32> {
        return vec4<f32>(position, 0.0, 1.0);
      }
    `;

    const fragmentShaderCode = `
      @fragment
      fn main() -> @location(0) vec4<f32> {
        return vec4<f32>(0.5, 0.5, 0.5, 1.0);
      }
    `;

    const vertexShader = this.device.createShaderModule({
      code: vertexShaderCode,
    });

    const fragmentShader = this.device.createShaderModule({
      code: fragmentShaderCode,
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [],
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: vertexShader,
        entryPoint: "main",
        buffers: [
          {
            arrayStride: 5 * 4, // 2 position + 3 color
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },
              { shaderLocation: 1, offset: 8, format: "float32x3" },
            ],
          },
        ],
      },
      fragment: {
        module: fragmentShader,
        entryPoint: "main",
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });
  }

  /**
   * Create buffers
   */
  private createBuffers(): void {
    if (!this.device) return;

    // Create vertex buffer
    this.vertexBuffer = this.device.createBuffer({
      size: 1024 * 1024, // 1MB
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Create index buffer
    this.indexBuffer = this.device.createBuffer({
      size: 512 * 1024, // 512KB
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });

    // Create color buffer
    this.colorBuffer = this.device.createBuffer({
      size: 1024 * 1024, // 1MB
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Create uniform buffer
    this.uniformBuffer = this.device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  /**
   * Render context methods
   */
  setRenderContext(ctx: IRenderContext): void {
    this.ctx = ctx;
    if (ctx.canvas) {
      this.initializeWebGPU(ctx.canvas).catch((error) => {
        webgpuLogger.error({
          event: WebGPURenderEvent.InitError,
          message: "Failed to initialize WebGPU",
          emoji: "💥",
          error,
          metadata: { canvasProvided: Boolean(ctx.canvas) },
        });
        this.m.counter("render.error").add(1, { where: "init" });
      });
    }
  }

  updateRenderContext(updates: Partial<IRenderContext>): void {
    if (!this.ctx) return;
    this.ctx = { ...this.ctx, ...updates };
    if (updates.canvas && this.ctx.canvas) {
      this.initializeWebGPU(this.ctx.canvas).catch((error) => {
        webgpuLogger.error({
          event: WebGPURenderEvent.ContextUpdateError,
          message: "Failed to update WebGPU context",
          emoji: "💥",
          error,
        });
        this.m.counter("render.error").add(1, { where: "update_ctx" });
      });
    }
  }

  getRenderContext(): IRenderContext | undefined {
    return this.ctx;
  }

  render(entity: IEntity): void {
    if (!entity) {
      webgpuLogger.warn({
        event: WebGPURenderEvent.InvalidEntity,
        message: "Invalid entity provided for WebGPU render",
        emoji: "⚠️",
      });
      this.m.counter("render.skipped").add(1, { reason: "invalid_entity" });
      return;
    }

    if (!this.ctx || !this.device || !this.pipeline) {
      webgpuLogger.warn({
        event: WebGPURenderEvent.NotReady,
        message: "WebGPURender not initialized or WebGPU not supported",
        emoji: "⚠️",
        metadata: { entityId: entity.id },
      });
      this.m.counter("render.skipped").add(1, { reason: "not_ready" });
      return;
    }

    // First render hint
    if (this.isFirstRender) {
      webgpuLogger.info({
        event: WebGPURenderEvent.FirstRender,
        message: "WebGPURender initial hardware-accelerated frame",
        emoji: "🚀",
      });
      this.isFirstRender = false;
      this.m.counter("render.first").add(1);
    }

    const registry = this.registryManager?.getRegistryForEntity(entity) as ICapabilityAwareRegistry<
      IEntity,
      IMeta
    >;

    if (!registry || !RegistryCapabilityUtils.hasCapability(registry, "render")) {
      webgpuLogger.warn({
        event: WebGPURenderEvent.EntityUnsupported,
        message: "Entity does not support WebGPU rendering",
        emoji: "⚠️",
        metadata: { entityId: entity.id, entityType: entity.type },
      });
      this.m.counter("render.skipped").add(1, { reason: "no_registry" });
      return;
    }

    const startTime = performance.now();

    try {
      // Render using WebGPU
      this.renderWithWebGPU(entity);

      // Use base class metrics recording method
      this.recordRenderMetrics(startTime, entity);
      this.updatePerformanceStats(startTime);
    } catch (error) {
      webgpuLogger.error({
        event: WebGPURenderEvent.RenderFailed,
        message: `WebGPURender failed for entity`,
        emoji: "💥",
        metadata: { entityId: entity.id, entityType: entity.type },
        error,
      });
      this.m.counter("render.error").add(1, { where: "render" });
    }
  }

  /**
   * Render entity using WebGPU
   */
  private renderWithWebGPU(entity: IEntity): void {
    if (!this.device || !this.context || !this.pipeline) return;

    // Get render registry for entity
    const registry = this.registryManager?.getRegistryForEntity(entity) as ICapabilityAwareRegistry<
      IEntity,
      IMeta
    >;

    if (!registry || !RegistryCapabilityUtils.hasCapability(registry, "render")) {
      webgpuLogger.warn({
        event: WebGPURenderEvent.NoRegistry,
        message: "No render registry for entity",
        emoji: "⚠️",
        metadata: { entityId: entity.id, entityType: entity.type },
      });
      this.m.counter("render.skipped").add(1, { reason: "no_registry" });
      return;
    }

    try {
      // Render using WebGPU context
      // Note: we still use registry.render, but pass a WebGPU-enhanced context
      registry.executeCapability("render", entity, this.ctx!);

      // Execute WebGPU render commands
      this.executeWebGPURendering();

      webgpuLogger.info({
        event: WebGPURenderEvent.RenderSuccess,
        message: "WebGPURender rendered entity",
        emoji: "✅",
        metadata: { entityId: entity.id, entityType: entity.type },
      });
    } catch (error) {
      webgpuLogger.error({
        event: WebGPURenderEvent.RenderFailed,
        message: "WebGPU rendering failed during executeCapability",
        emoji: "💥",
        metadata: { entityId: entity.id, entityType: entity.type },
        error,
      });
      this.m.counter("render.error").add(1, { where: "execute" });
    }
  }

  /**
   * Execute WebGPU render commands
   */
  private executeWebGPURendering(): void {
    if (!this.device || !this.context || !this.pipeline) return;

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    renderPass.setPipeline(this.pipeline);

    // Vertex buffers, index buffers, etc. can be set here
    // In actual implementation, this data should come from the entity's data

    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  batchRender(entities: IEntity[]): void {
    if (!this.ctx || !this.device) return;

    // Batch rendering logic
    const start = performance.now();
    entities.forEach((entity) => this.render(entity));
    const dur = performance.now() - start;
    this.recordBatchMetrics(entities.length, dur);
  }

  canRender(entity: IEntity): boolean {
    // Check if render context and WebGPU device exist
    if (!this.ctx || !this.device) {
      return false;
    }

    // Check if entity type ends with "canvas"
    const isCanvasEntity = entity.type?.endsWith("canvas");

    // Check if a render registry is available
    const registry = this.registryManager?.getRegistryForEntity(entity) as ICapabilityAwareRegistry<
      IEntity,
      IMeta
    >;
    const hasRenderRegistry = registry && RegistryCapabilityUtils.hasCapability(registry, "render");

    // Entity can be rendered if: type matches and render registry exists
    return isCanvasEntity && hasRenderRegistry;
  }

  override configure(config: IRenderConfig): void {
    // Map generic configuration to WebGPU-specific configuration
    if (config.enableCache !== undefined) {
      this.config.enableComputeShaders = config.enableCache;
    }
    if (config.batchSize !== undefined) {
      this.config.maxDrawCallsPerFrame = config.batchSize;
    }
    if ("enableDPR" in config && typeof config.enableDPR === "boolean") {
      this.config.enableDPR = config.enableDPR;
    }
  }

  override getPerformanceStats(): RenderPerformanceStats {
    const stats = super.getPerformanceStats();
    const cacheTotal = this.performanceStats.cacheHitCount + this.performanceStats.cacheMissCount;
    const cacheHitRatio = cacheTotal > 0 ? this.performanceStats.cacheHitCount / cacheTotal : 0;

    return {
      ...stats,
      type: this.getType(),
      cacheHitRatio: Math.round(cacheHitRatio * 100) / 100,
    };
  }

  dispose(): void {
    this.shaderCache.clear();

    // Reset first render flag
    this.isFirstRender = true;

    // Clean up WebGPU resources
    if (this.vertexBuffer) {
      this.vertexBuffer.destroy();
      this.vertexBuffer = null;
    }
    if (this.indexBuffer) {
      this.indexBuffer.destroy();
      this.indexBuffer = null;
    }
    if (this.colorBuffer) {
      this.colorBuffer.destroy();
      this.colorBuffer = null;
    }
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy();
      this.uniformBuffer = null;
    }

    if (this.device) {
      this.device.destroy();
      this.device = null;
    }

    // Reset performance statistics
    this.performanceStats.totalRenderTime = 0;
    this.performanceStats.renderCount = 0;
    this.performanceStats.cacheHitCount = 0;
    this.performanceStats.cacheMissCount = 0;
    this.performanceStats.averageRenderTime = 0;

    this.ctx = undefined;

    if (this.ogShaderCacheGauge && this.ogShaderCacheCb) {
      this.ogShaderCacheGauge.removeCallback(this.ogShaderCacheCb);
      this.ogShaderCacheCb = undefined;
      this.ogShaderCacheGauge = undefined;
    }
    if (this.ogFirstRenderGauge && this.ogFirstRenderCb) {
      this.ogFirstRenderGauge.removeCallback(this.ogFirstRenderCb);
      this.ogFirstRenderCb = undefined;
      this.ogFirstRenderGauge = undefined;
    }
  }
}

export { WebGPURender, type WebGPUPerformanceOptimization };
