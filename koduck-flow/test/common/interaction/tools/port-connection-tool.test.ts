import { describe, beforeEach, test, expect, vi, afterEach } from "vitest";
import type { InteractionEnv, PointerLikeEvent } from "../../../../src/common/interaction/types";
import { PortConnectionTool } from "../../../../src/common/interaction/tools/port-connection-tool";
import type { EntityManager } from "../../../../src/common/entity/entity-manager";
import type { EntityUpdateDetail } from "../../../../src/common/entity/update-detail";
import {
  UMLLineEntity,
  UMLNodeEntity,
  type UMLPortInfo,
} from "../../../../src/components/FlowDemo/uml-entities-new-decorator";
import type { IEntityArguments } from "../../../../src/common/entity/types";
import type { UMLPortDefinition } from "../../../../src/components/FlowDemo/uml-entities-new-decorator";
import type { RenderEventManager } from "../../../../src/common/event";
import type { DuckFlowRuntime } from "../../../../src/common/runtime";
import { createTestRuntime } from "../../../utils/runtime";
import type { RenderManager } from "../../../../src/common/render/render-manager";
import type { RegistryManager } from "../../../../src/common/registry/registry-manager";
import type { EventBus } from "../../../../src/common/event/event-bus";

const runtimeEntityManagerStub = vi.hoisted(() => ({
  getEntity: vi.fn(),
  createEntity: vi.fn(),
  removeEntity: vi.fn(),
  hasEntity: vi.fn(),
  getEntities: vi.fn(),
  updateEntity: vi.fn(),
  clearEntities: vi.fn(),
}));

vi.mock("../../../../src/common/api/runtime-context", () => ({
  runtime: { EntityManager: runtimeEntityManagerStub },
  getRuntimeProxy: () => ({ EntityManager: runtimeEntityManagerStub }),
}));

type MinimalLineEntity = Pick<
  UMLLineEntity,
  "id" | "getBounds" | "setConnection" | "getConnection" | "setLineEnd"
> & {
  data: {
    position: { x: number; y: number };
    width: number;
    height: number;
  };
};

class TestLineEntity implements MinimalLineEntity {
  id = "line-1";
  data = {
    position: { x: 0, y: 0 },
    width: 0,
    height: 0,
  };
  private connection: ReturnType<UMLLineEntity["getConnection"]> = {
    sourceId: null,
    targetId: null,
    sourcePort: undefined,
    targetPort: undefined,
    sourcePortIndex: undefined,
    targetPortIndex: undefined,
    state: undefined,
  };

  constructor(source: { x: number; y: number }) {
    this.data.position = { ...source };
  }

  getBounds() {
    return {
      x: this.data.position.x,
      y: this.data.position.y,
      width: this.data.width,
      height: this.data.height,
    };
  }

  setConnection(
    next: ReturnType<UMLLineEntity["getConnection"]>
  ): ReturnType<UMLLineEntity["getConnection"]> {
    this.connection = { ...next };
    return this.connection;
  }

  getConnection(): ReturnType<UMLLineEntity["getConnection"]> {
    return this.connection;
  }

  setLineEnd(x: number, y: number): void {
    this.data.width = x - this.data.position.x;
    this.data.height = y - this.data.position.y;
  }
}

class TestNodeEntity extends UMLNodeEntity {
  private readonly infos: UMLPortInfo[];

  constructor(ports: UMLPortInfo[], args?: IEntityArguments) {
    super(args);
    this.infos = ports;
  }

  override getAllPortInfo(): UMLPortInfo[] {
    return this.infos;
  }
}

const createEntityManagerMock = () => ({
  getEntities: vi.fn<() => unknown[]>(),
  getEntity: vi.fn<(id: string) => unknown>(),
  createEntity: vi.fn<(type: string, data: unknown) => unknown>(),
  updateEntity: vi.fn<(entity: unknown, detail: EntityUpdateDetail) => void>(),
  removeEntity: vi.fn<(id: string) => void>(),
});

const createEnv = (overrides: Partial<InteractionEnv> = {}): InteractionEnv => ({
  getCanvas: vi.fn(
    () =>
      ({
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 800,
          height: 600,
        }),
      }) as HTMLCanvasElement
  ),
  getViewport: vi.fn(() => ({
    x: 0,
    y: 0,
    zoom: 1,
    width: 800,
    height: 600,
  })),
  ...overrides,
});

