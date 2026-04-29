import { describe, test, expect, beforeEach } from "vitest";
import { RegistryManager, createRegistryManager } from "../../src/common/registry/registry-manager";
import type { IRegistry } from "../../src/common/registry/types";
import type { IEntity } from "../../src/common/entity";

describe("RegistryManager", () => {
  let manager: RegistryManager;

  // Simple mock entity and registry
  class MockEntity implements IEntity {
    readonly id = "mock-entity";
    readonly type = "MockEntity";
    dispose() {}
  }

  const mockRegistry: IRegistry<MockEntity> = {
    meta: { type: "MockEntityRegistry" },
    getConstructor: () => MockEntity,
  };

  beforeEach(() => {
    manager = createRegistryManager();
  });

  test("addRegistry normal add", () => {
    manager.addRegistry("mock", mockRegistry);
    expect(manager.hasRegistry("mock")).toBe(true);
    expect(manager.getRegistry("mock")).toBe(mockRegistry);
  });

  test("addRegistry duplicate add with same name", () => {
    manager.addRegistry("mock", mockRegistry);
    // Adding same name again should be invalid
    manager.addRegistry("mock", mockRegistry);
    expect(manager.getRegistryNames().filter((n) => n === "mock").length).toBe(1);
  });

  test("addRegistry invalid name", () => {
    manager.addRegistry("", mockRegistry);
    expect(manager.hasRegistry("")).toBe(false);
  });

  test("addRegistry invalid registry", () => {
    // @ts-expect-error test invalid parameter
    manager.addRegistry("invalid", undefined);
    expect(manager.hasRegistry("invalid")).toBe(false);
  });

  test("setDefaultRegistry set and get default registry", () => {
    manager.addRegistry("mock", mockRegistry);
    manager.setDefaultRegistry("mock");
    expect(manager.getDefaultRegistry()).toBe(mockRegistry);
  });

  test("setDefaultRegistry set non-existent name", () => {
    manager.setDefaultRegistry("not-exist");
    expect(manager.getDefaultRegistry()).toBeUndefined();
  });

  test("removeRegistry normal remove", () => {
    manager.addRegistry("mock", mockRegistry);
    expect(manager.hasRegistry("mock")).toBe(true);
    manager.removeRegistry("mock");
    expect(manager.hasRegistry("mock")).toBe(false);
  });

  test("removeRegistry remove non-existent registry", () => {
    expect(manager.removeRegistry("not-exist")).toBe(false);
  });

  test("bindTypeToRegistry and getRegistryForType", () => {
    manager.addRegistry("mock", mockRegistry);
    manager.bindTypeToRegistry("MockEntity", "mock");
    expect(manager.getRegistryForType("MockEntity")).toBe(mockRegistry);
  });

  test("unbindType unbind type", () => {
    manager.addRegistry("mock", mockRegistry);
    manager.bindTypeToRegistry("MockEntity", "mock");
    manager.unbindType("MockEntity");
    expect(manager.getRegistryForType("MockEntity")).toBe(mockRegistry); // fallback to name
  });

  test("getRegistryForEntity find by type", () => {
    manager.addRegistry("mock", mockRegistry);
    const entity = new MockEntity();
    expect(manager.getRegistryForEntity(entity)).toBe(mockRegistry);
  });

  test("getRegistryForEntity fallback default", () => {
    manager.addRegistry("mock", mockRegistry);
    manager.setDefaultRegistry("mock");
    // Unbound type, return default
    expect(manager.getRegistryForEntity(null as unknown as IEntity)).toBe(mockRegistry);
  });

  test("getRegistryNames/getAllRegistries/getRegistryCount", () => {
    manager.addRegistry("mock", mockRegistry);
    expect(manager.getRegistryNames()).toContain("mock");
    expect(manager.getAllRegistries()).toContain(mockRegistry);
    expect(manager.getRegistryCount()).toBe(1);
  });

  test("getRegistryEntries return all entries", () => {
    manager.addRegistry("mock", mockRegistry);
    expect(manager.getRegistryEntries()).toEqual([["mock", mockRegistry]]);
  });

  test("clearRegistries clear all registries", () => {
    manager.addRegistry("mock", mockRegistry);
    manager.clearRegistries();
    // After optimization: clearRegistries truly clears everything
    expect(manager.getRegistryCount()).toBe(0);
  });

  test("dispose clean up all resources", () => {
    manager.addRegistry("mock", mockRegistry);
    manager.dispose();
    expect(manager.getRegistryCount()).toBe(0);
    expect(manager.getDefaultRegistry()).toBeUndefined();
  });

  test("meta property", () => {
    expect(manager.meta.type).toBe("RegistryManager");
    expect(manager.meta.description).toContain("Koduck Flow");
  });

  test("addPendingEntity/processPendingEntities", () => {
    const entity = new MockEntity();
    manager.addPendingEntity(entity);
    // After registry is added, pending entities should be processed
    manager.addRegistry("mock", mockRegistry);
    // pending entities should be cleared
    expect((manager as unknown as { _pendingEntities: Set<IEntity> })._pendingEntities.size).toBe(
      0
    );
  });
});
