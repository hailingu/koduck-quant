import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IEntity } from "../../../src/common/entity";
import type { RenderSelection } from "../../../src/common/render/types";

const { SelectionCore } = await import("../../../src/common/render/selection-core");
const { ENTITY_COUNT_THRESHOLDS } = await import("../../../src/common/render/render-constants");

const createEntity = (options: {
  id: string;
  type: string;
  vertexCount?: number;
  complexity?: number;
}): IEntity => {
  const hasComplexityData = options.vertexCount !== undefined || options.complexity !== undefined;
  const data = hasComplexityData
    ? {
        toJSON: () => ({
          vertexCount: options.vertexCount,
          complexity: options.complexity,
        }),
      }
    : undefined;

  return {
    id: options.id,
    type: options.type,
    data: data as unknown as IEntity["data"],
    config: undefined,
    dispose: () => {},
  } as unknown as IEntity;
};

describe("SelectionCore analyze & cache helpers", () => {
  let dateNowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(1_700_000);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it("computes complexity with caps for high vertex counts", () => {
    const complexEntity = createEntity({
      id: "mesh",
      type: "mesh-3d-large-dataset",
      vertexCount: ENTITY_COUNT_THRESHOLDS.ULTRA_LARGE * 2,
      complexity: 9,
    });

    expect(SelectionCore.analyzeComplexity(complexEntity)).toBe(1);

    const simpleEntity = createEntity({ id: "simple", type: "node" });
    expect(SelectionCore.analyzeComplexity(simpleEntity)).toBeCloseTo(0.1, 5);
  });

  it("creates default context anchored to current timestamp", () => {
    const entity = createEntity({ id: "ctx", type: "node" });
    const context = SelectionCore.createDefaultContext(entity);

    expect(context.nodes).toEqual([entity]);
    expect(context.viewport).toEqual({ x: 0, y: 0, zoom: 1, width: 0, height: 0 });
    expect(context.timestamp).toBe(1_700_000);
  });

  it("generates deterministic cache keys with additional factors", () => {
    const entity = createEntity({
      id: "cache",
      type: "3d-node",
      vertexCount: ENTITY_COUNT_THRESHOLDS.LARGE,
      complexity: 4,
    });

    const metrics = { fps: 58, memory: 1.25, lastUpdateTime: 0 };
    const factors = { device: "gpu", locale: "zh" };

    const key = SelectionCore.generateCacheKey(entity, metrics, factors);
    const bucket = Math.floor(SelectionCore.analyzeComplexity(entity) * 10);

    expect(key).toBe(
      `3d-node_cache_${bucket}_${Math.floor(58 / 15)}_${Math.floor(1.25 * 5)}_device:gpu_locale:zh`
    );
  });

  it("evaluates cache freshness and touch semantics", () => {
    const entry = SelectionCore.createCacheEntry({ value: "cached" });
    expect(entry.accessCount).toBe(0);
    expect(entry.timestamp).toBe(1_700_000);

    dateNowSpy.mockReturnValue(1_700_010);
    const touched = SelectionCore.touchCacheEntry(entry);
    expect(touched.accessCount).toBe(1);

    dateNowSpy.mockReturnValue(1_700_012);
    expect(SelectionCore.isCacheValid(touched, 15)).toBe(true);

    dateNowSpy.mockReturnValue(1_700_040);
    expect(SelectionCore.isCacheValid(touched, 15)).toBe(false);
    expect(SelectionCore.isCacheValid(undefined, 15)).toBe(false);
  });

  it("evicts least-used entries via LRU policy", () => {
    const cache = new Map<string, ReturnType<typeof SelectionCore.createCacheEntry>>([
      ["keep-high", { value: 1, timestamp: 90, accessCount: 5 }],
      ["keep-new", { value: 2, timestamp: 120, accessCount: 2 }],
      ["drop", { value: 3, timestamp: 80, accessCount: 0 }],
    ]);

    SelectionCore.evictLRU(cache, 2);
    expect(cache.has("drop")).toBe(false);
    expect(cache.size).toBeLessThanOrEqual(2);

    SelectionCore.evictLRU(cache, 5);
    expect(cache.size).toBeLessThanOrEqual(2);
  });
});

describe("SelectionCore decisions", () => {
  const rendererA = { id: "A" } as unknown as RenderSelection["renderer"];
  const rendererB = { id: "B" } as unknown as RenderSelection["renderer"];

  it("scores selection confidence and comparison", () => {
    expect(
      SelectionCore.isConfidentSelection({
        renderer: rendererA,
        mode: "canvas",
        reason: "test",
        confidence: 0.8,
      })
    ).toBe(true);

    const better = SelectionCore.compareSelections(
      {
        renderer: rendererA,
        mode: "canvas",
        reason: "",
        confidence: 0.6,
      },
      {
        renderer: rendererB,
        mode: "canvas",
        reason: "detailed",
        confidence: 0.6,
      }
    );

    expect(better.renderer).toBe(rendererB);
  });

  it("groups entities by renderer and skips failures", () => {
    const entities: IEntity[] = [
      createEntity({ id: "1", type: "node" }),
      createEntity({ id: "2", type: "node" }),
      createEntity({ id: "3", type: "node" }),
    ];

    const groups = SelectionCore.groupEntitiesByRenderer(entities, (entity) => {
      if (entity.id === "2") {
        throw new Error("bad");
      }
      return {
        renderer: entity.id === "1" ? rendererA : rendererB,
      } as { renderer: RenderSelection["renderer"] };
    });

    expect(groups.get(rendererA)).toEqual([entities[0]]);
    expect(groups.get(rendererB)).toEqual([entities[2]]);
    expect(groups.size).toBe(2);
  });

  it("estimates batch size based on complexity and volume", () => {
    expect(SelectionCore.estimateBatchSize(50, 0.2)).toBe(50);
    expect(SelectionCore.estimateBatchSize(5_000, 0.8)).toBe(50);
    expect(SelectionCore.estimateBatchSize(50_000, 0.4)).toBe(Math.floor(50_000 / 100));
  });
});
