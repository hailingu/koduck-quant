import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { IEntity } from "../../../../src/common/entity";
import type {
  ICanvasRenderer,
  IRenderContext,
  RenderSelection,
} from "../../../../src/common/render";
import {
  WebGPUDefaultStrategyPlugin,
  RenderStrategyNotApplicableError,
} from "../../../../src/common/render";
import { deviceCapabilities } from "../../../../src/common/render/device-capabilities";

const setWebGPUSupport = (supported: boolean) => {
  const navigatorWithGPU = navigator as Navigator & { gpu?: unknown };
  if (supported) {
    navigatorWithGPU.gpu = {};
  } else {
    delete navigatorWithGPU.gpu;
  }
  deviceCapabilities.reset();
};

const createEntity = (overrides: Partial<IEntity> = {}): IEntity =>
  ({
    id: overrides.id ?? "entity-1",
    type: overrides.type ?? "diagram-canvas",
    data: overrides.data ?? { toJSON: () => ({}) },
  }) as IEntity;

const createRenderer = (
  options: {
    name?: string;
    canRender?: (entity: IEntity) => boolean;
    canHandle?: (context: IRenderContext) => boolean;
  } = {}
): ICanvasRenderer => {
  const {
    name = "WebGPURender",
    canRender = (entity: IEntity) => Boolean(entity.type?.endsWith("canvas")),
    canHandle = () => true,
  } = options;

  return {
    getName: () => name,
    getType: () => "canvas" as const,
    render: () => undefined,
    canRender,
    getPerformanceStats: () => ({
      renderCount: 0,
      totalRenderTime: 0,
      averageRenderTime: 0,
      type: "canvas",
      name,
    }),
    setRegistryManager: () => {},
    dispose: () => {},
    canHandle,
    setRenderContext: () => {},
    updateRenderContext: () => {},
    getRenderContext: () => undefined,
    getPriority: () => 120,
    batchRender: () => {},
  };
};

const createContext = (entity: IEntity, withCanvas = true): IRenderContext => {
  const context: IRenderContext = {
    nodes: [entity],
    viewport: { x: 0, y: 0, zoom: 1, width: 1920, height: 1080 },
    timestamp: Date.now(),
  };

  if (withCanvas) {
    context.canvas = document.createElement("canvas");
  }

  return context;
};

beforeEach(() => {
  setWebGPUSupport(true);
});

afterEach(() => {
  setWebGPUSupport(false);
});

describe("WebGPUDefaultStrategyPlugin", () => {
  it("返回 WebGPU 渲染器选择结果", () => {
    const renderer = createRenderer();
    const plugin = new WebGPUDefaultStrategyPlugin(renderer);
    const entity = createEntity();
    const context = createContext(entity);

    const selection = plugin.selectOptimalRenderer(entity, context);
    expect(selection.mode).toBe("webgpu");
    expect(selection.renderer).toBe(renderer);
    expect(selection.confidence).toBeGreaterThan(0.5);
  });

  it("缺少 Canvas 时返回不适用", () => {
    const renderer = createRenderer();
    const plugin = new WebGPUDefaultStrategyPlugin(renderer);
    const entity = createEntity();
    const context = createContext(entity, false);

    expect(() => plugin.selectOptimalRenderer(entity, context)).toThrow(
      RenderStrategyNotApplicableError
    );
  });

  it("支持自定义 predicate", () => {
    const renderer = createRenderer({
      canRender: (entity) => entity.type === "gpu-only",
    });
    const plugin = new WebGPUDefaultStrategyPlugin(renderer, {
      predicate: (entity) => entity.type === "gpu-only",
    });
    const entity = createEntity({ type: "gpu-only" });
    const context = createContext(entity);

    const selection: RenderSelection = plugin.selectOptimalRenderer(entity, context);
    expect(selection.mode).toBe("webgpu");
    expect(selection.renderer).toBe(renderer);
  });

  it("批量选择仅分组可处理实体", () => {
    const renderer = createRenderer();
    const plugin = new WebGPUDefaultStrategyPlugin(renderer);
    const entities = [
      createEntity({ id: "1", type: "diagram-canvas" }),
      createEntity({ id: "2", type: "diagram-node" }),
    ];

    const groups = plugin.selectForBatch(entities);
    const groupedEntities = groups.get(renderer);

    expect(groupedEntities?.length).toBe(1);
    expect(groupedEntities?.[0].id).toBe("1");
  });

  it("不支持 WebGPU 环境下抛出不可用错误", () => {
    setWebGPUSupport(false);
    const renderer = createRenderer();
    const plugin = new WebGPUDefaultStrategyPlugin(renderer);
    const entity = createEntity();
    const context = createContext(entity);

    expect(() => plugin.selectOptimalRenderer(entity, context)).toThrow(
      RenderStrategyNotApplicableError
    );
  });
});
