import { describe, expect, it } from "vitest";
import type { IEntity } from "../../../../src/common/entity";
import type {
  IRenderContext,
  IReactRenderer,
  RenderSelection,
} from "../../../../src/common/render";
import {
  ReactDefaultStrategyPlugin,
  RenderStrategyNotApplicableError,
} from "../../../../src/common/render";

const createEntity = (overrides: Partial<IEntity> = {}): IEntity =>
  ({
    id: overrides.id ?? "entity-1",
    type: overrides.type ?? "diagram-node",
    data: overrides.data ?? { toJSON: () => ({}) },
  }) as IEntity;

const createContext = (entity: IEntity): IRenderContext => ({
  nodes: [entity],
  viewport: { x: 0, y: 0, zoom: 1, width: 1920, height: 1080 },
  timestamp: Date.now(),
});

const createRenderer = (options: { canRender?: boolean; name?: string } = {}): IReactRenderer => {
  const { canRender = true, name = "ReactRender" } = options;

  return {
    getName: () => name,
    getType: () => "react",
    render: () => null,
    canRender: () => canRender,
    getPerformanceStats: () => ({
      renderCount: 0,
      totalRenderTime: 0,
      averageRenderTime: 0,
      type: "react",
      name,
    }),
    setRegistryManager: () => {},
    dispose: () => {},
  };
};

describe("ReactDefaultStrategyPlugin", () => {
  it("返回 React 渲染器选择结果", () => {
    const renderer = createRenderer();
    const plugin = new ReactDefaultStrategyPlugin(renderer);
    const entity = createEntity();
    const context = createContext(entity);

    const selection = plugin.selectOptimalRenderer(entity, context);
    expect(selection.mode).toBe("react");
    expect(selection.renderer).toBe(renderer);
    expect(selection.confidence).toBeGreaterThan(0.5);
  });

  it("对于 canvas 实体返回不适用", () => {
    const renderer = createRenderer();
    const plugin = new ReactDefaultStrategyPlugin(renderer);
    const entity = createEntity({ type: "diagram-canvas" });
    const context = createContext(entity);

    expect(() => plugin.selectOptimalRenderer(entity, context)).toThrow(
      RenderStrategyNotApplicableError
    );
  });

  it("支持自定义 predicate", () => {
    const renderer = createRenderer();
    const plugin = new ReactDefaultStrategyPlugin(renderer, {
      predicate: (entity) => entity.type === "react-only",
    });
    const entity = createEntity({ type: "react-only" });
    const context = createContext(entity);

    const selection: RenderSelection = plugin.selectOptimalRenderer(entity, context);
    expect(selection.mode).toBe("react");
  });

  it("selectForBatch 仅分组可处理实体", () => {
    const renderer = createRenderer();
    const plugin = new ReactDefaultStrategyPlugin(renderer);
    const entities = [
      createEntity({ id: "1", type: "diagram-node" }),
      createEntity({ id: "2", type: "diagram-canvas" }),
    ];

    const groups = plugin.selectForBatch(entities);
    const groupedEntities = groups.get(renderer);

    expect(groupedEntities?.length).toBe(1);
    expect(groupedEntities?.[0].id).toBe("1");
  });

  it("renderer 无法渲染时抛出不可用错误", () => {
    const renderer = createRenderer({ canRender: false });
    const plugin = new ReactDefaultStrategyPlugin(renderer);
    const entity = createEntity();
    const context = createContext(entity);

    expect(() => plugin.selectOptimalRenderer(entity, context)).toThrow(
      RenderStrategyNotApplicableError
    );
  });
});
