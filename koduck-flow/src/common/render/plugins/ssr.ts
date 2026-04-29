import type { IEntity } from "../../entity";
import type { IRenderContext, RenderSelection, IRender, ISSRRenderer } from "../types";
import {
  RenderStrategyNotApplicableError,
  type IRenderStrategyPlugin,
  type RenderStrategyCapabilityDescriptor,
} from "../render-strategy-selector";
import { logger } from "../../logger";
import type { SSRStrategyPluginOptions } from "./options";

const pluginLogger = logger.withContext({
  tag: "render:ssr-plugin",
  metadata: { component: "SSRDefaultStrategyPlugin" },
});

export class SSRDefaultStrategyPlugin implements IRenderStrategyPlugin {
  public readonly id: string;
  public readonly descriptor: RenderStrategyCapabilityDescriptor;

  private readonly renderer: ISSRRenderer;
  private readonly predicate: ((entity: IEntity, context: IRenderContext) => boolean) | undefined;
  private readonly confidence: number;
  private readonly requireServerEnvironment: boolean;

  constructor(renderer: ISSRRenderer, options: SSRStrategyPluginOptions = {}) {
    this.renderer = renderer;
    this.id = options.id ?? "render/ssr-default";
    this.predicate = options.predicate;
    this.confidence = options.confidence ?? 0.92;
    this.requireServerEnvironment = options.requireServerEnvironment ?? true;

    const priority = options.priority ?? 110;
    const displayName = options.displayName ?? "SSR 默认渲染策略";

    const descriptor: RenderStrategyCapabilityDescriptor = {
      id: this.id,
      displayName,
      version: options.version ?? "1.0.0",
      supportedModes: ["ssr"],
      tags: options.tags ?? ["default", "ssr", "server"],
      requiredCapabilities: options.requiredCapabilities ?? ["ssr"],
      optionalCapabilities: options.optionalCapabilities ?? ["react", "stream"],
      priority,
      description:
        options.description ?? "基于服务端渲染器的默认策略，用于输出字符串形态的 HTML 结果。",
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
    if (this.requireServerEnvironment && typeof globalThis.window !== "undefined") {
      return false;
    }

    if (this.predicate) {
      return this.predicate(entity, context);
    }

    const entityType = (entity.type ?? "").toLowerCase();
    const metadata = context?.metadata ?? {};
    const hasSSRHint = metadata.ssr === true || metadata.renderTarget === "ssr";

    if (hasSSRHint) return true;

    return this.matchesDefaultHeuristics(entityType);
  }

  selectOptimalRenderer(entity: IEntity, context: IRenderContext): RenderSelection {
    if (!entity) {
      throw new RenderStrategyNotApplicableError("SSR strategy requires a valid entity");
    }

    if (!context) {
      throw new RenderStrategyNotApplicableError("SSR strategy requires a render context");
    }

    if (this.requireServerEnvironment && typeof globalThis.window !== "undefined") {
      throw new RenderStrategyNotApplicableError("SSR strategy requires server environment");
    }

    if (!this.canHandle(entity, context)) {
      throw new RenderStrategyNotApplicableError("Entity is not suitable for SSR rendering");
    }

    if (!this.renderer) {
      throw new RenderStrategyNotApplicableError("SSR renderer is not available");
    }

    if (typeof this.renderer.renderToString !== "function") {
      throw new RenderStrategyNotApplicableError("SSR renderer does not provide renderToString");
    }

    if (!this.renderer.canRender(entity)) {
      throw new RenderStrategyNotApplicableError(
        `SSR renderer reports unsupported entity (${entity.id ?? "unknown"})`
      );
    }

    pluginLogger.debug({
      event: "ssr-strategy:selected",
      metadata: {
        entityId: entity.id,
        entityType: entity.type,
        strategyId: this.id,
      },
    });

    return {
      renderer: this.renderer as unknown as IRender,
      mode: "ssr",
      reason: "SSR 默认策略命中",
      confidence: this.confidence,
      renderToString: (renderEntity, renderContext) =>
        this.renderer.renderToString(renderEntity, renderContext),
    };
  }

  selectForBatch(entities: IEntity[]): Map<IRender, IEntity[]> {
    if (this.requireServerEnvironment && typeof globalThis.window !== "undefined") {
      throw new RenderStrategyNotApplicableError("SSR strategy requires server environment");
    }

    if (entities.length === 0) {
      throw new RenderStrategyNotApplicableError("No entities provided for SSR batch selection");
    }

    const applicable = entities.filter((entity) => {
      const context = this.createContext(entity);
      try {
        return this.canHandle(entity, context) && this.renderer.canRender(entity);
      } catch (error) {
        pluginLogger.warn({
          event: "ssr-strategy:batch-skip",
          metadata: {
            entityId: entity.id,
            reason: (error as Error).message,
          },
        });
        return false;
      }
    });

    if (applicable.length === 0) {
      throw new RenderStrategyNotApplicableError("No entities suitable for SSR batch rendering");
    }

    return new Map([[this.renderer as unknown as IRender, applicable]]);
  }

  private createContext(entity: IEntity): IRenderContext {
    const metadata: Record<string, unknown> | undefined = this.matchesDefaultHeuristics(
      (entity.type ?? "").toLowerCase()
    )
      ? { ssr: true, renderTarget: "ssr" }
      : undefined;

    return {
      nodes: [entity],
      viewport: { x: 0, y: 0, zoom: 1, width: 0, height: 0 },
      timestamp: Date.now(),
      ...(metadata ? { metadata } : {}),
    };
  }

  private matchesDefaultHeuristics(entityType: string): boolean {
    return (
      entityType.includes("ssr") ||
      entityType.endsWith("page") ||
      entityType.endsWith("view") ||
      entityType.includes("server")
    );
  }
}

export function createSSRStrategyPlugin(
  renderer: ISSRRenderer,
  options?: SSRStrategyPluginOptions
): SSRDefaultStrategyPlugin {
  return new SSRDefaultStrategyPlugin(renderer, options);
}

export type { SSRStrategyPluginOptions } from "./options";
