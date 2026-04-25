import { beforeEach, describe, expect, it, vi } from "vitest";
import { EntityManager, createEntityManager } from "../../src/common/entity/entity-manager";
import { EntityRegistry } from "../../src/common/entity/entity-registry";
import { Entity } from "../../src/common/entity/entity";
import { Data } from "../../src/common/data";
import type { IEntity, IEntityArguments } from "../../src/common/entity/types";
import type { EntityUpdateDetail } from "../../src/common/entity/update-detail";
import {
  createRenderEventManager,
  createEntityEventManager,
  type RenderEventManager,
  type EntityEventManager,
} from "../../src/common/event";
import {
  createRegistryBroker,
  createRegistryManager,
  type IRegistryBroker,
  type RegistryManager,
} from "../../src/common/registry";

class TestData extends Data {
  name?: string;
  value?: number;

  constructor(data?: Partial<TestData>) {
    super();
    Object.assign(this, data);
  }
}

class TestEntity extends Entity<TestData> {
  static readonly type = "TestEntity";

  constructor(args?: IEntityArguments) {
    super();
    this.data = new TestData({
      name: (args?.name as string) ?? "default",
      value: args?.value as number | undefined,
    });
  }
}

describe("EntityManager (DI)", () => {
  let registryManager: RegistryManager;
  let registryBroker: IRegistryBroker;
  let renderEvents: RenderEventManager;
  let entityEvents: EntityEventManager<IEntity>;
  let manager: EntityManager;

  beforeEach(() => {
    registryBroker = createRegistryBroker();
    registryManager = createRegistryManager({ registryBroker });
    renderEvents = createRenderEventManager();
    entityEvents = createEntityEventManager<IEntity>();
    manager = createEntityManager({
      registryBroker,
      renderEvents,
      entityEvents,
    });

    registryBroker.registerRegistryManager(registryManager);

    vi.spyOn(renderEvents, "requestRenderEntities");
  });

  function registerDefaultEntity(type = "test-entity", args?: IEntityArguments): void {
    const registry = new EntityRegistry(TestEntity, args);
    manager.registerEntityType(type, registry);
  }

  function createDefaultEntity(args?: IEntityArguments): TestEntity {
    if (!manager.hasEntityType("test-entity")) {
      registerDefaultEntity();
    }
    return manager.createEntity("test-entity", args) as TestEntity;
  }

  it("registers entity types through the registry manager", () => {
    registerDefaultEntity();

    expect(manager.hasEntityType("test-entity")).toBe(true);
    expect(manager.getEntityTypeRegistry("test-entity")).toBeInstanceOf(EntityRegistry);
    expect(manager.getAvailableTypes()).toContain("test-entity");
  });

  it("creates entities by type name and tracks them", () => {
    const addSpy = vi.fn();
    manager.events.onAdd(addSpy);

    const entity = createDefaultEntity({ name: "Alpha" });

    expect(entity).toBeInstanceOf(TestEntity);
    expect(entity.data?.name).toBe("Alpha");
    expect(manager.hasEntity(entity.id)).toBe(true);
    expect(addSpy).toHaveBeenCalledWith(entity);
    expect(renderEvents.requestRenderEntities).toHaveBeenLastCalledWith({
      entityIds: [entity.id],
      reason: "entity-created",
      op: "render",
    });
  });

  it("creates entities via registry instance", () => {
    const registry = new EntityRegistry(TestEntity, { name: "direct" });

    const entity = manager.createEntity(registry);

    expect(entity).toBeInstanceOf(TestEntity);
    expect(manager.getEntities()).toContain(entity);
  });

  it("returns null when creating unregistered type", () => {
    expect(manager.createEntity("unknown" as string)).toBeNull();
  });

  it("updates entities and emits detail payloads", () => {
    const entity = createDefaultEntity();
    const detail: EntityUpdateDetail = {
      changes: ["position"],
      prevBounds: undefined,
      nextBounds: undefined,
      renderHint: { level: "partial" },
    };
    const updateSpy = vi.fn();
    manager.events.onUpdateDetail(updateSpy);

    const result = manager.updateEntity(entity, detail);

    expect(result).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith({ entity, detail });
    expect(renderEvents.requestRenderEntities).toHaveBeenLastCalledWith({
      entityIds: [entity.id],
      reason: "entity-updated",
      op: "render",
    });
  });

  it("updates entities without detail and emits simple update", () => {
    const entity = createDefaultEntity();
    const updateSpy = vi.fn();
    manager.events.onUpdate(updateSpy);

    const result = manager.updateEntity(entity);

    expect(result).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith(entity);
    expect(renderEvents.requestRenderEntities).toHaveBeenLastCalledWith({
      entityIds: [entity.id],
      reason: "entity-updated",
      op: "render",
    });
  });

  it("supports batch updates with detail", () => {
    const first = createDefaultEntity({ name: "first" });
    const second = createDefaultEntity({ name: "second" });
    const detail: EntityUpdateDetail = {
      changes: ["style"],
      prevBounds: undefined,
      nextBounds: undefined,
      renderHint: { level: "full" },
    };
    const detailSpy = vi.fn();
    manager.events.onUpdateDetail(detailSpy);

    const count = manager.batchUpdateEntity([first, second], detail);

    expect(count).toBe(2);
    expect(detailSpy).toHaveBeenCalledTimes(2);
    expect(detailSpy).toHaveBeenCalledWith({ entity: first, detail });
    expect(detailSpy).toHaveBeenCalledWith({ entity: second, detail });
  });

  it("removes entities and fires render removal", () => {
    const entity = createDefaultEntity();
    const removeSpy = vi.fn();
    manager.events.onRemove(removeSpy);

    const removed = manager.removeEntity(entity.id);

    expect(removed).toBe(true);
    expect(manager.hasEntity(entity.id)).toBe(false);
    expect(removeSpy).toHaveBeenCalledWith(entity);
    expect(renderEvents.requestRenderEntities).toHaveBeenLastCalledWith({
      entityIds: [entity.id],
      reason: "entity-removed",
      op: "remove",
    });
  });

  it("removes multiple entities in batch and triggers removal render", () => {
    const first = createDefaultEntity();
    const second = createDefaultEntity();
    const removeSpy = vi.fn();
    manager.events.onRemove(removeSpy);

    const count = manager.removeEntities([first.id, second.id]);

    expect(count).toBe(2);
    expect(removeSpy).toHaveBeenCalledTimes(2);
    expect(renderEvents.requestRenderEntities).toHaveBeenLastCalledWith({
      entityIds: expect.arrayContaining([first.id, second.id]),
      reason: "entities-removed",
      op: "remove",
    });
  });

  it("removeAllEntities clears entities and emits", () => {
    createDefaultEntity();
    createDefaultEntity();

    const count = manager.removeAllEntities();

    expect(count).toBe(2);
    expect(manager.getEntities()).toHaveLength(0);
  });

  it("dispose clears entities and disposes events", () => {
    createDefaultEntity();
    const disposeSpy = vi.spyOn(entityEvents, "dispose");

    manager.dispose();

    expect(manager.getEntities()).toHaveLength(0);
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });

  it("handles invalid ids gracefully", () => {
    expect(manager.removeEntity("" as string)).toBe(false);
    expect(manager.getEntity("" as string)).toBeUndefined();
    expect(manager.getEntity("missing" as string)).toBeUndefined();
  });
});
