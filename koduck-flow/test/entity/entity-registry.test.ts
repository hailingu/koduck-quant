/**
 * EntityRegistry 单元测试
 * 测试实体注册表的注册、类型管理、模式验证等功能
 */

import { describe, it, expect } from "vitest";
import { EntityRegistry } from "../../src/common/entity/entity-registry";
import { Entity } from "../../src/common/entity/entity";
import { Data } from "../../src/common/data";
import type { IEntity, IEntityArguments } from "../../src/common/entity/types";
import type { IMeta } from "../../src/common/registry/types";

// 测试用的数据类型
class TestData extends Data {
  name?: string;
  value?: number;

  constructor(data?: Partial<TestData>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }
}

// 测试用的实体类型
class TestEntity extends Entity<TestData> {
  static type = "TestEntity";

  constructor(args?: IEntityArguments) {
    super();
    if (args) {
      this.config = args;
      if (args.name) {
        this.data = new TestData({ name: args.name as string });
      }
    }
  }

  public getName(): string {
    return this.data?.name || "default";
  }
}

class SimpleEntity extends Entity {
  static type = "SimpleEntity";
}

class NamedEntity extends Entity {
  // 没有显式的 static type，应该使用类名
}

// 带复杂构造参数的实体
interface ComplexArgs extends IEntityArguments {
  title?: string;
  count?: number;
  options?: {
    enabled: boolean;
    theme: string;
  };
}

class ComplexEntity extends Entity<TestData, ComplexArgs> {
  static type = "ComplexEntity";

  constructor(args?: ComplexArgs) {
    super();
    if (args) {
      this.config = args;
      this.data = new TestData({
        name: args.title || "complex",
        value: args.count || 0,
      });
    }
  }
}

