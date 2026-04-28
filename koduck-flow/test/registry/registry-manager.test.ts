import { describe, test, expect, beforeEach } from "vitest";
import { RegistryManager, createRegistryManager } from "../../src/common/registry/registry-manager";
import type { IRegistry } from "../../src/common/registry/types";
import type { IEntity } from "../../src/common/entity";

describe("RegistryManager", () => {
  let manager: RegistryManager;

  // 简单Mock实体和注册表
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

  test("addRegistry 正常添加", () => {
    manager.addRegistry("mock", mockRegistry);
    expect(manager.hasRegistry("mock")).toBe(true);
    expect(manager.getRegistry("mock")).toBe(mockRegistry);
  });

  test("addRegistry 重复添加同名注册表", () => {
    manager.addRegistry("mock", mockRegistry);
    // 再次添加同名应无效
    manager.addRegistry("mock", mockRegistry);
    expect(manager.getRegistryNames().filter((n) => n === "mock").length).toBe(1);
  });

  test("addRegistry 无效名称", () => {
    manager.addRegistry("", mockRegistry);
    expect(manager.hasRegistry("")).toBe(false);
  });

  test("addRegistry 无效注册表", () => {
    // @ts-expect-error 测试无效参数
    manager.addRegistry("invalid", undefined);
    expect(manager.hasRegistry("invalid")).toBe(false);
  });

  test("setDefaultRegistry 设置和获取默认注册表", () => {
    manager.addRegistry("mock", mockRegistry);
    manager.setDefaultRegistry("mock");
    expect(manager.getDefaultRegistry()).toBe(mockRegistry);
  });

  test("setDefaultRegistry 设置不存在的名称", () => {
    manager.setDefaultRegistry("not-exist");
    expect(manager.getDefaultRegistry()).toBeUndefined();
  });

  test("removeRegistry 正常移除", () => {
    manager.addRegistry("mock", mockRegistry);
    expect(manager.hasRegistry("mock")).toBe(true);
    manager.removeRegistry("mock");
    expect(manager.hasRegistry("mock")).toBe(false);
  });

  test("removeRegistry 移除不存在的注册表", () => {
    expect(manager.removeRegistry("not-exist")).toBe(false);
  });

  test("bindTypeToRegistry 和 getRegistryForType", () => {
    manager.addRegistry("mock", mockRegistry);
    manager.bindTypeToRegistry("MockEntity", "mock");
    expect(manager.getRegistryForType("MockEntity")).toBe(mockRegistry);
  });

  test("unbindType 解绑类型", () => {
    manager.addRegistry("mock", mockRegistry);
    manager.bindTypeToRegistry("MockEntity", "mock");
    manager.unbindType("MockEntity");
    expect(manager.getRegistryForType("MockEntity")).toBe(mockRegistry); // fallback到名称
  });

  test("getRegistryForEntity 按类型查找", () => {
    manager.addRegistry("mock", mockRegistry);
    const entity = new MockEntity();
    expect(manager.getRegistryForEntity(entity)).toBe(mockRegistry);
  });

  test("getRegistryForEntity fallback 默认", () => {
    manager.addRegistry("mock", mockRegistry);
    manager.setDefaultRegistry("mock");
    // 未绑定类型，返回默认
    expect(manager.getRegistryForEntity(null as unknown as IEntity)).toBe(mockRegistry);
  });

  test("getRegistryNames/getAllRegistries/getRegistryCount", () => {
    manager.addRegistry("mock", mockRegistry);
    expect(manager.getRegistryNames()).toContain("mock");
    expect(manager.getAllRegistries()).toContain(mockRegistry);
    expect(manager.getRegistryCount()).toBe(1);
  });

  test("getRegistryEntries 返回所有条目", () => {
    manager.addRegistry("mock", mockRegistry);
    expect(manager.getRegistryEntries()).toEqual([["mock", mockRegistry]]);
  });

  test("clearRegistries 清空所有注册表", () => {
    manager.addRegistry("mock", mockRegistry);
    manager.clearRegistries();
    // After optimization: clearRegistries truly clears everything
    expect(manager.getRegistryCount()).toBe(0);
  });

  test("dispose 清理所有资源", () => {
    manager.addRegistry("mock", mockRegistry);
    manager.dispose();
    expect(manager.getRegistryCount()).toBe(0);
    expect(manager.getDefaultRegistry()).toBeUndefined();
  });

  test("meta 属性", () => {
    expect(manager.meta.type).toBe("RegistryManager");
    expect(manager.meta.description).toContain("Koduck Flow");
  });

  test("addPendingEntity/processPendingEntities", () => {
    const entity = new MockEntity();
    manager.addPendingEntity(entity);
    // 注册表添加后应处理pending实体
    manager.addRegistry("mock", mockRegistry);
    // pending实体应被清空
    expect((manager as unknown as { _pendingEntities: Set<IEntity> })._pendingEntities.size).toBe(
      0
    );
  });
});
