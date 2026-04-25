import type { IEntity } from "../../entity/types";
import type { IRenderContext, RenderSelection, IRender, IReactRenderer } from "../types";
import {
  RenderStrategyNotApplicableError,
  type IRenderStrategyPlugin,
  type RenderStrategyCapabilityDescriptor,
} from "../render-strategy-selector";
import { logger } from "../../logger";
import type { ReactStrategyPluginOptions } from "./options";

const pluginLogger = logger.withContext({
  tag: "render:react-plugin",
  metadata: { component: "ReactStrategyPlugin" },
});

export class ReactDefaultStrategyPlugin implements IRenderStrategyPlugin {
  public readonly id: string;
  public readonly descriptor: RenderStrategyCapabilityDescriptor;

  private readonly renderer: IReactRenderer;
  private readonly predicate: ((entity: IEntity, context: IRenderContext) => boolean) | undefined;
  private readonly confidence: number;

  constructor(renderer: IReactRenderer, options: ReactStrategyPluginOptions = {}) {
    this.renderer = renderer;
    this.id = options.id ?? "render/react-default";
    this.confidence = options.confidence ?? 0.9;
    this.predicate = options.predicate;

    const priority = options.priority ?? 100;
    const displayName = options.displayName ?? "React 默认渲染策略";

    const descriptor: RenderStrategyCapabilityDescriptor = {
      id: this.id,
      displayName,
      version: options.version ?? "1.0.0",
      supportedModes: ["react"],
      tags: options.tags ?? ["default", "react"],
      requiredCapabilities: options.requiredCapabilities ?? [],
      optionalCapabilities: options.optionalCapabilities ?? ["react-concurrent"],
      priority,
      description:
        options.description ?? "以 React 渲染器为核心的默认策略，用于一般实体及 UI 节点渲染。",
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
    if (this.predicate) {
      return this.predicate(entity, context);
    }
    const type = entity.type ?? "";
    return !type.endsWith("canvas");
  }

  selectOptimalRenderer(entity: IEntity, context: IRenderContext): RenderSelection {
    if (!entity) {
      throw new RenderStrategyNotApplicableError("React strategy requires a valid entity");
    }

    if (!this.renderer) {
      throw new RenderStrategyNotApplicableError("React renderer is not available");
    }

    if (!this.canHandle(entity, context)) {
      throw new RenderStrategyNotApplicableError("Entity is not suitable for React rendering");
    }

    if (!this.renderer.canRender(entity)) {
      throw new RenderStrategyNotApplicableError(
        `React renderer reports unsupported entity (${entity.id ?? "unknown"})`
      );
    }

    pluginLogger.debug({
      event: "react-strategy:selected",
      metadata: {
        entityId: entity.id,
        entityType: entity.type,
        strategyId: this.id,
      },
    });

    return {
      renderer: this.renderer as unknown as IRender,
      mode: "react",
      reason: "React 默认策略命中",
      confidence: this.confidence,
    };
  }

  selectForBatch(entities: IEntity[]): Map<IRender, IEntity[]> {
    if (!this.renderer) {
      throw new RenderStrategyNotApplicableError("React renderer is not available for batch");
    }

    const applicable = entities.filter((entity) =>
      this.canHandle(entity, this.createContext(entity))
    );
    if (applicable.length === 0) {
      throw new RenderStrategyNotApplicableError("No entities suitable for React batch rendering");
    }

    return new Map([[this.renderer as unknown as IRender, applicable]]);
  }

  private createContext(entity: IEntity): IRenderContext {
    return {
      nodes: [entity],
      viewport: { x: 0, y: 0, zoom: 1, width: 0, height: 0 },
      timestamp: Date.now(),
    };
  }
}

export function createReactStrategyPlugin(
  renderer: IReactRenderer,
  options?: ReactStrategyPluginOptions
): ReactDefaultStrategyPlugin {
  return new ReactDefaultStrategyPlugin(renderer, options);
}

export type { ReactStrategyPluginOptions } from "./options";
