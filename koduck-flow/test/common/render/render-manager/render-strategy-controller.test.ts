import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type {
  RenderStrategySelectorRuntimeConfig,
  StrategyPluginInstanceLike,
} from "../../../../src/common/render/strategy-config";
import type { RenderStrategyControllerDependencies } from "../../../../src/common/render/render-manager/render-strategy-controller";
import type {
  IRender,
  IRenderContext,
  IReactRenderer,
  ICanvasRenderer,
  RenderPerformanceStats,
  RenderSelection,
} from "../../../../src/common/render/types";
import type { IEntity } from "../../../../src/common/entity/types";
import type { RegistryManager } from "../../../../src/common/registry/registry-manager";

const diagnosticsSpies = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const selectorConstructorMock = vi.hoisted(() => vi.fn());

const pluginFactorySpies = vi.hoisted(() => ({
  react: vi.fn((renderer: unknown) => ({
    id: "plugin-react",
    descriptor: {
      id: "plugin-react",
      displayName: "React Strategy",
      version: "1.0.0",
      supportedModes: ["react"],
      priority: 1,
    },
    getStrategyName: () => "plugin-react",
    selectOptimalRenderer: vi.fn(() => ({ renderer, mode: "react", confidence: 1 })),
  })),
  webgpu: vi.fn((renderer: unknown) => ({
    id: "plugin-webgpu",
    descriptor: {
      id: "plugin-webgpu",
      displayName: "WebGPU Strategy",
      version: "1.0.0",
      supportedModes: ["webgpu"],
      priority: 2,
    },
    getStrategyName: () => "plugin-webgpu",
    selectOptimalRenderer: vi.fn(() => ({ renderer, mode: "webgpu", confidence: 1 })),
  })),
  ssr: vi.fn((renderer: unknown) => ({
    id: "plugin-ssr",
    descriptor: {
      id: "plugin-ssr",
      displayName: "SSR Strategy",
      version: "1.0.0",
      supportedModes: ["ssr"],
      priority: 3,
    },
    getStrategyName: () => "plugin-ssr",
    selectOptimalRenderer: vi.fn(() => ({ renderer, mode: "ssr", confidence: 1 })),
  })),
}));

const memorySpies = vi.hoisted(() => ({
  acquire: vi.fn<[], IRenderContext>(),
  release: vi.fn<(context: IRenderContext) => void>(),
}));

vi.mock("../../../../src/common/render/render-diagnostics", () => ({
  diagnostics: diagnosticsSpies,
}));

vi.mock("../../../../src/common/render/render-strategy-selector", () => ({
  RenderStrategySelector: class {
    plugins: StrategyPluginInstanceLike[];
    options: unknown;
    selectOptimalRenderer = vi.fn(() => ({ renderer: null, mode: "none", confidence: 0 }));
    constructor(plugins: StrategyPluginInstanceLike[], options: unknown) {
      this.plugins = plugins;
      this.options = options;
      selectorConstructorMock(plugins, options);
    }
    getStrategyName(): string {
      return "render-strategy-selector";
    }
  },
}));

vi.mock("../../../../src/common/render/plugins/react", () => ({
  createReactStrategyPlugin: pluginFactorySpies.react,
}));

vi.mock("../../../../src/common/render/plugins/webgpu", () => ({
  createWebGPUStrategyPlugin: pluginFactorySpies.webgpu,
}));

vi.mock("../../../../src/common/render/plugins/ssr", () => ({
  createSSRStrategyPlugin: pluginFactorySpies.ssr,
}));

vi.mock("../../../../src/common/memory", () => ({
  acquireRenderContext: memorySpies.acquire,
  releaseRenderContext: memorySpies.release,
}));

abstract class BaseRenderStub implements IRender {
  protected registryManager: RegistryManager | undefined;
  constructor(
    private readonly name: string,
    private readonly type: ReturnType<IRender["getType"]>
  ) {}
  dispose(): void {}
  getName(): string {
    return this.name;
  }
  getType(): ReturnType<IRender["getType"]> {
    return this.type;
  }
  abstract render(entity: IEntity): React.ReactElement | string | Promise<string> | null | void;
  abstract canRender(entity: IEntity): boolean;
  getPerformanceStats(): RenderPerformanceStats {
    return {
      renderCount: 0,
      totalRenderTime: 0,
      averageRenderTime: 0,
      type: this.type,
      name: this.name,
    };
  }
  setRegistryManager(registryManager: RegistryManager): void {
    this.registryManager = registryManager;
  }
}

class MockReactRender extends BaseRenderStub implements IReactRenderer {
  constructor() {
    super("MockReactRender", "react");
  }
  override getType(): "react" {
    return "react";
  }
  override render(entity: IEntity): React.ReactElement | null {
    if (entity.type === "react-mock") {
      return {
        type: "span",
        props: { id: entity.id, role: "presentation" },
        key: null,
        ref: null,
        _owner: null,
        _store: {},
      } as unknown as React.ReactElement;
    }
    return null;
  }
  override canRender(entity: IEntity): boolean {
    return entity.type !== "forbidden";
  }
}

