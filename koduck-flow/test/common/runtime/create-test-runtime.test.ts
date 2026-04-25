import { describe, test, expect, vi } from "vitest";

import { createTestRuntime } from "../../utils/runtime";
import type { EntityManager } from "../../../src/common/entity/entity-manager";
import type { RenderManager } from "../../../src/common/render/render-manager";
import type { RegistryManager } from "../../../src/common/registry/registry-manager";
import type { EventBus } from "../../../src/common/event/event-bus";

const createEntityManagerStub = () =>
  ({
    name: "EntityManager",
    type: "entity",
    dispose: vi.fn(),
    getEntities: vi.fn(() => []),
    getEntity: vi.fn(),
    createEntity: vi.fn(),
    removeEntity: vi.fn(),
    hasEntity: vi.fn(),
    updateEntity: vi.fn(),
    events: {
      fireAdd: vi.fn(),
      fireRemove: vi.fn(),
      fireUpdate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  } as unknown as EntityManager);

const createRenderManagerStub = () =>
  ({
    name: "RenderManager",
    type: "render",
    connectToEntityManager: vi.fn(),
    connectToRegistryManager: vi.fn(),
    addEntityToRender: vi.fn(),
    removeEntityFromRender: vi.fn(),
    render: vi.fn(() => null),
    dispose: vi.fn(),
  } as unknown as RenderManager);

const createRegistryManagerStub = () =>
  ({
    name: "RegistryManager",
    type: "registry",
    dispose: vi.fn(),
    getRegistry: vi.fn(),
    register: vi.fn(),
  } as unknown as RegistryManager);

const createEventBusStub = () =>
  ({
    dispose: vi.fn(),
    publish: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  } as unknown as EventBus);

describe("createTestRuntime", () => {
  test("applies overrides and disposes core managers", () => {
    const entityManagerStub = createEntityManagerStub();
    const renderManagerStub = createRenderManagerStub();
    const registryManagerStub = createRegistryManagerStub();
    const eventBusStub = createEventBusStub();

    const runtime = createTestRuntime({
      overrides: {
        entityManager: { instance: entityManagerStub },
        renderManager: { instance: renderManagerStub },
        registryManager: { instance: registryManagerStub },
        eventBus: { instance: eventBusStub },
      },
    });

    expect(runtime.EntityManager).toBe(entityManagerStub);
    expect(runtime.RenderManager).toBe(renderManagerStub);
    expect(runtime.RegistryManager).toBe(registryManagerStub);

    runtime.dispose();

    expect(renderManagerStub.dispose).toHaveBeenCalledTimes(1);
    expect(registryManagerStub.dispose).toHaveBeenCalledTimes(1);
    expect(entityManagerStub.dispose).not.toHaveBeenCalled();
  });

  test("allows parallel runtimes without cross-talk", () => {
    const entityManagerA = createEntityManagerStub();
    const entityManagerB = createEntityManagerStub();
    const renderManagerA = createRenderManagerStub();
    const renderManagerB = createRenderManagerStub();
    const registryManagerA = createRegistryManagerStub();
    const registryManagerB = createRegistryManagerStub();

    const runtimeA = createTestRuntime({
      overrides: {
        entityManager: { instance: entityManagerA },
        renderManager: { instance: renderManagerA },
        registryManager: { instance: registryManagerA },
        eventBus: { instance: createEventBusStub() },
      },
    });

    const runtimeB = createTestRuntime({
      overrides: {
        entityManager: { instance: entityManagerB },
        renderManager: { instance: renderManagerB },
        registryManager: { instance: registryManagerB },
        eventBus: { instance: createEventBusStub() },
      },
    });

    expect(runtimeA.EntityManager).toBe(entityManagerA);
    expect(runtimeB.EntityManager).toBe(entityManagerB);
    expect(runtimeA.RenderManager).toBe(renderManagerA);
    expect(runtimeB.RenderManager).toBe(renderManagerB);

    runtimeA.createEntity("uml-line-canvas");
    runtimeB.createEntity("uml-node-canvas");

    expect(entityManagerA.createEntity).toHaveBeenCalledTimes(1);
    expect(entityManagerB.createEntity).toHaveBeenCalledTimes(1);
    expect(entityManagerA.createEntity).toHaveBeenCalledWith(
      "uml-line-canvas",
      undefined
    );
    expect(entityManagerB.createEntity).toHaveBeenCalledWith(
      "uml-node-canvas",
      undefined
    );

    runtimeA.dispose();
    expect(renderManagerA.dispose).toHaveBeenCalledTimes(1);
    expect(renderManagerB.dispose).not.toHaveBeenCalled();

    runtimeB.dispose();
    expect(renderManagerB.dispose).toHaveBeenCalledTimes(1);
  });
});
