import { CanvasRender } from "../canvas-render";
import { ReactRender } from "../react-render";
import { WebGPURender } from "../webgpu-render";
import { RenderSelector } from "../render-selector";
import {
  RenderStrategySelector,
  type IRenderStrategyPlugin,
  type RenderStrategyCapabilityDescriptor,
} from "../render-strategy-selector";
import { createReactStrategyPlugin } from "../plugins/react";
import { createWebGPUStrategyPlugin } from "../plugins/webgpu";
import { createSSRStrategyPlugin } from "../plugins/ssr";
import type {
  RenderStrategySelectorRuntimeConfig,
  StrategyPluginInstanceLike,
} from "../strategy-config";
import type { IEntity } from "../../entity";
import type { RegistryManager } from "../../registry";
import { diagnostics } from "../render-diagnostics";
import { acquireRenderContext, releaseRenderContext } from "../../memory";
import type {
  IRender,
  IRenderContext,
  IRenderStrategy,
  IReactRenderer,
  ICanvasRenderer,
  ISSRRenderer,
} from "../types";
import type { IEntityLifecycleTracker, IRenderCacheCoordinator } from "./contracts";
import {
  resolveRendererByPredicate,
  isReactRenderer,
  isSSRRenderer,
  isWebGPURenderer,
} from "./render-strategy-utils";

export type RenderStrategyControllerDependencies = {
  renderers: Map<string, IRender>;
  cacheCoordinator: IRenderCacheCoordinator;
  entityTracker: IEntityLifecycleTracker;
  legacySelector: RenderSelector;
  getRegistryManager: () => RegistryManager | undefined;
};

function isRenderStrategyPluginInstance(
  plugin: StrategyPluginInstanceLike
): plugin is StrategyPluginInstanceLike & IRenderStrategyPlugin {
  if (!plugin || typeof plugin !== "object") {
    return false;
  }

  const descriptor = plugin.descriptor as Partial<RenderStrategyCapabilityDescriptor> | undefined;

  return (
    typeof plugin.id === "string" &&
    typeof plugin.getStrategyName === "function" &&
    typeof plugin.selectOptimalRenderer === "function" &&
    descriptor !== undefined &&
    typeof descriptor.id === "string" &&
    typeof descriptor.displayName === "string" &&
    typeof descriptor.version === "string" &&
    Array.isArray(descriptor.supportedModes) &&
    typeof descriptor.priority === "number"
  );
}

export class RenderStrategyController {
  private strategySelector: RenderStrategySelector | undefined;
  private activeStrategy: IRenderStrategy;
  private strategySelectorConfig: RenderStrategySelectorRuntimeConfig | undefined;
  private readonly deps: RenderStrategyControllerDependencies;

  constructor(deps: RenderStrategyControllerDependencies) {
    this.deps = deps;
    this.activeStrategy = deps.legacySelector;

    this.deps.entityTracker.setRenderStrategy(this.activeStrategy);
    this.deps.entityTracker.setStrategyContextBuilder((entity) =>
      this.buildStrategyContext(entity)
    );
    this.deps.cacheCoordinator.setCanvasResolver((rendererId) =>
      this.resolveCanvasRenderer(rendererId)
    );
  }

  getActiveStrategy(): IRenderStrategy {
    return this.activeStrategy;
  }

  applyStrategyTo(tracker: IEntityLifecycleTracker): void {
    tracker.setRenderStrategy(this.activeStrategy);
    tracker.setStrategyContextBuilder((entity) => this.buildStrategyContext(entity));
  }

  selectRenderer(entity: IEntity): IRender | null {
    const pooledContext = this.buildStrategyContext(entity);
    const contextForSelection = this._cloneContextForSelection(pooledContext);
    try {
      const selection = this.activeStrategy.selectOptimalRenderer(entity, contextForSelection);
      return selection.renderer || null;
    } finally {
      releaseRenderContext(pooledContext);
    }
  }

  configureStrategySelector(config?: RenderStrategySelectorRuntimeConfig): void {
    this.strategySelectorConfig = config;
    this.refreshRenderStrategy();
  }

