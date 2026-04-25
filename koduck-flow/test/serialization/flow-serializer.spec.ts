import { describe, expect, it, beforeEach, vi } from "vitest";
import { FlowSerializer } from "../../src/common/flow/serialization/flow-serializer";
import type {
  FlowSerialization,
  FlowSerializationState,
  FlowSnapshot,
} from "../../src/common/flow/serialization";
import type { HookAdapter } from "../../src/common/flow/orchestration/hook-adapter";
import type {
  MetricsAdapter,
  TimingResult,
} from "../../src/common/flow/orchestration/metrics-adapter";

interface MetricsAdapterMock {
  withTiming: <T>(label: string, fn: () => T) => TimingResult<T>;
  recordSerialization: (count: number, duration: number) => void;
  recordFlowLoaded: (duration: number) => void;
}

describe("FlowSerializer", () => {
  const baseState: FlowSerializationState = {
    id: "flow-id",
    name: "My Flow",
    createdAt: "2025-10-28T10:00:00.000Z",
    updatedAt: "2025-10-28T11:00:00.000Z",
    metadata: { source: "test" },
  };

  let serialization: FlowSerialization;
  let hookAdapter: HookAdapter;
  let metricsAdapter: MetricsAdapterMock;
  let toJSONMock: ReturnType<typeof vi.fn>;
  let loadFromJSONMock: ReturnType<typeof vi.fn>;
  let runFlowSavedMock: ReturnType<typeof vi.fn>;
  let runFlowLoadedMock: ReturnType<typeof vi.fn>;
  let withTimingMock: ReturnType<typeof vi.fn>;
  let recordSerializationMock: ReturnType<typeof vi.fn>;
  let recordFlowLoadedMock: ReturnType<typeof vi.fn>;

  const createSerializer = () =>
    new FlowSerializer(serialization, hookAdapter, metricsAdapter as unknown as MetricsAdapter);

  beforeEach(() => {
    toJSONMock = vi.fn();
    loadFromJSONMock = vi.fn();

    serialization = {
      toJSON: toJSONMock,
      loadFromJSON: loadFromJSONMock,
      getStateSnapshot: vi.fn().mockReturnValue(baseState),
    } as unknown as FlowSerialization;

    runFlowSavedMock = vi.fn().mockReturnValue(true);
    runFlowLoadedMock = vi.fn().mockReturnValue(true);
    hookAdapter = {
      runFlowSaved: runFlowSavedMock,
      runFlowLoaded: runFlowLoadedMock,
    } as unknown as HookAdapter;

    withTimingMock = vi.fn(
      (label: string, fn: () => unknown): TimingResult<unknown> => ({
        result: fn(),
        duration: label === "flow-deserialization" ? 7 : 12,
      })
    );
    recordSerializationMock = vi.fn();
    recordFlowLoadedMock = vi.fn();

    metricsAdapter = {
      withTiming: (<T>(label: string, fn: () => T): TimingResult<T> => {
        const { result, duration } = withTimingMock(label, fn);
        return { result: result as T, duration };
      }) as MetricsAdapterMock["withTiming"],
      recordSerialization: recordSerializationMock,
      recordFlowLoaded: recordFlowLoadedMock,
    };
  });

  describe("toJSON", () => {
    it("records metrics when hooks allow serialization", () => {
      const snapshot: FlowSnapshot = {
        ...baseState,
        entities: [{ id: "n1" }, { id: "n2" }],
        flowGraph: undefined,
      };
      toJSONMock.mockReturnValue(snapshot);

      const serializer = createSerializer();
      const result = serializer.toJSON();

      expect(result).toBe(snapshot);
      expect(runFlowSavedMock).toHaveBeenCalledTimes(1);
      expect(withTimingMock).toHaveBeenCalledTimes(1);
      expect(recordSerializationMock).toHaveBeenCalledWith(2, 12);
    });

    it("returns state-only snapshot and skips metrics when save is vetoed", () => {
      runFlowSavedMock.mockReturnValue(false);

      const serializer = createSerializer();
      const result = serializer.toJSON();

      expect(result.entities).toEqual([]);
      expect(result.id).toBe(baseState.id);
      expect(withTimingMock).not.toHaveBeenCalled();
      expect(recordSerializationMock).not.toHaveBeenCalled();
    });
  });

  describe("loadFromJSON", () => {
    it("throws when input is not an object", () => {
      const serializer = createSerializer();

      expect(() => serializer.loadFromJSON(null as unknown as Record<string, unknown>)).toThrow(
        /Invalid JSON input/
      );
      expect(loadFromJSONMock).not.toHaveBeenCalled();
    });

    it("records metrics when hooks approve load", () => {
      const payload = { id: "flow-id" };
      withTimingMock.mockImplementation((label: string, fn: () => boolean) => ({
        result: fn(),
        duration: 7,
      }));

      const serializer = createSerializer();
      serializer.loadFromJSON(payload);

      expect(withTimingMock).toHaveBeenCalledWith("flow-deserialization", expect.any(Function));
      expect(loadFromJSONMock).toHaveBeenCalledWith(payload);
      expect(runFlowLoadedMock).toHaveBeenCalledWith(payload);
      expect(recordFlowLoadedMock).toHaveBeenCalledWith(7);
    });

    it("skips metrics when load hook rejects", () => {
      runFlowLoadedMock.mockReturnValue(false);

      const serializer = createSerializer();

      serializer.loadFromJSON({ id: "flow-id" });

      expect(recordFlowLoadedMock).not.toHaveBeenCalled();
    });
  });
});
