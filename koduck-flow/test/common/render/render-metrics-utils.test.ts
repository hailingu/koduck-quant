import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IEntity } from "../../../src/common/entity";
import type { ScopedMeter } from "../../../src/common/metrics";
import type { RenderMetricsRecorder } from "../../../src/common/render/render-metrics-utils";

const { createRenderMetricsRecorder, batchRenderWithMetrics } = await import(
  "../../../src/common/render/render-metrics-utils"
);

const createMeter = () => {
  const counterAdds = new Map<string, ReturnType<typeof vi.fn>>();
  const histogramCalls = new Map<string, { record: ReturnType<typeof vi.fn>; options: unknown }>();

  const meter = {
    counter: vi.fn((name: string) => {
      const add = vi.fn();
      counterAdds.set(name, add);
      return { add };
    }),
    histogram: vi.fn((name: string, options?: unknown) => {
      const record = vi.fn();
      histogramCalls.set(name, { record, options });
      return { record };
    }),
  } as unknown as ScopedMeter;

  return { meter, counterAdds, histogramCalls };
};

describe("createRenderMetricsRecorder", () => {
  let now = 0;
  let nowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    now = 100;
    nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it("records render duration and counters with entity metadata", () => {
    const { meter, counterAdds, histogramCalls } = createMeter();
    const recorder = createRenderMetricsRecorder(meter);

    const endRecord = recorder.recordRenderStart("e-1", "widget");
    now += 12;
    endRecord();

    expect(counterAdds.get("render.count")).toHaveBeenCalledWith(1, {
      entityType: "widget",
    });
    const duration = histogramCalls.get("render.duration.ms");
    expect(duration?.options).toEqual({ unit: "ms" });
    expect(duration?.record).toHaveBeenCalledWith(12, { entityType: "widget" });
  });

  it("records batch statistics and cache events", () => {
    const { meter, counterAdds, histogramCalls } = createMeter();
    const recorder = createRenderMetricsRecorder(meter);

    recorder.recordCacheHit("node");
    recorder.recordCacheMiss("node");
    recorder.recordError("node", "timeout");
    recorder.recordSkipped("node", "invisible");
    recorder.recordBatch(5, 9);

    expect(counterAdds.get("cache.hit")).toHaveBeenCalledWith(1, { entityType: "node" });
    expect(counterAdds.get("cache.miss")).toHaveBeenCalledWith(1, { entityType: "node" });
    expect(counterAdds.get("render.error")).toHaveBeenCalledWith(1, {
      entityType: "node",
      errorType: "timeout",
    });
    expect(counterAdds.get("render.skipped")).toHaveBeenCalledWith(1, {
      entityType: "node",
      reason: "invisible",
    });

    const sizeHistogram = histogramCalls.get("batch.size");
    expect(sizeHistogram?.options).toEqual({ unit: "count" });
    expect(sizeHistogram?.record).toHaveBeenCalledWith(5);

    const durationHistogram = histogramCalls.get("batch.duration.ms");
    expect(durationHistogram?.options).toEqual({ unit: "ms" });
    expect(durationHistogram?.record).toHaveBeenCalledWith(9);

    expect(counterAdds.get("batch.count")).toHaveBeenCalledWith(1);
  });
});

describe("batchRenderWithMetrics", () => {
  let now = 0;
  let nowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    now = 100;
    nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it("returns render results and records batch metrics", () => {
    const entities = [
      { id: "a", type: "node", data: undefined, config: undefined, dispose: vi.fn() },
      { id: "b", type: "node", data: undefined, config: undefined, dispose: vi.fn() },
    ];

    const recorder: RenderMetricsRecorder = {
      recordRenderStart: vi.fn(),
      recordCacheHit: vi.fn(),
      recordCacheMiss: vi.fn(),
      recordError: vi.fn(),
      recordBatch: vi.fn(),
      recordSkipped: vi.fn(),
    };

    const renderFn = vi.fn((entity) => {
      now += 5;
      return entity.id;
    });

    const results = batchRenderWithMetrics(recorder, entities as unknown as IEntity[], renderFn);

    expect(results).toEqual(["a", "b"]);
    expect(renderFn).toHaveBeenCalledTimes(2);
    expect(recorder.recordBatch).toHaveBeenCalledWith(2, 10);
  });
});