type ContextFactory = () => IRenderContext & Record<string, unknown>;

class MockCanvasRender extends BaseRenderStub implements ICanvasRenderer {
  private readonly contextFactory: ContextFactory;
  private currentContext: IRenderContext | undefined;
  constructor(contextFactory?: ContextFactory, name = "MockCanvasRender") {
    super(name, "canvas");
    this.contextFactory =
      contextFactory ??
      (() => ({
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 100, height: 100 },
        timestamp: 0,
        metadata: { renderer: name },
      }));
  }
  canHandle(context: IRenderContext): boolean {
    return Boolean(context);
  }
  getPriority(): number {
    return 1;
  }
  override getType(): "canvas" {
    return "canvas";
  }
  override render(entity: IEntity): string {
    return `canvas:${entity.id}`;
  }
  override canRender(entity: IEntity): boolean {
    return entity.type !== "unsupported";
  }
  setRenderContext(context: IRenderContext): void {
    this.currentContext = context;
  }
  updateRenderContext(updates: Partial<IRenderContext>): void {
    if (!this.currentContext) {
      this.currentContext = { ...this.contextFactory(), ...updates };
      return;
    }
    Object.assign(this.currentContext, updates);
  }
  getRenderContext(): IRenderContext | undefined {
    return this.contextFactory();
  }
}

class MockWebGPURender extends MockCanvasRender {
  static readonly instances: MockWebGPURender[] = [];
  constructor() {
    super(undefined, "MockWebGPURender");
    MockWebGPURender.instances.push(this);
  }
  getName(): string {
    return "MockWebGPURender";
  }
}

vi.mock("../../../../src/common/render/canvas-render", () => ({
  CanvasRender: MockCanvasRender,
}));

vi.mock("../../../../src/common/render/react-render", () => ({
  ReactRender: MockReactRender,
}));

vi.mock("../../../../src/common/render/webgpu-render", () => ({
  WebGPURender: MockWebGPURender,
}));

const { RenderStrategyController } = await import(
  "../../../../src/common/render/render-manager/render-strategy-controller"
);

type ControllerFixture = {
  controller: InstanceType<typeof RenderStrategyController>;
  renderers: Map<string, IRender>;
  legacySelector: ReturnType<typeof createLegacySelector>;
  entityTracker: RenderStrategyControllerDependencies["entityTracker"];
  cacheCoordinator: RenderStrategyControllerDependencies["cacheCoordinator"];
};

type FixtureOverrides = {
  renderers?: Map<string, IRender>;
  registryManager?: RegistryManager;
};

function createEntityTracker(): RenderStrategyControllerDependencies["entityTracker"] {
  return {
    setRenderStrategy: vi.fn(),
    setStrategyContextBuilder: vi.fn(),
  } as unknown as RenderStrategyControllerDependencies["entityTracker"];
}

function createCacheCoordinator(): RenderStrategyControllerDependencies["cacheCoordinator"] {
  return {
    setCanvasResolver: vi.fn(),
    bumpVersion: vi.fn(),
    getCanvasArtifacts: vi.fn(() => ({ renderer: undefined, context: undefined })),
  } as unknown as RenderStrategyControllerDependencies["cacheCoordinator"];
}

function createLegacySelector(renderers: Map<string, IRender>) {
  const select = vi.fn<(entity: IEntity, context: IRenderContext) => RenderSelection>(() => ({
    renderer: renderers.get("react")!,
    mode: "react",
    reason: "legacy",
    confidence: 1,
  }));
  return {
    selectOptimalRenderer: select,
    updateRenderers: vi.fn<(map: Record<string, IRender | undefined>) => void>(),
    getStrategyName: vi.fn(() => "legacy"),
  };
}

function createDefaultRenderers(): Map<string, IRender> {
  const map = new Map<string, IRender>();
  map.set("canvas", new MockCanvasRender());
  map.set("react", new MockReactRender());
  map.set("webgpu", new MockWebGPURender());
  return map;
}

function createControllerFixture(overrides: FixtureOverrides = {}): ControllerFixture {
  const renderers = overrides.renderers ?? createDefaultRenderers();
  const legacySelector = createLegacySelector(renderers);
  const entityTracker = createEntityTracker();
  const cacheCoordinator = createCacheCoordinator();

  const deps: RenderStrategyControllerDependencies = {
    renderers,
    legacySelector:
      legacySelector as unknown as RenderStrategyControllerDependencies["legacySelector"],
    entityTracker,
    cacheCoordinator,
    getRegistryManager: () => overrides.registryManager,
  };

  const controller = new RenderStrategyController(deps);

  return {
    controller,
    renderers,
    legacySelector,
    entityTracker,
    cacheCoordinator,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  memorySpies.acquire.mockImplementation(() => ({
    nodes: [],
    viewport: { x: 0, y: 0, zoom: 1, width: 10, height: 10 },
    timestamp: 0,
    metadata: { base: true },
  }));
  memorySpies.release.mockImplementation(() => {});
  MockWebGPURender.instances.length = 0;
});