const pointer = (overrides: Partial<PointerLikeEvent> = {}): PointerLikeEvent => ({
  clientX: 0,
  clientY: 0,
  preventDefault: vi.fn(),
  ...overrides,
});

const portInfo = (definition: UMLPortDefinition, point: { x: number; y: number }): UMLPortInfo => ({
  descriptor: definition,
  x: point.x,
  y: point.y,
  radius: definition.radius ?? 4,
});

const createRenderManagerStub = () =>
  ({
    name: "RenderManager",
    type: "render",
    connectToEntityManager: vi.fn(),
    connectToRegistryManager: vi.fn(),
    dispose: vi.fn(),
    addEntityToRender: vi.fn(),
    removeEntityFromRender: vi.fn(),
    render: vi.fn(() => null),
  }) as unknown as RenderManager;

const createRegistryManagerStub = () =>
  ({
    name: "RegistryManager",
    type: "registry",
    dispose: vi.fn(),
    getRegistry: vi.fn(),
    register: vi.fn(),
  }) as unknown as RegistryManager;

const createEventBusStub = () =>
  ({
    dispose: vi.fn(),
    publish: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  }) as unknown as EventBus;

describe("PortConnectionTool", () => {
  let entityManagerMock: ReturnType<typeof createEntityManagerMock>;
  let entityManager: EntityManager;
  let tool: PortConnectionTool;
  let env: InteractionEnv;
  let runtime: DuckFlowRuntime;
  let renderEventsMock: RenderEventManager;

  beforeEach(() => {
    entityManagerMock = createEntityManagerMock();
    entityManager = entityManagerMock as unknown as EntityManager;
    renderEventsMock = {
      requestRenderEntities: vi.fn(),
      requestRenderAll: vi.fn(),
      notifyViewportChanged: vi.fn(),
      onRenderAll: vi.fn(() => () => {}),
      onRenderEntities: vi.fn(() => () => {}),
      onViewportChanged: vi.fn(() => () => {}),
    } as unknown as RenderEventManager;

    tool = new PortConnectionTool({
      entityManager,
      renderEvents: renderEventsMock,
    });
    env = createEnv();
    Object.assign(runtimeEntityManagerStub, entityManagerMock);

    runtime = createTestRuntime({
      overrides: {
        entityManager: {
          instance: entityManager,
        },
        renderManager: {
          instance: createRenderManagerStub(),
        },
        registryManager: {
          instance: createRegistryManagerStub(),
        },
        eventBus: {
          instance: createEventBusStub(),
        },
        renderEventManager: {
          instance: renderEventsMock,
        },
      },
    });
  });

  afterEach(() => {
    runtime.dispose();
  });

  test("creates dangling line when dragging from out port", () => {
    const definition: UMLPortDefinition = {
      name: "out",
      direction: "out",
      side: "right",
    };
    const info = portInfo(definition, { x: 120, y: 60 });
    const node = new TestNodeEntity([info], {
      x: 100,
      y: 40,
      width: 40,
      height: 40,
    });
    entityManagerMock.getEntities.mockReturnValue([node]);

    const line = new TestLineEntity({ x: info.x, y: info.y });
    entityManagerMock.createEntity.mockReturnValue(line);

    const handled = tool.onMouseDown(pointer({ clientX: info.x, clientY: info.y }), env);

    expect(handled).toBe(true);
    expect(entityManagerMock.createEntity).toHaveBeenCalledWith(
      "uml-line-canvas",
      expect.objectContaining({
        sourceId: node.id,
        sourcePort: definition.name,
        sourcePortIndex: 0,
      })
    );
    expect(entityManagerMock.updateEntity).toHaveBeenCalled();
    expect(line.getConnection().sourceId).toBe(node.id);
    expect(renderEventsMock.requestRenderEntities).toHaveBeenCalledTimes(1);
    expect(renderEventsMock.requestRenderEntities).toHaveBeenCalledWith({
      entityIds: [line.id],
      reason: "connection-start",
    });
  });

  test("updates line end during drag", () => {
    const definition: UMLPortDefinition = {
      name: "out",
      direction: "out",
      side: "right",
    };
    const info = portInfo(definition, { x: 120, y: 60 });
    const node = new TestNodeEntity([info], {
      x: 100,
      y: 40,
      width: 40,
      height: 40,
    });
    entityManagerMock.getEntities.mockReturnValue([node]);

    const line = new TestLineEntity({ x: info.x, y: info.y });
    entityManagerMock.createEntity.mockReturnValue(line);

    expect(tool.onMouseDown(pointer({ clientX: info.x, clientY: info.y }), env)).toBe(true);

    const handled = tool.onMouseMove(pointer({ clientX: 160, clientY: 90 }), env);

    expect(handled).toBe(true);
    expect(entityManagerMock.updateEntity).toHaveBeenCalled();
    expect(line.data.width).toBe(40);
    expect(line.data.height).toBe(30);
    expect(renderEventsMock.requestRenderEntities).toHaveBeenCalledTimes(2);
    expect(renderEventsMock.requestRenderEntities).toHaveBeenNthCalledWith(1, {
      entityIds: [line.id],
      reason: "connection-start",
    });
    expect(renderEventsMock.requestRenderEntities).toHaveBeenNthCalledWith(2, {
      entityIds: [line.id],
      reason: "connection-drag",
    });
  });

  test("finalizes connection when target port detected", () => {
    const outDefinition: UMLPortDefinition = {
      name: "out",
      direction: "out",
      side: "right",
    };
    const inDefinition: UMLPortDefinition = {
      name: "in",
      direction: "in",
      side: "left",
    };
    const outInfo = portInfo(outDefinition, { x: 120, y: 60 });
    const inInfo = portInfo(inDefinition, { x: 200, y: 80 });

    const sourceNode = new TestNodeEntity([outInfo], {
      x: 100,
      y: 40,
      width: 40,
      height: 40,
    });
    const targetNode = new TestNodeEntity([inInfo], {
      x: 180,
      y: 60,
      width: 40,
      height: 40,
    });
    entityManagerMock.getEntities.mockReturnValue([sourceNode, targetNode]);

    const line = new TestLineEntity({ x: outInfo.x, y: outInfo.y });
    entityManagerMock.createEntity.mockReturnValue(line);

    expect(tool.onMouseDown(pointer({ clientX: outInfo.x, clientY: outInfo.y }), env)).toBe(true);

    const handled = tool.onMouseUp(pointer({ clientX: inInfo.x, clientY: inInfo.y }), env);

    expect(handled).toBe(true);
    expect(line.getConnection().targetId).toBe(targetNode.id);
    expect(entityManagerMock.updateEntity).toHaveBeenCalled();
    expect(renderEventsMock.requestRenderEntities).toHaveBeenCalledTimes(2);
    expect(renderEventsMock.requestRenderEntities).toHaveBeenNthCalledWith(1, {
      entityIds: [line.id],
      reason: "connection-start",
    });
    expect(renderEventsMock.requestRenderEntities).toHaveBeenNthCalledWith(2, {
      entityIds: [line.id],
      reason: "connection-complete",
    });
  });

  test("cancels connection when mouse leaves canvas", () => {
    const definition: UMLPortDefinition = {
      name: "out",
      direction: "out",
      side: "right",
    };
    const info = portInfo(definition, { x: 120, y: 60 });
    const node = new TestNodeEntity([info], {
      x: 100,
      y: 40,
      width: 40,
      height: 40,
    });
    entityManagerMock.getEntities.mockReturnValue([node]);

    const line = new TestLineEntity({ x: info.x, y: info.y });
    entityManagerMock.createEntity.mockReturnValue(line);

    expect(tool.onMouseDown(pointer({ clientX: info.x, clientY: info.y }), env)).toBe(true);

    const handled = tool.onMouseLeave();

    expect(handled).toBe(true);
    expect(entityManagerMock.removeEntity).toHaveBeenCalledWith(line.id);
    expect(renderEventsMock.requestRenderEntities).toHaveBeenCalledTimes(2);
    expect(renderEventsMock.requestRenderEntities).toHaveBeenNthCalledWith(1, {
      entityIds: [line.id],
      reason: "connection-start",
    });
    expect(renderEventsMock.requestRenderEntities).toHaveBeenNthCalledWith(2, {
      entityIds: [line.id],
      op: "remove",
      reason: "connection-cancel",
    });
  });
});
