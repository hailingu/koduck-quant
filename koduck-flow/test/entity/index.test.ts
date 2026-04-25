/**
 * Entity Index 模块导出测试
 * 验证模块导出的完整性和正确性
 */
import { describe, expect, it } from "vitest";

import {
  Entity,
  EntityManager,
  EntityRegistry,
  Data,
  createEntityManager,
} from "../../src/common/entity";
import type { IEntity } from "../../src/common/entity";
import {
  RegistryManager,
  createRegistryBroker,
  createRegistryManager,
} from "../../src/common/registry";
import { createEntityEventManager, createRenderEventManager } from "../../src/common/event";

class SampleData extends Data {
  constructor(public label: string = "sample") {
    super();
  }
}

class SampleEntity extends Entity<SampleData> {
  static readonly type = "SampleEntity";

  constructor() {
    super();
    this.data = new SampleData();
  }
}

describe("Entity module exports (DI)", () => {
  it("exposes expected symbols", () => {
    expect(Entity).toBeDefined();
    expect(EntityManager).toBeDefined();
    expect(EntityRegistry).toBeDefined();
    expect(RegistryManager).toBeDefined();
    expect(Data).toBeDefined();
    expect(createEntityManager).toBeTypeOf("function");
    expect(createRegistryManager).toBeTypeOf("function");
  });

  it("creates entity managers through factory APIs", () => {
    const registryBroker = createRegistryBroker();
    const registryManager = createRegistryManager({ registryBroker });
    const renderEvents = createRenderEventManager();
    const entityEvents = createEntityEventManager<IEntity>();

    const manager = createEntityManager({
      registryBroker,
      renderEvents,
      entityEvents,
    });

    registryBroker.registerRegistryManager(registryManager);

    const registry = new EntityRegistry(SampleEntity);
    registryManager.addRegistry(SampleEntity.type, registry);

    const entity = manager.createEntity(SampleEntity.type);

    expect(entity).toBeInstanceOf(SampleEntity);
    expect(manager.getEntities()).toHaveLength(1);
  });

  it("registry manager manages registries without singletons", () => {
    const registryBroker = createRegistryBroker();
    const registryManager = createRegistryManager({ registryBroker });
    registryBroker.registerRegistryManager(registryManager);
    const registry = new EntityRegistry(SampleEntity);

    expect(registryManager.getRegistryNames()).toHaveLength(0);

    registryManager.addRegistry("sample", registry);
    registryManager.setDefaultRegistry("sample");

    expect(registryManager.hasRegistry("sample")).toBe(true);
    expect(registryManager.getDefaultRegistry()).toBe(registry);
  });
});