afterEach(() => {
  memorySpies.acquire.mockReset();
  memorySpies.release.mockReset();
});

describe("RenderStrategyController", () => {
  it("falls back to legacy selector when disabled", () => {
    const fixture = createControllerFixture();
    const { controller, legacySelector, entityTracker } = fixture;

    const config: RenderStrategySelectorRuntimeConfig = {
      enabled: false,
      react: { enabled: true },
      webgpu: { enabled: false },
    };

    controller.configureStrategySelector(config);

    expect(legacySelector.updateRenderers).toHaveBeenCalledWith({
      canvas: expect.any(MockCanvasRender),
      react: expect.any(MockReactRender),
      webgpu: expect.any(MockWebGPURender),
    });
    expect(selectorConstructorMock).not.toHaveBeenCalled();
    expect(entityTracker.setRenderStrategy).toHaveBeenLastCalledWith(
      legacySelector as unknown as RenderStrategyControllerDependencies["legacySelector"]
    );
  });

  it("configures plugins and auto-registers WebGPU when enabled", () => {
    const renderers = new Map<string, IRender>();
    const reactRenderer = new MockReactRender();
    renderers.set("react", reactRenderer);
    const fixture = createControllerFixture({ renderers });
    const { controller, cacheCoordinator } = fixture;

    const customPlugin: StrategyPluginInstanceLike = {
      id: "custom",
      descriptor: {
        id: "custom",
        displayName: "Custom Strategy",
        version: "1.0.0",
        supportedModes: ["custom"],
        priority: 5,
      },
      getStrategyName: () => "custom",
      selectOptimalRenderer: () => ({
        renderer: reactRenderer,
        mode: "custom",
        reason: "custom",
        confidence: 1,
      }),
    };

    const invalidPlugin = { id: "invalid" } as unknown as StrategyPluginInstanceLike;

    controller.configureStrategySelector({
      enabled: true,
      react: { enabled: true },
      webgpu: { enabled: true, rendererId: "webgpu" },
      plugins: [customPlugin, invalidPlugin],
    });

    expect(cacheCoordinator.bumpVersion).toHaveBeenCalled();
    expect(MockWebGPURender.instances).toHaveLength(1);
    expect(pluginFactorySpies.react).toHaveBeenCalledWith(reactRenderer, undefined);
    expect(pluginFactorySpies.webgpu).toHaveBeenCalledWith(expect.any(MockCanvasRender), undefined);
    expect(selectorConstructorMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "plugin-react" }),
        expect.objectContaining({ id: "plugin-webgpu" }),
        expect.objectContaining({ id: "custom" }),
      ]),
      undefined
    );
    expect(diagnosticsSpies.warn).toHaveBeenCalledWith(
      "Ignoring invalid render strategy plugin",
      expect.objectContaining({ pluginId: "invalid" })
    );
    expect(diagnosticsSpies.info).toHaveBeenCalledWith(
      "Render strategy selector configured",
      expect.objectContaining({ totalPlugins: 3 })
    );
  });

  it("builds pooled context and releases it after selection", () => {
    const fixture = createControllerFixture();
    const { controller, legacySelector } = fixture;

    const entity: IEntity = {
      id: "entity-1",
      type: "node",
      data: undefined,
      config: undefined,
      dispose: vi.fn(),
    };

    const selection: RenderSelection = {
      renderer: new MockReactRender(),
      mode: "react",
      confidence: 1,
      reason: "legacy",
    };

    legacySelector.selectOptimalRenderer.mockImplementation((_, context) => {
      context.nodes.push({
        id: "mutated",
        type: "node",
        data: undefined,
        config: undefined,
        dispose: vi.fn(),
      });
      context.metadata = { ...(context.metadata ?? {}), scope: "mutated" };
      return selection;
    });

    const result = controller.selectRenderer(entity);

    expect(result).toBe(selection.renderer);
    expect(memorySpies.acquire).toHaveBeenCalledTimes(1);
    expect(memorySpies.release).toHaveBeenCalledTimes(1);

    const releasedContext = memorySpies.release.mock.calls[0][0];
    expect(releasedContext.metadata).toMatchObject({
      renderer: "MockCanvasRender",
      entityId: entity.id,
      entityType: entity.type,
    });
    expect(releasedContext.nodes).toHaveLength(0);
  });
});
