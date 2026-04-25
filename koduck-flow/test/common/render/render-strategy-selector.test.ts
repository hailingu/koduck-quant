import { describe, expect, it, vi } from "vitest";
import type { IEntity } from "../../../src/common/entity";
import type { IRender, IRenderContext, RenderSelection } from "../../../src/common/render";
import {
  RenderStrategySelector,
  RenderStrategyNotApplicableError,
  type IRenderStrategyPlugin,
} from "../../../src/common/render";

const createEntity = (overrides: Partial<IEntity> = {}): IEntity =>
  ({
    id: "entity-1",
    type: "diagram",
    data: { toJSON: () => ({}) },
    ...overrides,
  }) as IEntity;

const createContext = (entity: IEntity): IRenderContext => ({
  nodes: [entity],
  viewport: { x: 0, y: 0, zoom: 1, width: 1024, height: 768 },
  timestamp: Date.now(),
});

const createRenderer = (name: string, type: RenderSelection["mode"]): IRender => ({
  getName: () => name,
  getType: () => type,
  render: () => null,
  canRender: () => true,
  getPerformanceStats: () => ({
    renderCount: 0,
    totalRenderTime: 0,
    averageRenderTime: 0,
    type,
    name,
  }),
  dispose: vi.fn(),
  setRegistryManager: vi.fn(),
});

type StrategyOptions = {
  id: string;
  priority: number;
  mode: RenderSelection["mode"];
  canHandle?: (entity: IEntity, context: IRenderContext) => boolean;
  selectImpl?: (entity: IEntity, context: IRenderContext) => RenderSelection;
};

const createStrategy = ({
  id,
  priority,
  mode,
  canHandle,
  selectImpl,
}: StrategyOptions): IRenderStrategyPlugin => {
  const renderer = createRenderer(`${id}-renderer`, mode);

  return {
    id,
    descriptor: {
      id,
      displayName: `${id} strategy`,
      version: "1.0.0",
      supportedModes: [mode],
      priority,
    },
    canHandle,
    getStrategyName: () => id,
    selectOptimalRenderer: (entity, context) =>
      selectImpl?.(entity, context) ?? {
        renderer,
        mode,
        reason: `${id} selected`,
        confidence: 0.9,
      },
    selectForBatch: (entities) => {
      const map = new Map<IRender, IEntity[]>();
      map.set(renderer, entities);
      return map;
    },
  };
};

describe("RenderStrategySelector", () => {
  it("按优先级选择最匹配的策略", () => {
    const primary = createStrategy({ id: "primary", priority: 100, mode: "react" });
    const fallback = createStrategy({ id: "fallback", priority: 50, mode: "canvas" });

    const selector = new RenderStrategySelector([fallback, primary]);
    const entity = createEntity();
    const context = createContext(entity);

    const selection = selector.selectOptimalRenderer(entity, context);

    expect(selection.mode).toBe("react");
    expect(selection.reason).toContain("primary");
  });

  it("遇到策略声明不适用时自动跳过", () => {
    const notApplicable = createStrategy({
      id: "gpu-only",
      priority: 200,
      mode: "webgpu",
      selectImpl: () => {
        throw new RenderStrategyNotApplicableError("缺少 GPU 能力");
      },
    });

    const fallback = createStrategy({ id: "fallback", priority: 100, mode: "react" });
    const selector = new RenderStrategySelector([notApplicable, fallback]);
    const entity = createEntity();
    const context = createContext(entity);

    const selection = selector.selectOptimalRenderer(entity, context);
    expect(selection.mode).toBe("react");
  });

  it("返回能力描述并按照优先级排序", () => {
    const low = createStrategy({ id: "low", priority: 1, mode: "canvas" });
    const high = createStrategy({ id: "high", priority: 5, mode: "react" });

    const selector = new RenderStrategySelector([low, high]);
    const descriptors = selector.listStrategyDescriptors();

    expect(descriptors.map((item) => item.id)).toEqual(["high", "low"]);
  });

  it("summarizeCapabilities 根据标签分组", () => {
    const tagged = createStrategy({ id: "tagged", priority: 10, mode: "canvas" });
    tagged.descriptor.tags = ["batching", "device"];
    const untagged = createStrategy({ id: "plain", priority: 5, mode: "react" });

    const selector = new RenderStrategySelector([tagged, untagged]);
    const summary = selector.summarizeCapabilities();

    expect(summary.batching?.[0].id).toBe("tagged");
    expect(summary.device?.[0].id).toBe("tagged");
    expect(summary.default?.[0].id).toBe("plain");
  });
});
