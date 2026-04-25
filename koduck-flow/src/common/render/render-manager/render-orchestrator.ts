import { CanvasRender } from "../canvas-render";
import { ReactRender } from "../react-render";
import { RenderSelector } from "../render-selector";
import type { RenderStrategySelectorRuntimeConfig } from "../strategy-config";
import type { IEntity } from "../../entity";
import type { RegistryManager } from "../../registry";
import { acquireRenderContext } from "../../memory";
import { diagnostics } from "../render-diagnostics";
import type {
  IRender,
  IRenderContext,
  IReactRenderer,
  ICanvasRenderer,
  ISSRRenderer,
} from "../types";
import type {
  IEntityLifecycleTracker,
  IRenderCacheCoordinator,
  IRenderOrchestrator,
} from "./contracts";
import { RenderStrategyController } from "./render-strategy-controller";

export type RenderOrchestratorOptions = {
  entityTracker: IEntityLifecycleTracker;
  cacheCoordinator: IRenderCacheCoordinator;
  registryManager?: RegistryManager;
};

export class RenderOrchestrator implements IRenderOrchestrator {
  private readonly renderers = new Map<string, IRender>();
  private readonly entityTracker: IEntityLifecycleTracker;
  private readonly cacheCoordinator: IRenderCacheCoordinator;
  private readonly legacySelector: RenderSelector;
  private readonly strategyController: RenderStrategyController | undefined;
  private registryManager: RegistryManager | undefined;
  private defaultRenderer = "react";

  constructor(options: RenderOrchestratorOptions) {
    this.entityTracker = options.entityTracker;
    this.cacheCoordinator = options.cacheCoordinator;
    this.registryManager = options.registryManager;

    const reactRenderer = new ReactRender(this.registryManager);
    const canvasRenderer = new CanvasRender(this.registryManager);

    this.registerRendererInternal("react", reactRenderer, { refreshStrategy: false });
    this.registerRendererInternal("canvas", canvasRenderer, { refreshStrategy: false });

    this.legacySelector = new RenderSelector({
      react: reactRenderer,
      canvas: canvasRenderer,
    });
    this.legacySelector.setRenderManager({
      getVersion: () => this.cacheCoordinator.getVersion(),
    });

    this.strategyController = new RenderStrategyController({
      renderers: this.renderers,
      cacheCoordinator: this.cacheCoordinator,
      entityTracker: this.entityTracker,
      legacySelector: this.legacySelector,
      getRegistryManager: () => this.registryManager,
    });
    this.strategyController.refreshRenderStrategy();

    diagnostics.info("RenderManager initialized", {
      rendererCount: this.getRegisteredRenderers().length,
      defaultRenderer: this.getDefaultRenderer(),
      registryConnected: Boolean(this.registryManager),
    });
  }

  attachEntityTracker(tracker: IEntityLifecycleTracker): void {
    if (tracker !== this.entityTracker && this.strategyController) {
      this.strategyController.applyStrategyTo(tracker);
    }
  }

  attachCacheCoordinator(cache: IRenderCacheCoordinator): void {
    if (cache !== this.cacheCoordinator) {
      cache.setCanvasResolver((rendererId) => this.resolveCanvasRenderer(rendererId));
    }
  }

  registerRenderer(name: string, renderer: IRender): void {
    this.registerRendererInternal(name, renderer, { refreshStrategy: true });
  }

  unregisterRenderer(name: string): boolean {
    const removed = this.renderers.delete(name);
    if (!removed) {
      return false;
    }

    this.cacheCoordinator.bumpVersion();

    if (this.defaultRenderer === name) {
      const [next] = this.renderers.keys();
      this.defaultRenderer = next ?? "react";
    }

    this.strategyController?.refreshRenderStrategy();
    return true;
  }

  getRenderer(name: string): IRender | undefined {
    return this.renderers.get(name);
  }

  getRegisteredRenderers(): string[] {
    return Array.from(this.renderers.keys());
  }

  setDefaultRenderer(name: string): boolean {
    if (!this.renderers.has(name)) {
      return false;
    }
    this.defaultRenderer = name;
    return true;
  }

  getDefaultRenderer(): string {
    return this.defaultRenderer;
  }

  selectRenderer(entity: IEntity): IRender | null {
    return this.strategyController?.selectRenderer(entity) ?? null;
  }

  configureStrategySelector(config?: RenderStrategySelectorRuntimeConfig): void {
    this.strategyController?.configureStrategySelector(config);
  }

  refreshRenderStrategy(): void {
    this.strategyController?.refreshRenderStrategy();
  }

  buildStrategyContext(entity: IEntity): IRenderContext {
    if (this.strategyController) {
      return this.strategyController.buildStrategyContext(entity);
    }

    return acquireRenderContext(entity);
  }

  resolveCanvasRenderer(rendererId?: string): ICanvasRenderer | undefined {
    return this.strategyController?.resolveCanvasRenderer(rendererId);
  }

  resolveReactRenderer(rendererId?: string): IReactRenderer | undefined {
    return this.strategyController?.resolveReactRenderer(rendererId);
  }

  resolveSSRRenderer(rendererId?: string): ISSRRenderer | undefined {
    return this.strategyController?.resolveSSRRenderer(rendererId);
  }

  resolveWebGPURenderer(rendererId?: string): IRender | undefined {
    return this.strategyController?.resolveWebGPURenderer(rendererId);
  }

  registerRegistryManager(registryManager: RegistryManager): void {
    this.registryManager = registryManager;
    this.renderers.forEach((renderer) => renderer.setRegistryManager(registryManager));
    this.strategyController?.refreshRenderStrategy();
  }

  private registerRendererInternal(
    name: string,
    renderer: IRender,
    options: { refreshStrategy: boolean }
  ): void {
    this.renderers.set(name, renderer);
    this.cacheCoordinator.bumpVersion();

    if (this.renderers.size === 1) {
      this.defaultRenderer = name;
    }

    if (this.registryManager && typeof renderer.setRegistryManager === "function") {
      renderer.setRegistryManager(this.registryManager);
    }

    if (options.refreshStrategy) {
      this.strategyController?.refreshRenderStrategy();
    }
  }
}
