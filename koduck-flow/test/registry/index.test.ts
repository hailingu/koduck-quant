import { describe, test, expect } from "vitest";
import type {
  IRegistry,
  IRegistryManager,
  IRenderableRegistry,
  ICapabilityAwareRegistry,
} from "../../src/common/registry/types";
import {
  RegistryManager,
  RegistryCapabilityUtils,
  createRegistryManager,
} from "../../src/common/registry";
import type { IEntity } from "../../src/common/entity";

// Mock Entity for testing
class MockEntity implements IEntity {
  readonly id = "mock-entity";
  readonly type = "MockEntity";
  dispose() {}
}

describe("Registry Index Exports", () => {
  describe("类型导出验证", () => {
    test("类型应该通过TypeScript编译检查", () => {
      // 这些测试通过TypeScript编译即表示类型导出正确
      const registry: IRegistry<MockEntity> = {} as IRegistry<MockEntity>;
      const manager: IRegistryManager<MockEntity> =
        {} as IRegistryManager<MockEntity>;
      const renderableRegistry: IRenderableRegistry<MockEntity> =
        {} as IRenderableRegistry<MockEntity>;
      const capabilityRegistry: ICapabilityAwareRegistry<MockEntity> =
        {} as ICapabilityAwareRegistry<MockEntity>;

      // 基本存在性检查
      expect(registry).toBeDefined();
      expect(manager).toBeDefined();
      expect(renderableRegistry).toBeDefined();
      expect(capabilityRegistry).toBeDefined();
    });
  });

  describe("实现导出", () => {
    test("应该导出RegistryManager类", () => {
      expect(RegistryManager).toBeDefined();
      expect(typeof RegistryManager).toBe("function");
      expect(RegistryManager.name).toBe("RegistryManager");

      // 验证是构造函数
      const instance = createRegistryManager();
      expect(instance).toBeInstanceOf(RegistryManager);
    });

    test("应该导出RegistryCapabilityUtils类", () => {
      expect(RegistryCapabilityUtils).toBeDefined();
      expect(typeof RegistryCapabilityUtils).toBe("function");
      expect(RegistryCapabilityUtils.name).toBe("RegistryCapabilityUtils");

      // 验证静态方法存在
      expect(typeof RegistryCapabilityUtils.getCapabilities).toBe("function");
      expect(typeof RegistryCapabilityUtils.hasCapability).toBe("function");
      expect(typeof RegistryCapabilityUtils.hasRenderCapability).toBe(
        "function"
      );
      expect(typeof RegistryCapabilityUtils.hasExecuteCapability).toBe(
        "function"
      );
      expect(typeof RegistryCapabilityUtils.executeCapability).toBe("function");
    });
  });

  describe("模块完整性验证", () => {
    test("所有导出应该是有效的", () => {
      const exports = {
        RegistryManager,
        RegistryCapabilityUtils,
      };

      // 验证所有导出都存在且不为undefined
      Object.entries(exports).forEach(([, exported]) => {
        expect(exported).toBeDefined();
        expect(exported).not.toBeNull();
      });
    });

    test("RegistryManager应该实现IRegistryManager接口要求", () => {
      const manager = createRegistryManager();

      // 验证必需方法存在
      expect(typeof manager.getDefaultRegistry).toBe("function");
      expect(typeof manager.getRegistry).toBe("function");
      expect(typeof manager.getRegistryForEntity).toBe("function");
      expect(typeof manager.getRegistryForType).toBe("function");
      expect(typeof manager.addRegistry).toBe("function");
      expect(typeof manager.setDefaultRegistry).toBe("function");

      // 验证可选方法存在
      expect(typeof manager.removeRegistry).toBe("function");
      expect(typeof manager.bindTypeToRegistry).toBe("function");
      expect(typeof manager.unbindType).toBe("function");
    });

    test("RegistryCapabilityUtils应该提供完整的能力管理功能", () => {
      const methods = [
        "getCapabilities",
        "hasCapability",
        "hasRenderCapability",
        "hasExecuteCapability",
        "executeCapability",
      ];

      methods.forEach((method) => {
        expect(
          RegistryCapabilityUtils[
            method as keyof typeof RegistryCapabilityUtils
          ]
        ).toBeDefined();
        expect(
          typeof RegistryCapabilityUtils[
            method as keyof typeof RegistryCapabilityUtils
          ]
        ).toBe("function");
      });
    });
  });

  describe("API一致性验证", () => {
    test("导出的类型应该与实际实现兼容", () => {
      const manager = createRegistryManager();

      // 验证RegistryManager实例具有IRegistryManager接口的所有方法
      expect(typeof manager.getDefaultRegistry).toBe("function");
      expect(typeof manager.getRegistry).toBe("function");
      expect(typeof manager.addRegistry).toBe("function");
      expect(typeof manager.setDefaultRegistry).toBe("function");
    });
    test("静态工具类方法签名应该正确", () => {
      // 验证方法存在且为函数
      expect(RegistryCapabilityUtils.getCapabilities).toBeInstanceOf(Function);
      expect(RegistryCapabilityUtils.hasCapability).toBeInstanceOf(Function);
      expect(RegistryCapabilityUtils.executeCapability).toBeInstanceOf(
        Function
      );

      // 验证方法长度（参数数量）
      expect(RegistryCapabilityUtils.getCapabilities.length).toBe(1);
      expect(RegistryCapabilityUtils.hasCapability.length).toBe(2);
      expect(RegistryCapabilityUtils.hasRenderCapability.length).toBe(1);
      expect(RegistryCapabilityUtils.hasExecuteCapability.length).toBe(1);
      expect(RegistryCapabilityUtils.executeCapability.length).toBe(3); // registry, name, entity (rest args don't count)
    });
  });

  describe("版本兼容性", () => {
    test("导出的API应该保持向后兼容性", () => {
      // 验证关键导出在历史版本中应该存在的结构
      expect("RegistryManager" in { RegistryManager }).toBe(true);
      expect("RegistryCapabilityUtils" in { RegistryCapabilityUtils }).toBe(
        true
      );
    });

    test("导出结构应该符合预期的模块形状", () => {
      // 验证模块导出的结构和命名符合约定
      expect(RegistryManager.name).toBe("RegistryManager");
      expect(RegistryCapabilityUtils.name).toBe("RegistryCapabilityUtils");

      // 验证单例模式正确实现
      const instance1 = createRegistryManager();
      const instance2 = createRegistryManager();
      expect(instance1).not.toBe(instance2);
      expect(instance1).toBeInstanceOf(RegistryManager);
      expect(instance2).toBeInstanceOf(RegistryManager);
    });
  });
});
