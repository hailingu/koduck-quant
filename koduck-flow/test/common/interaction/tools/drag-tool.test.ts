import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DragTool } from "../../../../src/common/interaction/tools/drag-tool";
import type {
  InteractionEnv,
  PointerLikeEvent,
} from "../../../../src/common/interaction/types";
import type { IEntity } from "../../../../src/common/entity";
import type { EntityManager } from "../../../../src/common/entity/entity-manager";
import type { RenderEventManager } from "../../../../src/common/event";
import { Data } from "../../../../src/common/data";

type TestEntityData = Data & {
  position: { x: number; y: number };
  size: { width: number; height: number };
};

type TestEntity = IEntity & {
  data: TestEntityData;
  getBounds: () => { x: number; y: number; width: number; height: number };
  setPosition: (x: number, y: number) => void;
};

const createEntity = (id: string, x: number, y: number): TestEntity => {
  const bounds = { x, y, width: 100, height: 60 };
  const data = new Data() as TestEntityData;
  data.position = { x, y };
  data.size = { width: bounds.width, height: bounds.height };

  const entity: TestEntity = {
    id,
    type: "test-entity",
    data,
    getBounds: vi.fn(() => ({ ...bounds })),
    setPosition: vi.fn((nextX: number, nextY: number) => {
      bounds.x = nextX;
      bounds.y = nextY;
      entity.data.position = { x: nextX, y: nextY };
    }),
    dispose: vi.fn(),
  } as TestEntity;

  return entity;
};

const createPointer = (
  overrides: Partial<PointerLikeEvent> = {}
): PointerLikeEvent => ({
  clientX: 150,
  clientY: 150,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  preventDefault: vi.fn(),
  ...overrides,
});

const createEnv = (): InteractionEnv => ({
  getCanvas: vi.fn(
    () =>
      ({
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 800,
          height: 600,
        }),
      } as unknown as HTMLCanvasElement)
  ),
  getViewport: vi.fn(() => ({
    x: 0,
    y: 0,
    zoom: 1,
    width: 800,
    height: 600,
  })),
});

describe("DragTool", () => {
  let entities: TestEntity[];
  let entityManager: EntityManager;
  let renderEvents: RenderEventManager;
  let env: InteractionEnv;
  let tool: DragTool;

  beforeEach(() => {
    entities = [
      createEntity("node-1", 100, 100),
      createEntity("node-2", 260, 100),
    ];

    const entityManagerImpl = {
      getEntities: vi.fn(() => entities as unknown as IEntity[]),
      getEntity: vi.fn(
        (id: string) =>
          (entities.find((e) => e.id === id) ?? null) as unknown as IEntity
      ),
      updateEntity: vi.fn(() => true),
    } satisfies Record<string, unknown>;

    const renderEventsImpl = {
      requestRenderEntities: vi.fn(),
      requestRenderAll: vi.fn(),
    } satisfies Record<string, unknown>;

    entityManager = entityManagerImpl as unknown as EntityManager;
    renderEvents = renderEventsImpl as unknown as RenderEventManager;

    env = createEnv();

    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    tool = new DragTool({
      entityManager,
      renderEvents,
      gridSnap: 10,
      getSelectedIds: () => new Set(),
      setSelectedIds: () => {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false when no canvas is available", () => {
    const envWithoutCanvas: InteractionEnv = {
      ...env,
      getCanvas: vi.fn(() => null),
    };

    const result = tool.onMouseDown(createPointer(), envWithoutCanvas);
    expect(result).toBe(false);
  });

  it("returns false when pointer misses entities", () => {
    const result = tool.onMouseDown(
      createPointer({ clientX: 10, clientY: 10 }),
      env
    );

    expect(result).toBe(false);
  });

  it("starts a single drag when entity hit", () => {
    const pointer = createPointer({ clientX: 120, clientY: 130 });
    const handled = tool.onMouseDown(pointer, env);

    expect(handled).toBe(true);
    expect((tool as unknown as { dragging: unknown }).dragging).toMatchObject({
      mode: "single",
      id: "node-1",
    });
  });

  it("updates entity position during move and requests render", () => {
    tool.onMouseDown(createPointer({ clientX: 120, clientY: 130 }), env);
    const handled = tool.onMouseMove(
      createPointer({ clientX: 160, clientY: 180 }),
      env
    );

    expect(handled).toBe(true);
    expect(entityManager.updateEntity).toHaveBeenCalled();
    expect(renderEvents.requestRenderEntities).toHaveBeenCalledWith({
      entityIds: ["node-1"],
      reason: "drag-move",
      op: "render",
    });
  });

  it("supports group drag when multiple nodes selected", () => {
    tool = new DragTool({
      entityManager,
      renderEvents,
      getSelectedIds: () => new Set(["node-1", "node-2"]),
      setSelectedIds: () => {},
    });

    tool.onMouseDown(createPointer({ clientX: 120, clientY: 130 }), env);
    tool.onMouseMove(createPointer({ clientX: 150, clientY: 150 }), env);

    expect(entityManager.updateEntity).toHaveBeenCalledTimes(2);
    expect(renderEvents.requestRenderEntities).toHaveBeenCalledWith({
      entityIds: ["node-1", "node-2"],
      reason: "drag-move",
      op: "render",
    });
  });

  it("requests full render on mouse up", () => {
    tool.onMouseDown(createPointer({ clientX: 120, clientY: 130 }), env);
    const handled = tool.onMouseUp();

    expect(handled).toBe(true);
    expect(renderEvents.requestRenderAll).toHaveBeenCalledWith({
      reason: "drag-end",
    });
  });

  it("clears drag state on mouse leave", () => {
    tool.onMouseDown(createPointer({ clientX: 120, clientY: 130 }), env);
    const handled = tool.onMouseLeave();

    expect(handled).toBe(false);
    expect(renderEvents.requestRenderEntities).not.toHaveBeenCalledWith(
      expect.objectContaining({ reason: "drag-move" })
    );
  });
});
