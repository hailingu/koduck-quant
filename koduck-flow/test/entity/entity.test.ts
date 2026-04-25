/**
 * Entity 核心类单元测试
 * 测试实体的创建、属性管理、生命周期等功能
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Entity } from "../../src/common/entity/entity";
import type { IEntity, IEntityArguments } from "../../src/common/entity/types";
import { Data } from "../../src/common/data";

// 测试用的数据类型
class TestData extends Data {
  name!: string;
  value!: number;
  nested?: {
    flag: boolean;
    items: string[];
  };

  constructor(data?: Partial<TestData>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }
}

// 测试用的配置类型
interface TestConfig extends IEntityArguments {
  debug?: boolean;
  theme?: string;
  options?: Record<string, unknown>;
}

// 测试用的自定义实体类
class TestEntity extends Entity<TestData, TestConfig> {
  static type = "TestEntity";

  constructor(config?: TestConfig) {
    super();
    this.config = config;
  }

  // 添加一些测试方法
  public getName(): string {
    return this.data?.name || "unknown";
  }

  public getValue(): number {
    return this.data?.value || 0;
  }

  public getTheme(): string {
    return this.config?.theme || "default";
  }
}

// 没有显式设置 type 的实体类
class UnnamedEntity extends Entity {
  // 没有设置 static type
}

describe("Entity", () => {
  let entity: Entity;

  beforeEach(() => {
    entity = new Entity();
  });

  describe("基础实体功能", () => {
    it("应该创建具有唯一ID的实体", () => {
      const entity1 = new Entity();
      const entity2 = new Entity();

      expect(entity1.id).toBeDefined();
      expect(entity2.id).toBeDefined();
      expect(entity1.id).not.toBe(entity2.id);
      expect(typeof entity1.id).toBe("string");
      expect(entity1.id.length).toBeGreaterThan(0);
    });

    it("应该正确报告实体类型", () => {
      const basicEntity = new Entity();
      const testEntity = new TestEntity();
      const unnamedEntity = new UnnamedEntity();

      expect(basicEntity.type).toBe("Entity");
      expect(testEntity.type).toBe("TestEntity");
      expect(unnamedEntity.type).toBe("UnnamedEntity");
    });

    it("应该实现 IEntity 接口", () => {
      const entity: IEntity = new Entity();

      expect(entity).toHaveProperty("id");
      expect(entity).toHaveProperty("data");
      expect(entity).toHaveProperty("config");
      expect(entity).toHaveProperty("type");
      expect(entity).toHaveProperty("dispose");
      expect(typeof entity.dispose).toBe("function");
    });

    it("应该正确报告是否已释放", () => {
      expect(entity.isDisposed).toBe(false);
      entity.dispose();
      expect(entity.isDisposed).toBe(true);
    });
  });

  describe("数据管理", () => {
    it("应该能设置和获取数据", () => {
      const testData = new TestData({
        name: "test",
        value: 42,
        nested: {
          flag: true,
          items: ["a", "b", "c"],
        },
      });

      entity.data = testData;
      expect(entity.data).toEqual(testData);
      expect(entity.data?.name).toBe("test");
      expect(entity.data?.value).toBe(42);
      expect((entity.data as TestData)?.nested?.flag).toBe(true);
    });

    it("应该能更新数据", () => {
      const initialData = new TestData({ name: "initial", value: 1 });
      const updatedData = new TestData({ name: "updated", value: 2 });

      entity.data = initialData;
      expect(entity.data).toEqual(initialData);

      entity.data = updatedData;
      expect(entity.data).toEqual(updatedData);
    });

    it("应该能清空数据", () => {
      const testData = new TestData({ name: "test", value: 42 });

      entity.data = testData;
      expect(entity.data).toEqual(testData);

      entity.data = undefined;
      expect(entity.data).toBeUndefined();
    });

    it("应该将 null 转换为 undefined", () => {
      const testData = new TestData({ name: "test", value: 42 });

      entity.data = testData;
      expect(entity.data).toEqual(testData);

      // @ts-expect-error 测试 null 处理
      entity.data = null;
      expect(entity.data).toBeUndefined();
    });

    it("释放后不应能设置数据", () => {
      const testData = new TestData({ name: "test", value: 42 });

      entity.dispose();
      entity.data = testData;

      expect(entity.data).toBeUndefined();
    });
  });

  describe("配置管理", () => {
    it("应该能设置和获取配置", () => {
      const testConfig: TestConfig = {
        debug: true,
        theme: "dark",
        options: {
          autoSave: true,
          timeout: 5000,
        },
      };

      entity.config = testConfig;
      expect(entity.config).toEqual(testConfig);
      expect(entity.config?.debug).toBe(true);
      expect(entity.config?.theme).toBe("dark");
    });

    it("应该能更新配置", () => {
      const initialConfig: TestConfig = { debug: false, theme: "light" };
      const updatedConfig: TestConfig = { debug: true, theme: "dark" };

      entity.config = initialConfig;
      expect(entity.config).toEqual(initialConfig);

      entity.config = updatedConfig;
      expect(entity.config).toEqual(updatedConfig);
    });

    it("应该能清空配置", () => {
      const testConfig: TestConfig = { debug: true, theme: "dark" };

      entity.config = testConfig;
      expect(entity.config).toEqual(testConfig);

      entity.config = undefined;
      expect(entity.config).toBeUndefined();
    });

    it("应该将 null 转换为 undefined", () => {
      const testConfig: TestConfig = { debug: true, theme: "dark" };

      entity.config = testConfig;
      expect(entity.config).toEqual(testConfig);

      // @ts-expect-error 测试 null 处理
      entity.config = null;
      expect(entity.config).toBeUndefined();
    });

    it("释放后不应能设置配置", () => {
      const testConfig: TestConfig = { debug: true, theme: "dark" };

      entity.dispose();
      entity.config = testConfig;

      expect(entity.config).toBeUndefined();
    });
  });

  describe("自定义实体功能", () => {
    let testEntity: TestEntity;

    beforeEach(() => {
      testEntity = new TestEntity({
        debug: true,
        theme: "custom",
      });
    });

    it("应该正确初始化自定义实体", () => {
      expect(testEntity.type).toBe("TestEntity");
      expect(testEntity.config?.debug).toBe(true);
      expect(testEntity.config?.theme).toBe("custom");
    });

    it("应该支持自定义方法", () => {
      // 未设置数据时的默认值
      expect(testEntity.getName()).toBe("unknown");
      expect(testEntity.getValue()).toBe(0);
      expect(testEntity.getTheme()).toBe("custom");

      // 设置数据后
      testEntity.data = new TestData({ name: "test-entity", value: 100 });
      expect(testEntity.getName()).toBe("test-entity");
      expect(testEntity.getValue()).toBe(100);
    });

    it("应该保持类型安全", () => {
      const data = new TestData({
        name: "typed-entity",
        value: 200,
        nested: {
          flag: false,
          items: ["x", "y", "z"],
        },
      });

      testEntity.data = data;

      expect(testEntity.data?.name).toBe("typed-entity");
      expect(testEntity.data?.value).toBe(200);
      expect(testEntity.data?.nested?.flag).toBe(false);
      expect(testEntity.data?.nested?.items).toEqual(["x", "y", "z"]);
    });
  });

  describe("生命周期管理", () => {
    it("应该正确初始化状态", () => {
      const newEntity = new Entity();

      expect(newEntity.isDisposed).toBe(false);
      expect(newEntity.id).toBeDefined();
      expect(newEntity.data).toBeUndefined();
      expect(newEntity.config).toBeUndefined();
    });

    it("应该正确处理释放操作", () => {
      const testData = new TestData({ name: "test", value: 42 });
      const testConfig: TestConfig = { debug: true };

      entity.data = testData;
      entity.config = testConfig;

      expect(entity.data).toEqual(testData);
      expect(entity.config).toEqual(testConfig);
      expect(entity.isDisposed).toBe(false);

      entity.dispose();

      expect(entity.data).toBeUndefined();
      expect(entity.config).toBeUndefined();
      expect(entity.isDisposed).toBe(true);
    });

    it("应该支持重复释放而不出错", () => {
      entity.dispose();
      expect(entity.isDisposed).toBe(true);

      // 重复释放不应该报错
      expect(() => entity.dispose()).not.toThrow();
      expect(entity.isDisposed).toBe(true);
    });

    it("释放后 ID 应该保持不变", () => {
      const originalId = entity.id;

      entity.dispose();

      expect(entity.id).toBe(originalId);
      expect(entity.isDisposed).toBe(true);
    });
  });

  describe("边界情况", () => {
    class SimpleData extends Data {
      value?: string;
      count?: number;
      enabled?: boolean;
      level1?: {
        level2?: {
          level3?: {
            deep?: string;
            array?: (number | { nested: boolean })[];
          };
        };
      };

      constructor(data?: Partial<SimpleData>) {
        super();
        if (data) {
          Object.assign(this, data);
        }
      }
    }

    it("应该处理空字符串数据", () => {
      const entity = new Entity<SimpleData>();

      entity.data = new SimpleData({ value: "" });
      expect(entity.data?.value).toBe("");
    });

    it("应该处理数字 0 值", () => {
      const entity = new Entity<SimpleData>();

      entity.data = new SimpleData({ count: 0 });
      expect(entity.data?.count).toBe(0);
    });

    it("应该处理布尔 false 值", () => {
      const entity = new Entity<SimpleData>();

      entity.data = new SimpleData({ enabled: false });
      expect(entity.data?.enabled).toBe(false);
    });

    it("应该处理复杂嵌套数据", () => {
      const complexData = new SimpleData({
        level1: {
          level2: {
            level3: {
              deep: "value",
              array: [1, 2, { nested: true }],
            },
          },
        },
      });

      entity.data = complexData;
      expect((entity.data as SimpleData)?.level1?.level2?.level3?.deep).toBe(
        "value"
      );
      expect(
        (entity.data as SimpleData)?.level1?.level2?.level3?.array?.[2]
      ).toEqual({
        nested: true,
      });
    });
  });

  describe("继承和多态", () => {
    class BaseData extends Data {
      base?: string;

      constructor(data?: Partial<BaseData>) {
        super();
        if (data) {
          Object.assign(this, data);
        }
      }
    }

    class BaseEntity extends Entity<BaseData> {
      static type = "BaseEntity";

      getBaseInfo(): string {
        return this.data?.base || "base";
      }
    }

    class DerivedEntity extends BaseEntity {
      static type = "DerivedEntity";

      getDerivedInfo(): string {
        return `derived-${this.getBaseInfo()}`;
      }
    }

    it("应该支持继承链", () => {
      const derived = new DerivedEntity();

      expect(derived.type).toBe("DerivedEntity");
      expect(derived.getBaseInfo()).toBe("base");
      expect(derived.getDerivedInfo()).toBe("derived-base");

      derived.data = new BaseData({ base: "test" });
      expect(derived.getBaseInfo()).toBe("test");
      expect(derived.getDerivedInfo()).toBe("derived-test");
    });

    it("应该支持多态性", () => {
      const entities: BaseEntity[] = [new BaseEntity(), new DerivedEntity()];

      expect(entities[0].type).toBe("BaseEntity");
      expect(entities[1].type).toBe("DerivedEntity");

      entities.forEach((entity) => {
        expect(typeof entity.getBaseInfo).toBe("function");
        expect(entity.getBaseInfo()).toBe("base");
      });
    });
  });
});
