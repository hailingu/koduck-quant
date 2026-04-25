import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IEntity } from "../../../../src/common/entity";
import type { ISSRRenderer, IRenderContext, RenderSelection } from "../../../../src/common/render";
import {
  SSRDefaultStrategyPlugin,
  RenderStrategyNotApplicableError,
} from "../../../../src/common/render";

const originalWindow = globalThis.window;

const setServerEnvironment = (isServer: boolean) => {
  if (isServer) {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: undefined,
    });
  } else {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: originalWindow,
    });
  }
};

const createEntity = (overrides: Partial<IEntity> = {}): IEntity =>
  ({
    id: overrides.id ?? "entity-ssr",
    type: overrides.type ?? "page",
    data: overrides.data ?? { toJSON: () => ({}) },
  }) as IEntity;

const createContext = (entity: IEntity, metadata?: Record<string, unknown>): IRenderContext => ({
  nodes: [entity],
  viewport: { x: 0, y: 0, zoom: 1, width: 1920, height: 1080 },
  timestamp: Date.now(),
  metadata: { ssr: true, renderTarget: "ssr", ...metadata },
});

const createRenderer = (
  options: {
    name?: string;
    canRender?: (entity: IEntity) => boolean;
    renderToString?: (entity: IEntity, context: IRenderContext) => string | Promise<string>;
  } = {}
): ISSRRenderer => {
  const { name = "SSRRender", canRender = () => true } = options;
  const hasCustomRenderToString = Object.prototype.hasOwnProperty.call(options, "renderToString");
  const renderToString = hasCustomRenderToString
    ? (options.renderToString as ISSRRenderer["renderToString"])
    : (entity: IEntity) => `<div>${entity.id}</div>`;

  return {
    getName: () => name,
    getType: () => "ssr" as const,
    render: () => null,
    renderToString,
    canRender,
    getPerformanceStats: () => ({
      renderCount: 0,
      totalRenderTime: 0,
      averageRenderTime: 0,
      type: "ssr",
      name,
    }),
    setRegistryManager: () => {},
    dispose: () => {},
  };
};

beforeEach(() => {
  setServerEnvironment(true);
});

afterEach(() => {
  vi.restoreAllMocks();
  setServerEnvironment(false);
});

describe("SSRDefaultStrategyPlugin", () => {
  it("返回 SSR 渲染器选择结果并提供 renderToString", async () => {
    const renderer = createRenderer();
    const plugin = new SSRDefaultStrategyPlugin(renderer);
    const entity = createEntity();
    const context = createContext(entity);

    const selection = plugin.selectOptimalRenderer(entity, context);
    expect(selection.mode).toBe("ssr");
    expect(selection.renderer).toBe(renderer);
    expect(selection.confidence).toBeGreaterThan(0.5);
    expect(selection.renderToString).toBeTypeOf("function");

    const output = await selection.renderToString?.(entity, context);
    expect(output).toContain(entity.id);
  });

  it("浏览器环境下默认判定为不可用", () => {
    setServerEnvironment(false);
    const renderer = createRenderer();
    const plugin = new SSRDefaultStrategyPlugin(renderer);
    const entity = createEntity();
    const context = createContext(entity);

    expect(() => plugin.selectOptimalRenderer(entity, context)).toThrow(
      RenderStrategyNotApplicableError
    );
  });

  it("支持自定义 predicate", () => {
    const renderer = createRenderer({
      canRender: (entity) => entity.type === "ssr-only",
    });
    const plugin = new SSRDefaultStrategyPlugin(renderer, {
      requireServerEnvironment: true,
      predicate: (entity) => entity.type === "ssr-only",
    });
    const entity = createEntity({ type: "ssr-only" });
    const context = createContext(entity, { ssr: true });

    const selection: RenderSelection = plugin.selectOptimalRenderer(entity, context);
    expect(selection.mode).toBe("ssr");
  });

  it("selectForBatch 仅分组可处理实体", () => {
    const renderer = createRenderer();
    const plugin = new SSRDefaultStrategyPlugin(renderer);
    const entities = [
      createEntity({ id: "ssr-1", type: "page" }),
      createEntity({ id: "ssr-2", type: "diagram-canvas" }),
    ];

    const groups = plugin.selectForBatch(entities);
    const groupedEntities = groups.get(renderer);

    expect(groupedEntities?.map((item) => item.id)).toEqual(["ssr-1"]);
  });

  it("renderer 无 renderToString 时抛出不可用错误", () => {
    const renderer = createRenderer({
      renderToString: undefined as unknown as ISSRRenderer["renderToString"],
    });
    const plugin = new SSRDefaultStrategyPlugin(renderer);
    const entity = createEntity();
    const context = createContext(entity);

    expect(() => plugin.selectOptimalRenderer(entity, context)).toThrow(
      RenderStrategyNotApplicableError
    );
  });
});
