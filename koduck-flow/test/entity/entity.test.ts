/**
 * Entity core class unit tests
 * Tests entity creation, property management, lifecycle, and other features
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Entity } from "../../src/common/entity/entity";
import type { IEntity, IEntityArguments } from "../../src/common/entity/types";
import { Data } from "../../src/common/data";

// Test data type
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

// Test configuration type
interface TestConfig extends IEntityArguments {
  debug?: boolean;
  theme?: string;
  options?: Record<string, unknown>;
}

// Test custom entity class
class TestEntity extends Entity<TestData, TestConfig> {
  static type = "TestEntity";

  constructor(config?: TestConfig) {
    super();
    this.config = config;
  }

  // Add some test methods
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

// Entity class without explicit type
class UnnamedEntity extends Entity {
  // No static type set
}

describe("Entity", () => {
  let entity: Entity;

  beforeEach(() => {
    entity = new Entity();
  });

  describe("Basic entity functionality", () => {
    it("should create an entity with a unique ID", () => {
      const entity1 = new Entity();
      const entity2 = new Entity();

      expect(entity1.id).toBeDefined();
      expect(entity2.id).toBeDefined();
      expect(entity1.id).not.toBe(entity2.id);
      expect(typeof entity1.id).toBe("string");
      expect(entity1.id.length).toBeGreaterThan(0);
    });

    it("should correctly report the entity type", () => {
      const basicEntity = new Entity();
      const testEntity = new TestEntity();
      const unnamedEntity = new UnnamedEntity();

      expect(basicEntity.type).toBe("Entity");
      expect(testEntity.type).toBe("TestEntity");
      expect(unnamedEntity.type).toBe("UnnamedEntity");
    });

    it("should implement the IEntity interface", () => {
      const entity: IEntity = new Entity();

      expect(entity).toHaveProperty("id");
      expect(entity).toHaveProperty("data");
      expect(entity).toHaveProperty("config");
      expect(entity).toHaveProperty("type");
      expect(entity).toHaveProperty("dispose");
      expect(typeof entity.dispose).toBe("function");
    });

    it("should correctly report whether disposed", () => {
      expect(entity.isDisposed).toBe(false);
      entity.dispose();
      expect(entity.isDisposed).toBe(true);
    });
  });

  describe("Data management", () => {
    it("should be able to set and get data", () => {
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

    it("should be able to update data", () => {
      const initialData = new TestData({ name: "initial", value: 1 });
      const updatedData = new TestData({ name: "updated", value: 2 });

      entity.data = initialData;
      expect(entity.data).toEqual(initialData);

      entity.data = updatedData;
      expect(entity.data).toEqual(updatedData);
    });

    it("should be able to clear data", () => {
      const testData = new TestData({ name: "test", value: 42 });

      entity.data = testData;
      expect(entity.data).toEqual(testData);

      entity.data = undefined;
      expect(entity.data).toBeUndefined();
    });

    it("should convert null to undefined", () => {
      const testData = new TestData({ name: "test", value: 42 });

      entity.data = testData;
      expect(entity.data).toEqual(testData);

      // @ts-expect-error testing null handling
      entity.data = null;
      expect(entity.data).toBeUndefined();
    });

    it("should not be able to set data after disposal", () => {
      const testData = new TestData({ name: "test", value: 42 });

      entity.dispose();
      entity.data = testData;

      expect(entity.data).toBeUndefined();
    });
  });

  describe("Configuration management", () => {
    it("should be able to set and get configuration", () => {
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

    it("should be able to update configuration", () => {
      const initialConfig: TestConfig = { debug: false, theme: "light" };
      const updatedConfig: TestConfig = { debug: true, theme: "dark" };

      entity.config = initialConfig;
      expect(entity.config).toEqual(initialConfig);

      entity.config = updatedConfig;
      expect(entity.config).toEqual(updatedConfig);
    });

    it("should be able to clear configuration", () => {
      const testConfig: TestConfig = { debug: true, theme: "dark" };

      entity.config = testConfig;
      expect(entity.config).toEqual(testConfig);

      entity.config = undefined;
      expect(entity.config).toBeUndefined();
    });

    it("should convert null to undefined", () => {
      const testConfig: TestConfig = { debug: true, theme: "dark" };

      entity.config = testConfig;
      expect(entity.config).toEqual(testConfig);

      // @ts-expect-error testing null handling
      entity.config = null;
      expect(entity.config).toBeUndefined();
    });

    it("should not be able to set configuration after disposal", () => {
      const testConfig: TestConfig = { debug: true, theme: "dark" };

      entity.dispose();
      entity.config = testConfig;

      expect(entity.config).toBeUndefined();
    });
  });

  describe("Custom entity functionality", () => {
    let testEntity: TestEntity;

    beforeEach(() => {
      testEntity = new TestEntity({
        debug: true,
        theme: "custom",
      });
    });

    it("should correctly initialize custom entities", () => {
      expect(testEntity.type).toBe("TestEntity");
      expect(testEntity.config?.debug).toBe(true);
      expect(testEntity.config?.theme).toBe("custom");
    });

    it("should support custom methods", () => {
      // Default values when data is not set
      expect(testEntity.getName()).toBe("unknown");
      expect(testEntity.getValue()).toBe(0);
      expect(testEntity.getTheme()).toBe("custom");

      // After setting data
      testEntity.data = new TestData({ name: "test-entity", value: 100 });
      expect(testEntity.getName()).toBe("test-entity");
      expect(testEntity.getValue()).toBe(100);
    });

    it("should maintain type safety", () => {
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

  describe("Lifecycle management", () => {
    it("should correctly initialize state", () => {
      const newEntity = new Entity();

      expect(newEntity.isDisposed).toBe(false);
      expect(newEntity.id).toBeDefined();
      expect(newEntity.data).toBeUndefined();
      expect(newEntity.config).toBeUndefined();
    });

    it("should correctly handle disposal", () => {
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

    it("should support repeated disposal without errors", () => {
      entity.dispose();
      expect(entity.isDisposed).toBe(true);

      // Repeated disposal should not throw
      expect(() => entity.dispose()).not.toThrow();
      expect(entity.isDisposed).toBe(true);
    });

    it("ID should remain unchanged after disposal", () => {
      const originalId = entity.id;

      entity.dispose();

      expect(entity.id).toBe(originalId);
      expect(entity.isDisposed).toBe(true);
    });
  });

  describe("Edge cases", () => {
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

    it("should handle empty string data", () => {
      const entity = new Entity<SimpleData>();

      entity.data = new SimpleData({ value: "" });
      expect(entity.data?.value).toBe("");
    });

    it("should handle numeric 0 value", () => {
      const entity = new Entity<SimpleData>();

      entity.data = new SimpleData({ count: 0 });
      expect(entity.data?.count).toBe(0);
    });

    it("should handle boolean false value", () => {
      const entity = new Entity<SimpleData>();

      entity.data = new SimpleData({ enabled: false });
      expect(entity.data?.enabled).toBe(false);
    });

    it("should handle complex nested data", () => {
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

  describe("Inheritance and polymorphism", () => {
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

    it("should support inheritance chains", () => {
      const derived = new DerivedEntity();

      expect(derived.type).toBe("DerivedEntity");
      expect(derived.getBaseInfo()).toBe("base");
      expect(derived.getDerivedInfo()).toBe("derived-base");

      derived.data = new BaseData({ base: "test" });
      expect(derived.getBaseInfo()).toBe("test");
      expect(derived.getDerivedInfo()).toBe("derived-test");
    });

    it("should support polymorphism", () => {
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
