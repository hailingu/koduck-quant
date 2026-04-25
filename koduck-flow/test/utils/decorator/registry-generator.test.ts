import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DynamicRegistryGenerator } from "../../../src/utils/decorator/registry-generator";
import type {
  IEntity,
  IEntityConstructor,
  IEntityArguments,
} from "../../../src/common/entity/types";
import type { ICapabilityAwareRegistry } from "../../../src/common/registry/types";
import type { Data } from "../../../src/common/data";

const { mockDetectCapabilities, mockCapabilityDetector, MockCapabilityDetector } = vi.hoisted(
  () => {
    const mockDetectCapabilities = vi.fn().mockReturnValue(["render", "execute"]);
    const mockCapabilityDetector = {
      detectCapabilities: mockDetectCapabilities,
    };
    const MockCapabilityDetector = vi.fn().mockImplementation(() => mockCapabilityDetector);

    return { mockDetectCapabilities, mockCapabilityDetector, MockCapabilityDetector };
  }
);

vi.mock("../../../src/utils/decorator/capability-detector", () => ({
  DefaultCapabilityDetector: MockCapabilityDetector,
}));
vi.mock("../../../src/common/logger", () => {
  const info = vi.fn();
  const debug = vi.fn();
  const warn = vi.fn();
  const error = vi.fn();
  const time = vi.fn();
  const timeEnd = vi.fn();

  const createMockLoggerAdapter = () => ({
    debug,
    info,
    warn,
    error,
    time,
    timeEnd,
  });

  return {
    logger: {
      info,
      debug,
      warn,
      error,
      withContext: vi.fn(() => createMockLoggerAdapter()),
      child: vi.fn(() => createMockLoggerAdapter()),
    },
  };
});

// Mock the static capabilityDetector property
Object.defineProperty(DynamicRegistryGenerator, "capabilityDetector", {
  value: mockCapabilityDetector,
  writable: true,
});

// Mock entity classes for testing
class MockEntity implements IEntity {
  readonly id: string;
  readonly type: string;
  data: Data | undefined;
  config: IEntityArguments | undefined;
  [key: string]: unknown; // Allow additional properties

  constructor(args: IEntityArguments = {}) {
    const argsRecord = args as Record<string, unknown>;
    this.id = (argsRecord.id as string) || "mock-entity";
    this.type = (argsRecord.type as string) || "MockEntity";
    this.data = (argsRecord.data as Data | undefined) ?? undefined;
    this.config = args;

    // Copy all other properties from args
    Object.assign(this, argsRecord);
  }

  dispose(): void {
    // Mock dispose
  }

  // Mock capabilities
  render(): string {
    return "rendered";
  }

  canRender(): boolean {
    return true;
  }

  execute(): string {
    return "executed";
  }

  canExecute(): boolean {
    return true;
  }

  serialize(): string {
    return "serialized";
  }

  toJSON(): Record<string, unknown> {
    return { id: this.id, type: this.type };
  }
}

class MockEntityWithType extends MockEntity {
  static type = "CustomMockEntity";
}

const InvalidEntity = {
  // Invalid entity - not a constructor function
  someProperty: "value",
};

// Define interface for generated registry to avoid using 'any'
interface TestRegistry extends ICapabilityAwareRegistry<MockEntity> {
  createEntityWithParams(
    nodeType?: string,
    position?: { x: number; y: number },
    overrides?: Record<string, unknown>
  ): MockEntity;
  checkCapabilities(entity: MockEntity, capabilityNames: string[]): boolean[];
  executeCapabilities(
    entity: MockEntity,
    operations: Array<{ capability: string; args: unknown[] }>
  ): Promise<unknown[]>;
}

