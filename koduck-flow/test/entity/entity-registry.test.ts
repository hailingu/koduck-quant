/**
 * EntityRegistry unit tests
 * Tests entity registry registration, type management, schema validation, and other features
 */

import { describe, it, expect } from "vitest";
import { EntityRegistry } from "../../src/common/entity/entity-registry";
import { Entity } from "../../src/common/entity/entity";
import { Data } from "../../src/common/data";
import type { IEntity, IEntityArguments } from "../../src/common/entity/types";
import type { IMeta } from "../../src/common/registry/types";

// Test data type
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

// Test entity type
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
  // No explicit static type, should fallback to class name
}

// Entity with complex constructor arguments
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
  describe("Basic registry functionality", () => {
    it("should create a basic registry", () => {
      const registry = new EntityRegistry(TestEntity);

      expect(registry).toBeInstanceOf(EntityRegistry);
      expect(registry.entityConstructor).toBe(TestEntity);
      expect(registry.args).toBeUndefined();
    });

    it("should create a registry with arguments", () => {
      const args: IEntityArguments = { name: "test-entity" };
      const registry = new EntityRegistry(TestEntity, args);

      expect(registry.entityConstructor).toBe(TestEntity);
      expect(registry.args).toEqual(args);
    });

    it("should create a registry with metadata", () => {
      const meta: IMeta = {
        type: "CustomType",
        description: "Test entity registry",
        extras: { version: "1.0.0" },
      };
      const registry = new EntityRegistry(TestEntity, undefined, meta);

      expect(registry.meta?.type).toBe("CustomType");
      expect(registry.meta?.description).toBe("Test entity registry");
      expect(registry.meta?.extras?.version).toBe("1.0.0");
    });

    it("should create a fully configured registry", () => {
      const args: IEntityArguments = { name: "full-test" };
      const meta: IMeta = {
        type: "FullTestEntity",
        description: "Fully configured test entity",
      };

      const registry = new EntityRegistry(TestEntity, args, meta);

      expect(registry.entityConstructor).toBe(TestEntity);
      expect(registry.args).toEqual(args);
      expect(registry.meta?.type).toBe("FullTestEntity");
      expect(registry.meta?.description).toBe("Fully configured test entity");
    });
  });

  describe("Constructor retrieval", () => {
    it("should return the correct constructor", () => {
      const registry = new EntityRegistry(TestEntity);

      const Constructor = registry.getConstructor();

      expect(Constructor).toBe(TestEntity);
      expect(typeof Constructor).toBe("function");
    });

    it("should support different entity types", () => {
      const simpleRegistry = new EntityRegistry(SimpleEntity);
      const complexRegistry = new EntityRegistry(ComplexEntity);

      expect(simpleRegistry.getConstructor()).toBe(SimpleEntity);
      expect(complexRegistry.getConstructor()).toBe(ComplexEntity);
    });
  });

  describe("Instance creation", () => {
    it("should create an entity instance without arguments", () => {
      const registry = new EntityRegistry(TestEntity);

      const instance = registry.createInstance();

      expect(instance).toBeInstanceOf(TestEntity);
      expect(instance.type).toBe("TestEntity");
      expect(instance.id).toBeDefined();
    });

    it("should create an entity instance with default arguments", () => {
      const args: IEntityArguments = { name: "registry-test" };
      const registry = new EntityRegistry(TestEntity, args);

      const instance = registry.createInstance() as TestEntity;

      expect(instance).toBeInstanceOf(TestEntity);
      expect(instance.getName()).toBe("registry-test");
      expect(instance.config).toEqual(args);
    });

    it("should create an entity instance with complex arguments", () => {
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

    it("should create a new instance each time", () => {
      const registry = new EntityRegistry(TestEntity);

      const instance1 = registry.createInstance();
      const instance2 = registry.createInstance();

      expect(instance1).not.toBe(instance2);
      expect(instance1.id).not.toBe(instance2.id);
      expect(instance1).toBeInstanceOf(TestEntity);
      expect(instance2).toBeInstanceOf(TestEntity);
    });
  });

  describe("Metadata handling", () => {
    it("should auto-generate default metadata", () => {
      const registry = new EntityRegistry(TestEntity);

      expect(registry.meta?.type).toBe("TestEntity");
      expect(registry.meta?.description).toBe("Registry for TestEntity");
    });

    it("should use class name as fallback type", () => {
      const registry = new EntityRegistry(NamedEntity);

      expect(registry.meta?.type).toBe("NamedEntity");
      expect(registry.meta?.description).toBe("Registry for NamedEntity");
    });

    it("should merge user-provided metadata", () => {
      const customMeta: IMeta = {
        type: "TestEntity",
        description: "Custom description",
        extras: {
          version: "2.0.0",
          author: "Test user",
        },
      };

      const registry = new EntityRegistry(TestEntity, undefined, customMeta);

      expect(registry.meta?.type).toBe("TestEntity"); // Uses constructor type
      expect(registry.meta?.description).toBe("Custom description"); // Uses user-provided
      expect(registry.meta?.extras?.version).toBe("2.0.0");
      expect(registry.meta?.extras?.author).toBe("Test user");
    });

    it("should prioritize user-provided type", () => {
      const customMeta: IMeta = {
        type: "CustomTypeName",
        description: "Registry with custom type name",
      };

      const registry = new EntityRegistry(TestEntity, undefined, customMeta);

      expect(registry.meta?.type).toBe("CustomTypeName");
      expect(registry.meta?.description).toBe("Registry with custom type name");
    });
  });

  describe("IRegistry interface implementation", () => {
    it("should correctly implement the IRegistry interface", () => {
      const registry = new EntityRegistry(TestEntity);

      // Check required properties
      expect(registry).toHaveProperty("entityConstructor");
      expect(registry).toHaveProperty("args");
      expect(registry).toHaveProperty("meta");

      // Check required methods
      expect(typeof registry.getConstructor).toBe("function");
      expect(typeof registry.createInstance).toBe("function");
    });

    it("should work correctly with generic types", () => {
      const registry = new EntityRegistry(TestEntity);

      // TypeScript type checking - these should compile
      const Constructor = registry.getConstructor();
      const instance: IEntity = registry.createInstance();

      expect(Constructor).toBe(TestEntity);
      expect(instance).toBeInstanceOf(TestEntity);
    });
  });

  describe("Error handling and edge cases", () => {
    it("should handle entities without constructor arguments", () => {
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

    it("should handle empty argument objects", () => {
      const registry = new EntityRegistry(TestEntity, {});
      const instance = registry.createInstance();

      expect(instance).toBeInstanceOf(TestEntity);
      expect(instance.config).toEqual({});
    });

    it("should handle empty metadata objects", () => {
      const registry = new EntityRegistry(TestEntity, undefined, {
        type: "TestEntity",
      });

      expect(registry.meta?.type).toBe("TestEntity");
      expect(registry.meta?.description).toBe("Registry for TestEntity");
    });

    it("should handle complex inheritance chains", () => {
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

  describe("Real-world usage scenarios", () => {
    it("should support factory pattern creation", () => {
      const createButtonRegistry = (defaultText: string) => {
        return new EntityRegistry(
          TestEntity,
          { name: defaultText },
          { type: "Button", description: "Button entity" }
        );
      };

      const buttonRegistry = createButtonRegistry("Click me");
      const button = buttonRegistry.createInstance() as TestEntity;

      expect(button.getName()).toBe("Click me");
      expect(buttonRegistry.meta?.type).toBe("Button");
    });

    it("should support configuration templates", () => {
      const templates = {
        dialog: {
          args: { name: "dialog", modal: true },
          meta: { type: "Dialog", description: "Dialog entity" },
        },
        panel: {
          args: { name: "panel", resizable: true },
          meta: { type: "Panel", description: "Panel entity" },
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

    it("should support runtime type checking", () => {
      const registry = new EntityRegistry(TestEntity);
      const instance = registry.createInstance();

      // Simulate runtime type checking
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