  refreshRenderStrategy(): void {
    const config = this.strategySelectorConfig;
    const legacySelector = this.deps.legacySelector;

    if (!legacySelector) {
      return;
    }

    this._maybeAutoregisterWebGPU(config);

    const legacyRendererMap = this._buildLegacyRendererMap(config);
    legacySelector.updateRenderers(legacyRendererMap);

    if (!config?.enabled) {
      this._activateLegacyStrategy(legacySelector);
      return;
    }

    const pluginNames: string[] = [];
    const plugins = this._collectStrategyPlugins(config, pluginNames);

    if (plugins.length === 0) {
      diagnostics.warn(
        "Strategy selector enabled but no plugins registered; falling back to legacy selector"
      );
      this._activateLegacyStrategy(legacySelector);
      return;
    }

    this.strategySelector = new RenderStrategySelector(plugins, config.selectorOptions);
    this.activeStrategy = this.strategySelector;
    this.deps.entityTracker.setRenderStrategy(this.activeStrategy);

    diagnostics.info("Render strategy selector configured", {
      plugins: pluginNames,
      totalPlugins: plugins.length,
    });
  }

  private _maybeAutoregisterWebGPU(config?: RenderStrategySelectorRuntimeConfig): void {
    if (!config?.webgpu?.enabled) {
      return;
    }

    const rendererId = config.webgpu.rendererId ?? "webgpu";
    const existing = this.resolveCanvasRenderer(rendererId);
    if (!existing && config.webgpu.autoRegisterRenderer !== false) {
      const autoRegistered = this.autoRegisterWebGPURenderer(rendererId);
      if (!autoRegistered) {
        diagnostics.warn("WebGPU strategy enabled but failed to auto-register renderer", {
          rendererId,
        });
      }
    }
  }

  private _buildLegacyRendererMap(config?: RenderStrategySelectorRuntimeConfig): {
    canvas?: ICanvasRenderer;
    react?: ReactRender;
    webgpu?: WebGPURender;
  } {
    const legacyReactRenderer =
      this.resolveReactConcreteRenderer(config?.react?.rendererId ?? "react") ||
      (this.deps.renderers.get("react") as ReactRender | undefined);
    const legacyCanvasRenderer =
      this.resolveCanvasRenderer(config?.webgpu?.rendererId ?? "canvas") ||
      (this.deps.renderers.get("canvas") as CanvasRender | undefined);
    const legacyWebgpuRenderer =
      this.resolveWebGPURenderer(config?.webgpu?.rendererId ?? "webgpu") ||
      (this.deps.renderers.get("webgpu") as WebGPURender | undefined);

    const legacyRendererMap: {
      canvas?: ICanvasRenderer;
      react?: ReactRender;
      webgpu?: WebGPURender;
    } = {};

    if (legacyReactRenderer) {
      legacyRendererMap.react = legacyReactRenderer;
    }
    if (legacyCanvasRenderer) {
      legacyRendererMap.canvas = legacyCanvasRenderer;
    }
    if (legacyWebgpuRenderer) {
      legacyRendererMap.webgpu = legacyWebgpuRenderer;
    }

    return legacyRendererMap;
  }

  private _activateLegacyStrategy(legacySelector: RenderSelector): void {
    this.strategySelector = undefined;
    this.activeStrategy = legacySelector;
    this.deps.entityTracker.setRenderStrategy(this.activeStrategy);
  }

  private _collectStrategyPlugins(
    config: RenderStrategySelectorRuntimeConfig,
    pluginNames: string[]
  ): IRenderStrategyPlugin[] {
    const plugins: IRenderStrategyPlugin[] = [];

    const reactEnabled = config.react?.enabled ?? true;
    if (reactEnabled) {
      const reactRenderer = this.resolveReactRenderer(config.react?.rendererId ?? "react");
      if (reactRenderer) {
        plugins.push(createReactStrategyPlugin(reactRenderer, config.react?.options));
        pluginNames.push("react");
      } else {
        diagnostics.warn("React strategy enabled but renderer missing", {
          rendererId: config.react?.rendererId ?? "react",
        });
      }
    }

    if (config.webgpu?.enabled) {
      const rendererId = config.webgpu.rendererId ?? "webgpu";
      const webgpuRenderer = this.resolveCanvasRenderer(rendererId);
      if (webgpuRenderer) {
        plugins.push(createWebGPUStrategyPlugin(webgpuRenderer, config.webgpu.options));
        pluginNames.push("webgpu");
      } else {
        diagnostics.warn("WebGPU strategy enabled but renderer missing", { rendererId });
      }
    }

    if (config.ssr?.enabled) {
      const rendererId = config.ssr.rendererId ?? "ssr";
      const ssrRenderer = this.resolveSSRRenderer(rendererId);
      if (ssrRenderer) {
        plugins.push(createSSRStrategyPlugin(ssrRenderer, config.ssr.options));
        pluginNames.push("ssr");
      } else if (config.ssr.required !== false) {
        diagnostics.warn("SSR strategy required but renderer missing", { rendererId });
      }
    }

    if (config.plugins?.length) {
      const customPlugins = config.plugins.filter(
        (plugin): plugin is StrategyPluginInstanceLike & IRenderStrategyPlugin => {
          if (isRenderStrategyPluginInstance(plugin)) {
            return true;
          }

          diagnostics.warn("Ignoring invalid render strategy plugin", {
            pluginId: plugin?.id,
            reason: "descriptor-mismatch",
          });
          return false;
        }
      );

      if (customPlugins.length > 0) {
        plugins.push(...customPlugins);
        pluginNames.push(...customPlugins.map((plugin) => plugin.id));
      }
    }

    return plugins;
  }