describe("DynamicRegistryGenerator", () => {
  beforeEach(() => {
    // Clear cache before each test
    DynamicRegistryGenerator.clearCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("generateRegistry", () => {
    it("should generate a registry class for a valid entity", () => {
      const RegistryClass = DynamicRegistryGenerator.generateRegistry(MockEntity);

      expect(RegistryClass).toBeDefined();
      expect(typeof RegistryClass).toBe("function");

      expect(mockDetectCapabilities).toHaveBeenCalledWith(MockEntity.prototype);

      // Should be able to instantiate
      const registry = new RegistryClass(MockEntity);
      expect(registry).toBeInstanceOf(RegistryClass);
    });

    it("should generate registry with custom options", () => {
      const options = {
        capabilities: ["customCapability"],
        priority: 10,
        meta: { customMeta: "value" },
        enableCapabilityDetection: false,
      };

      const RegistryClass = DynamicRegistryGenerator.generateRegistry(MockEntity, options);

      expect(RegistryClass).toBeDefined();
      const registry = new RegistryClass(MockEntity);
      expect(registry).toBeDefined();
    });

    it("should cache generated registries", () => {
      const RegistryClass1 = DynamicRegistryGenerator.generateRegistry(MockEntity);
      const RegistryClass2 = DynamicRegistryGenerator.generateRegistry(MockEntity);

      // Should return the same class
      expect(RegistryClass1).toBe(RegistryClass2);
    });

    it("should generate different registries for different entity classes", () => {
      const RegistryClass1 = DynamicRegistryGenerator.generateRegistry(MockEntity);
      const RegistryClass2 = DynamicRegistryGenerator.generateRegistry(MockEntityWithType);

      // Should be different classes
      expect(RegistryClass1).not.toBe(RegistryClass2);
    });

    it("should handle entity class with static type property", () => {
      const RegistryClass = DynamicRegistryGenerator.generateRegistry(MockEntityWithType);

      expect(RegistryClass).toBeDefined();
      const registry = new RegistryClass(MockEntityWithType);
      expect(registry).toBeDefined();
    });
  });

  describe("Generated Registry Functionality", () => {
    let RegistryClass: new (entityConstructor: IEntityConstructor<MockEntity>) => TestRegistry;
    let registry: TestRegistry;

    beforeEach(() => {
      RegistryClass = DynamicRegistryGenerator.generateRegistry(MockEntity) as new (
        entityConstructor: IEntityConstructor<MockEntity>
      ) => TestRegistry;
      registry = new RegistryClass(MockEntity);
    });

    describe("createEntity", () => {
      it("should create entity instance", () => {
        const entity = registry.createEntity();

        expect(entity).toBeInstanceOf(MockEntity);
        expect(entity.id).toBe("mock-entity");
        expect(entity.type).toBe("MockEntity");
      });

      it("should create entity with arguments", () => {
        const args = { id: "custom-id", type: "CustomType" };
        const entity = registry.createEntity(args);

        expect(entity).toBeInstanceOf(MockEntity);
        expect(entity.id).toBe("custom-id");
        expect(entity.type).toBe("CustomType");
      });
    });

    describe("createEntityWithParams", () => {
      it("should create entity with node type", () => {
        const entity = registry.createEntityWithParams("nodeType");

        expect(entity).toBeInstanceOf(MockEntity);
        expect(entity.type).toBe("nodeType");
      });

      it("should create entity with position", () => {
        const entity = registry.createEntityWithParams(undefined, {
          x: 10,
          y: 20,
        });

        expect(entity).toBeInstanceOf(MockEntity);
        // Position properties are added to the entity args
        expect((entity as MockEntity & { x: number; y: number }).x).toBe(10);
        expect((entity as MockEntity & { x: number; y: number }).y).toBe(20);
      });

      it("should create entity with overrides", () => {
        const overrides = { customProp: "value" };
        const entity = registry.createEntityWithParams(undefined, undefined, overrides);

        expect(entity).toBeInstanceOf(MockEntity);
        expect((entity as MockEntity & { customProp: string }).customProp).toBe("value");
      });
    });

    describe("checkCapabilities", () => {
      it("should check capabilities for entity", () => {
        const entity = new MockEntity();

        // Mock hasCapability to return true for render
        vi.spyOn(registry, "hasCapability").mockReturnValue(true);
        vi.spyOn(
          registry as TestRegistry & {
            entityHasCapability: (entity: MockEntity, capability: string) => boolean;
          },
          "entityHasCapability"
        ).mockReturnValue(true);

        const results = registry.checkCapabilities(entity, ["render"]);

        expect(results).toEqual([true]);
      });

      it("should return false for non-existent capabilities", () => {
        const entity = new MockEntity();

        vi.spyOn(registry, "hasCapability").mockReturnValue(false);

        const results = registry.checkCapabilities(entity, ["nonExistent"]);

        expect(results).toEqual([false]);
      });
    });

    describe("executeCapabilities", () => {
      it("should execute multiple capabilities", async () => {
        const entity = new MockEntity();
        const operations = [
          { capability: "render", args: [] },
          { capability: "execute", args: ["param"] },
        ];

        vi.spyOn(registry, "hasCapability").mockReturnValue(true);
        vi.spyOn(
          registry as TestRegistry & {
            executeCapabilityWithEntity: (
              entity: MockEntity,
              capability: string,
              ...args: unknown[]
            ) => Promise<unknown>;
          },
          "executeCapabilityWithEntity"
        )
          .mockResolvedValueOnce("renderResult")
          .mockResolvedValueOnce("executeResult");

        const results = await registry.executeCapabilities(entity, operations);

        expect(results).toEqual(["renderResult", "executeResult"]);
      });

      it("should handle execution errors", async () => {
        const entity = new MockEntity();
        const operations = [{ capability: "failingCapability", args: [] }];

        vi.spyOn(registry, "hasCapability").mockReturnValue(true);
        vi.spyOn(
          registry as TestRegistry & {
            executeCapabilityWithEntity: (
              entity: MockEntity,
              capability: string,
              ...args: unknown[]
            ) => Promise<unknown>;
          },
          "executeCapabilityWithEntity"
        ).mockRejectedValue(new Error("Execution failed"));

        const results = await registry.executeCapabilities(entity, operations);

        expect(results).toHaveLength(1);
        expect(results[0]).toBeInstanceOf(Error);
      });
    });
  });

  describe("getRegistryMeta", () => {
    it("should return registry metadata for generated registry", () => {
      DynamicRegistryGenerator.generateRegistry(MockEntity);

      const meta = DynamicRegistryGenerator.getRegistryMeta(MockEntity);

      expect(meta).toBeDefined();
      expect(meta?.detectedCapabilities).toBeDefined();
      expect(meta?.createdAt).toBeDefined();
      expect(typeof meta?.createdAt).toBe("number");
    });

    it("should return undefined for non-generated registry", () => {
      const meta = DynamicRegistryGenerator.getRegistryMeta(MockEntity);

      expect(meta).toBeUndefined();
    });
  });

  describe("clearCache", () => {
    it("should clear the registry cache", () => {
      // Generate a registry
      DynamicRegistryGenerator.generateRegistry(MockEntity);
      expect(DynamicRegistryGenerator.getRegistryMeta(MockEntity)).toBeDefined();

      // Clear cache
      DynamicRegistryGenerator.clearCache();

      // Should no longer have metadata
      expect(DynamicRegistryGenerator.getRegistryMeta(MockEntity)).toBeUndefined();
    });

    it("should allow re-generation after cache clear", () => {
      const RegistryClass1 = DynamicRegistryGenerator.generateRegistry(MockEntity);
      DynamicRegistryGenerator.clearCache();
      const RegistryClass2 = DynamicRegistryGenerator.generateRegistry(MockEntity);

      // Should be different instances (new generation)
      expect(RegistryClass1).not.toBe(RegistryClass2);
    });
  });

  describe("validateEntityClass", () => {
    it("should validate a correct entity class", () => {
      const result = DynamicRegistryGenerator.validateEntityClass(MockEntity);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("should validate entity class with static type", () => {
      const result = DynamicRegistryGenerator.validateEntityClass(MockEntityWithType);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("should reject invalid entity class", () => {
      const result = DynamicRegistryGenerator.validateEntityClass(
        InvalidEntity as unknown as IEntityConstructor<IEntity>
      );

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it("should reject non-function entity class", () => {
      const result = DynamicRegistryGenerator.validateEntityClass(
        {} as unknown as IEntityConstructor<IEntity>
      );

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain("EntityClass must be a constructor function");
    });
  });

  describe("getEntityCapabilities", () => {
    it("should return detected capabilities for entity class", () => {
      const capabilities = DynamicRegistryGenerator.getEntityCapabilities(MockEntity);

      expect(Array.isArray(capabilities)).toBe(true);
      // Should detect capabilities from the mock detector
    });

    it("should handle entity class with static type", () => {
      const capabilities = DynamicRegistryGenerator.getEntityCapabilities(MockEntityWithType);

      expect(Array.isArray(capabilities)).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle capability detection errors gracefully", () => {
      // Test with options that might cause issues
      const options = {
        capabilities: ["testCapability"],
        enableCapabilityDetection: true,
      };

      expect(() => {
        DynamicRegistryGenerator.generateRegistry(MockEntity, options);
      }).not.toThrow();
    });

    it("should handle invalid options gracefully", () => {
      const options = {
        capabilities: null as unknown as string[],
        priority: "invalid" as unknown as number,
      };

      expect(() => {
        DynamicRegistryGenerator.generateRegistry(MockEntity, options);
      }).not.toThrow();
    });
  });
});
