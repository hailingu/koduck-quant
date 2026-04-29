import type { IEntity } from "../../entity";
import type { ICanvasRenderer, IRenderContext, RenderSelection, IRender } from "../types";
import {
  RenderStrategyNotApplicableError,
  type IRenderStrategyPlugin,
  type RenderStrategyCapabilityDescriptor,
} from "../render-strategy-selector";
import { logger } from "../../logger";
import { deviceCapabilities } from "../device-capabilities";
import type { WebGPUStrategyPluginOptions } from "./options";

const pluginLogger = logger.withContext({
  tag: "render:webgpu-plugin",
  metadata: { component: "WebGPUDefaultStrategyPlugin" },
});

export class WebGPUDefaultStrategyPlugin implements IRenderStrategyPlugin {
  public readonly id: string;
  public readonly descriptor: RenderStrategyCapabilityDescriptor;

  private readonly renderer: ICanvasRenderer;
  private readonly predicate: ((entity: IEntity, context: IRenderContext) => boolean) | undefined;
  private readonly confidence: number;
  private readonly requireCanvasContext: boolean;

  constructor(renderer: ICanvasRenderer, options: WebGPUStrategyPluginOptions = {}) {
    this.renderer = renderer;
    this.id = options.id ?? "render/webgpu-default";
    this.predicate = options.predicate;
    this.confidence = options.confidence ?? 0.95;
    this.requireCanvasContext = options.requireCanvasContext ?? true;

    const priority = options.priority ?? 120;
    const displayName = options.displayName ?? "WebGPU 默认渲染策略";

    const descriptor: RenderStrategyCapabilityDescriptor = {
      id: this.id,
      displayName,
      version: options.version ?? "1.0.0",
      supportedModes: ["webgpu"],
      tags: options.tags ?? ["default", "hardware-accelerated", "webgpu"],
      requiredCapabilities: options.requiredCapabilities ?? ["webgpu"],
      optionalCapabilities: options.optionalCapabilities ?? ["offscreen-canvas", "high-dpi"],
      priority,
      description:
        options.description ?? "基于 WebGPU 渲染器的默认策略，用于硬件加速的 Canvas 实体渲染。",
    };

    if (options.metadata) {
      descriptor.metadata = options.metadata;
    }

    this.descriptor = descriptor;
  }

  getStrategyName(): string {
    return `${this.id}:strategy`;
  }

  canHandle(entity: IEntity, context: IRenderContext): boolean {
    if (!entity) return false;
    // Use unified device capability detection
    const caps = deviceCapabilities.getSync();
    if (!caps.hasWebGPU) return false;
    if (this.requireCanvasContext && !context?.canvas) return false;

    if (this.predicate) {
      return this.predicate(entity, context);
    }

    const type = (entity.type ?? "").toLowerCase();
    return type.endsWith("canvas") || type.includes("canvas");
  }

  selectOptimalRenderer(entity: IEntity, context: IRenderContext): RenderSelection {
    if (!entity) {
      throw new RenderStrategyNotApplicableError("WebGPU strategy requires a valid entity");
    }

    if (!context) {
      throw new RenderStrategyNotApplicableError("WebGPU strategy requires a render context");
    }

    // Use unified device capability detection
    const caps = deviceCapabilities.getSync();
    if (!caps.hasWebGPU) {
      throw new RenderStrategyNotApplicableError("WebGPU is not supported in current environment");
    }

    if (this.requireCanvasContext && !context.canvas) {
      throw new RenderStrategyNotApplicableError("WebGPU strategy requires a canvas context");
    }

    if (!this.canHandle(entity, context)) {
      throw new RenderStrategyNotApplicableError("Entity is not suitable for WebGPU rendering");
    }

    if (typeof this.renderer.canHandle === "function" && !this.renderer.canHandle(context)) {
      throw new RenderStrategyNotApplicableError("WebGPU renderer cannot handle given context");
    }

    if (!this.renderer.canRender(entity)) {
      throw new RenderStrategyNotApplicableError(
        `WebGPU renderer reports unsupported entity (${entity.id ?? "unknown"})`
      );
    }

    pluginLogger.debug({
      event: "webgpu-strategy:selected",
      metadata: {
        entityId: entity.id,
        entityType: entity.type,
        strategyId: this.id,
      },
    });

    return {
      renderer: this.renderer as unknown as IRender,
      mode: "webgpu",
      reason: "WebGPU 默认策略命中",
      confidence: this.confidence,
    };
  }

  selectForBatch(entities: IEntity[]): Map<IRender, IEntity[]> {
    // Use unified device capability detection
    const caps = deviceCapabilities.getSync();
    if (!caps.hasWebGPU) {
      throw new RenderStrategyNotApplicableError("WebGPU is not supported in current environment");
    }

    if (entities.length === 0) {
      throw new RenderStrategyNotApplicableError("No entities provided for WebGPU batch selection");
    }

    const groups = entities.filter((entity) => {
      const context = this.createContext(entity);
      if (!context) {
        return false;
      }

      if (this.requireCanvasContext && !context.canvas) {
        return false;
      }

      try {
        return this.canHandle(entity, context) && this.renderer.canRender(entity);
      } catch (error) {
        pluginLogger.warn({
          event: "webgpu-strategy:batch-skip",
          metadata: {
            entityId: entity.id,
            reason: (error as Error).message,
          },
        });
        return false;
      }
    });

    if (groups.length === 0) {
      throw new RenderStrategyNotApplicableError("No entities suitable for WebGPU batch rendering");
    }

    return new Map([[this.renderer as unknown as IRender, groups]]);
  }

  private createContext(entity: IEntity): IRenderContext | null {
    const canvas = this.createCanvas();
    if (!canvas && this.requireCanvasContext) {
      return null;
    }

    const context: IRenderContext = {
      nodes: [entity],
      viewport: { x: 0, y: 0, zoom: 1, width: 0, height: 0 },
      timestamp: Date.now(),
    };

    if (canvas) {
      context.canvas = canvas;
    }

    return context;
  }

  private createCanvas(): HTMLCanvasElement | undefined {
    if (typeof document === "undefined" || typeof document.createElement !== "function") {
      return undefined;
    }
    return document.createElement("canvas");
  }
}

export function createWebGPUStrategyPlugin(
  renderer: ICanvasRenderer,
  options?: WebGPUStrategyPluginOptions
): WebGPUDefaultStrategyPlugin {
  return new WebGPUDefaultStrategyPlugin(renderer, options);
}

export type { WebGPUStrategyPluginOptions } from "./options";