describe("EntityRegistry", () => {
  describe("基础注册表功能", () => {
    it("应该能创建基础注册表", () => {
      const registry = new EntityRegistry(TestEntity);

      expect(registry).toBeInstanceOf(EntityRegistry);
      expect(registry.entityConstructor).toBe(TestEntity);
      expect(registry.args).toBeUndefined();
    });

    it("应该能创建带参数的注册表", () => {
      const args: IEntityArguments = { name: "test-entity" };
      const registry = new EntityRegistry(TestEntity, args);

      expect(registry.entityConstructor).toBe(TestEntity);
      expect(registry.args).toEqual(args);
    });

    it("应该能创建带元信息的注册表", () => {
      const meta: IMeta = {
        type: "CustomType",
        description: "测试实体注册表",
        extras: { version: "1.0.0" },
      };
      const registry = new EntityRegistry(TestEntity, undefined, meta);

      expect(registry.meta?.type).toBe("CustomType");
      expect(registry.meta?.description).toBe("测试实体注册表");
      expect(registry.meta?.extras?.version).toBe("1.0.0");
    });

    it("应该能创建完整配置的注册表", () => {
      const args: IEntityArguments = { name: "full-test" };
      const meta: IMeta = {
        type: "FullTestEntity",
        description: "完整配置的测试实体",
      };

      const registry = new EntityRegistry(TestEntity, args, meta);

      expect(registry.entityConstructor).toBe(TestEntity);
      expect(registry.args).toEqual(args);
      expect(registry.meta?.type).toBe("FullTestEntity");
      expect(registry.meta?.description).toBe("完整配置的测试实体");
    });
  });

  describe("构造函数获取", () => {
    it("应该返回正确的构造函数", () => {
      const registry = new EntityRegistry(TestEntity);

      const Constructor = registry.getConstructor();

      expect(Constructor).toBe(TestEntity);
      expect(typeof Constructor).toBe("function");
    });

    it("应该支持不同的实体类型", () => {
      const simpleRegistry = new EntityRegistry(SimpleEntity);
      const complexRegistry = new EntityRegistry(ComplexEntity);

      expect(simpleRegistry.getConstructor()).toBe(SimpleEntity);
      expect(complexRegistry.getConstructor()).toBe(ComplexEntity);
    });
  });

  describe("实例创建", () => {
    it("应该能创建无参数的实体实例", () => {
      const registry = new EntityRegistry(TestEntity);

      const instance = registry.createInstance();

      expect(instance).toBeInstanceOf(TestEntity);
      expect(instance.type).toBe("TestEntity");
      expect(instance.id).toBeDefined();
    });

    it("应该能创建带默认参数的实体实例", () => {
      const args: IEntityArguments = { name: "registry-test" };
      const registry = new EntityRegistry(TestEntity, args);

      const instance = registry.createInstance() as TestEntity;

      expect(instance).toBeInstanceOf(TestEntity);
      expect(instance.getName()).toBe("registry-test");
      expect(instance.config).toEqual(args);
    });

    it("应该能创建复杂参数的实体实例", () => {
      const args: ComplexArgs = {
        title: "complex-test",
        count: 42,
        options: {
          enabled: true,
          theme: "dark",
        },
      };

      const registry = new EntityRegistry(ComplexEntity, args);
      const instance = registry.createInstance() as ComplexEntity;

      expect(instance).toBeInstanceOf(ComplexEntity);
      expect(instance.config?.title).toBe("complex-test");
      expect(instance.config?.count).toBe(42);
      expect(instance.config?.options?.enabled).toBe(true);
      expect(instance.data?.name).toBe("complex-test");
      expect(instance.data?.value).toBe(42);
    });

    it("应该每次创建新的实例", () => {
      const registry = new EntityRegistry(TestEntity);

      const instance1 = registry.createInstance();
      const instance2 = registry.createInstance();

      expect(instance1).not.toBe(instance2);
      expect(instance1.id).not.toBe(instance2.id);
      expect(instance1).toBeInstanceOf(TestEntity);
      expect(instance2).toBeInstanceOf(TestEntity);
    });
  });

  describe("元信息处理", () => {
    it("应该自动生成默认元信息", () => {
      const registry = new EntityRegistry(TestEntity);

      expect(registry.meta?.type).toBe("TestEntity");
      expect(registry.meta?.description).toBe("Registry for TestEntity");
    });

    it("应该使用类名作为后备类型", () => {
      const registry = new EntityRegistry(NamedEntity);

      expect(registry.meta?.type).toBe("NamedEntity");
      expect(registry.meta?.description).toBe("Registry for NamedEntity");
    });

    it("应该合并用户提供的元信息", () => {
      const customMeta: IMeta = {
        type: "TestEntity",
        description: "自定义描述",
        extras: {
          version: "2.0.0",
          author: "测试用户",
        },
      };

      const registry = new EntityRegistry(TestEntity, undefined, customMeta);

      expect(registry.meta?.type).toBe("TestEntity"); // 使用构造函数的 type
      expect(registry.meta?.description).toBe("自定义描述"); // 使用用户提供的
      expect(registry.meta?.extras?.version).toBe("2.0.0");
      expect(registry.meta?.extras?.author).toBe("测试用户");
    });

    it("应该优先使用用户提供的类型", () => {
      const customMeta: IMeta = {
        type: "CustomTypeName",
        description: "带自定义类型名的注册表",
      };

      const registry = new EntityRegistry(TestEntity, undefined, customMeta);

      expect(registry.meta?.type).toBe("CustomTypeName");
      expect(registry.meta?.description).toBe("带自定义类型名的注册表");
    });
  });

  describe("IRegistry 接口实现", () => {
    it("应该正确实现 IRegistry 接口", () => {
      const registry = new EntityRegistry(TestEntity);

      // 检查必需的属性
      expect(registry).toHaveProperty("entityConstructor");
      expect(registry).toHaveProperty("args");
      expect(registry).toHaveProperty("meta");

      // 检查必需的方法
      expect(typeof registry.getConstructor).toBe("function");
      expect(typeof registry.createInstance).toBe("function");
    });

    it("应该与泛型类型正确配合", () => {
      const registry = new EntityRegistry(TestEntity);

      // TypeScript 类型检查 - 这些应该编译通过
      const Constructor = registry.getConstructor();
      const instance: IEntity = registry.createInstance();

      expect(Constructor).toBe(TestEntity);
      expect(instance).toBeInstanceOf(TestEntity);
    });
  });

  describe("错误处理和边界情况", () => {
    it("应该处理无构造参数的实体", () => {
      class NoArgsEntity extends Entity {
        constructor() {
          super();
        }
      }

      const registry = new EntityRegistry(NoArgsEntity);
      const instance = registry.createInstance();

      expect(instance).toBeInstanceOf(NoArgsEntity);
      expect(instance.config).toBeUndefined();
    });

    it("应该处理空的参数对象", () => {
      const registry = new EntityRegistry(TestEntity, {});
      const instance = registry.createInstance();

      expect(instance).toBeInstanceOf(TestEntity);
      expect(instance.config).toEqual({});
    });

    it("应该处理空的元信息对象", () => {
      const registry = new EntityRegistry(TestEntity, undefined, {
        type: "TestEntity",
      });

      expect(registry.meta?.type).toBe("TestEntity");
      expect(registry.meta?.description).toBe("Registry for TestEntity");
    });

    it("应该处理复杂的继承链", () => {
      class BaseEntity extends Entity {
        static type = "BaseEntity";
      }

      class DerivedEntity extends BaseEntity {
        static type = "DerivedEntity";
      }

      const registry = new EntityRegistry(DerivedEntity);
      const instance = registry.createInstance();

      expect(instance).toBeInstanceOf(DerivedEntity);
      expect(instance).toBeInstanceOf(BaseEntity);
      expect(instance.type).toBe("DerivedEntity");
      expect(registry.meta?.type).toBe("DerivedEntity");
    });
  });

  describe("实际使用场景", () => {
    it("应该支持工厂模式创建", () => {
      const createButtonRegistry = (defaultText: string) => {
        return new EntityRegistry(
          TestEntity,
          { name: defaultText },
          { type: "Button", description: "按钮实体" }
        );
      };

      const buttonRegistry = createButtonRegistry("点击我");
      const button = buttonRegistry.createInstance() as TestEntity;

      expect(button.getName()).toBe("点击我");
      expect(buttonRegistry.meta?.type).toBe("Button");
    });

    it("应该支持配置模板", () => {
      const templates = {
        dialog: {
          args: { name: "dialog", modal: true },
          meta: { type: "Dialog", description: "对话框实体" },
        },
        panel: {
          args: { name: "panel", resizable: true },
          meta: { type: "Panel", description: "面板实体" },
        },
      };

      const dialogRegistry = new EntityRegistry(
        TestEntity,
        templates.dialog.args,
        templates.dialog.meta
      );

      const panelRegistry = new EntityRegistry(
        TestEntity,
        templates.panel.args,
        templates.panel.meta
      );

      const dialog = dialogRegistry.createInstance() as TestEntity;
      const panel = panelRegistry.createInstance() as TestEntity;

      expect(dialog.getName()).toBe("dialog");
      expect(panel.getName()).toBe("panel");
      expect(dialogRegistry.meta?.type).toBe("Dialog");
      expect(panelRegistry.meta?.type).toBe("Panel");
    });

    it("应该支持运行时类型检查", () => {
      const registry = new EntityRegistry(TestEntity);
      const instance = registry.createInstance();

      // 模拟运行时类型检查
      const checkEntityType = (
        entity: IEntity,
        expectedType: string
      ): boolean => {
        return entity.type === expectedType;
      };

      expect(checkEntityType(instance, "TestEntity")).toBe(true);
      expect(checkEntityType(instance, "WrongType")).toBe(false);
    });
  });
});
