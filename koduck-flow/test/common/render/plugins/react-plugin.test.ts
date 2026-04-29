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
  it("returns React renderer selection result", () => {
    const renderer = createRenderer();
    const plugin = new ReactDefaultStrategyPlugin(renderer);
    const entity = createEntity();
    const context = createContext(entity);

    const selection = plugin.selectOptimalRenderer(entity, context);
    expect(selection.mode).toBe("react");
    expect(selection.renderer).toBe(renderer);
    expect(selection.confidence).toBeGreaterThan(0.5);
  });

  it("returns not applicable for canvas entities", () => {
    const renderer = createRenderer();
    const plugin = new ReactDefaultStrategyPlugin(renderer);
    const entity = createEntity({ type: "diagram-canvas" });
    const context = createContext(entity);

    expect(() => plugin.selectOptimalRenderer(entity, context)).toThrow(
      RenderStrategyNotApplicableError
    );
  });

  it("supports custom predicate", () => {
    const renderer = createRenderer();
    const plugin = new ReactDefaultStrategyPlugin(renderer, {
      predicate: (entity) => entity.type === "react-only",
    });
    const entity = createEntity({ type: "react-only" });
    const context = createContext(entity);

    const selection: RenderSelection = plugin.selectOptimalRenderer(entity, context);
    expect(selection.mode).toBe("react");
  });

  it("selectForBatch only groups handleable entities", () => {
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

  it("throws not applicable error when renderer cannot render", () => {
    const renderer = createRenderer({ canRender: false });
    const plugin = new ReactDefaultStrategyPlugin(renderer);
    const entity = createEntity();
    const context = createContext(entity);

    expect(() => plugin.selectOptimalRenderer(entity, context)).toThrow(
      RenderStrategyNotApplicableError
    );
  });
});