  buildStrategyContext(entity: IEntity): IRenderContext {
    const renderer = this.resolveCanvasRenderer("canvas");
    const context = acquireRenderContext(entity);
    const rendererContext = renderer?.getRenderContext?.();

    if (!rendererContext) {
      return context;
    }

    const metadata = rendererContext.metadata ?? {};

    if (rendererContext.viewport) {
      const viewport = rendererContext.viewport;
      context.viewport.x = viewport.x ?? context.viewport.x;
      context.viewport.y = viewport.y ?? context.viewport.y;
      context.viewport.zoom = viewport.zoom ?? context.viewport.zoom;
      context.viewport.width = viewport.width ?? context.viewport.width;
      context.viewport.height = viewport.height ?? context.viewport.height;
    }

    if ("canvas" in rendererContext) {
      if (rendererContext.canvas) {
        context.canvas = rendererContext.canvas;
      } else {
        delete context.canvas;
      }
    }
    context.timestamp = rendererContext.timestamp ?? context.timestamp;
    context.metadata = {
      ...metadata,
      entityId: entity.id,
      entityType: entity.type,
    };

    for (const [key, value] of Object.entries(rendererContext)) {
      if (key === "nodes" || key === "viewport" || key === "metadata" || key === "timestamp") {
        continue;
      }
      (context as Record<string, unknown>)[key] = value;
    }

    return context;
  }

  private _cloneContextForSelection(context: IRenderContext): IRenderContext {
    const cloned: IRenderContext = {
      ...context,
      nodes: [...context.nodes],
      viewport: { ...context.viewport },
    };

    if (context.metadata) {
      cloned.metadata = { ...context.metadata };
    }

    return cloned;
  }

  resolveCanvasRenderer(rendererId?: string): ICanvasRenderer | undefined {
    return resolveRendererByPredicate<ICanvasRenderer>(
      this.deps.renderers,
      rendererId,
      (renderer): renderer is ICanvasRenderer => {
        if (!renderer) {
          return false;
        }
        if (renderer instanceof CanvasRender) {
          return true;
        }
        if (renderer.getType?.() === "canvas") {
          return true;
        }
        if ((renderer as { type?: string }).type === "canvas") {
          return true;
        }
        return false;
      }
    );
  }

  resolveReactRenderer(rendererId?: string): IReactRenderer | undefined {
    return resolveRendererByPredicate<IReactRenderer>(
      this.deps.renderers,
      rendererId,
      isReactRenderer
    );
  }

  resolveSSRRenderer(rendererId?: string): ISSRRenderer | undefined {
    return resolveRendererByPredicate<ISSRRenderer>(this.deps.renderers, rendererId, isSSRRenderer);
  }

  resolveWebGPURenderer(rendererId?: string): WebGPURender | undefined {
    return resolveRendererByPredicate<WebGPURender>(
      this.deps.renderers,
      rendererId,
      isWebGPURenderer
    );
  }

  private resolveReactConcreteRenderer(rendererId?: string): ReactRender | undefined {
    return resolveRendererByPredicate<ReactRender>(
      this.deps.renderers,
      rendererId,
      (renderer): renderer is ReactRender =>
        renderer instanceof ReactRender || renderer?.getName?.() === "ReactRender"
    );
  }

  private autoRegisterWebGPURenderer(rendererId: string): ICanvasRenderer | undefined {
    try {
      const renderer = new WebGPURender(this.deps.getRegistryManager());
      this.deps.renderers.set(rendererId, renderer);
      this.deps.cacheCoordinator.bumpVersion();
      const registryManager = this.deps.getRegistryManager();
      if (registryManager) {
        renderer.setRegistryManager(registryManager);
      }
      diagnostics.info("Auto-registered WebGPU renderer for strategy selector", {
        rendererId,
      });
      return renderer;
    } catch (error) {
      diagnostics.warn("Failed to auto-register WebGPU renderer", {
        rendererId,
        error,
      });
      return undefined;
    }
  }
}
