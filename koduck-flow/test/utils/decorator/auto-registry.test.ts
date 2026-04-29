import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AutoRegistry,
  getAutoRegistryMeta,
  getDynamicRegistryClass,
  getRegistryInstance,
  hasAutoRegistry,
  manualRegister,
  unregister,
  updateRegistry,
} from "../../../src/utils/decorator/auto-registry";
import type { RegistryManager } from "../../../src/common/registry";
import { DynamicRegistryGenerator } from "../../../src/utils/decorator/registry-generator";
import type {
  IEntity,
  IEntityConstructor,
  IEntityArguments,
} from "../../../src/common/entity/types";
import type { Data } from "../../../src/common/data";
import type { AutoRegistryOptions } from "../../../src/utils/decorator/types";

// Mock dependencies
vi.mock("../../../src/utils/decorator/registry-generator");

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

abstract class BaseTestEntity implements IEntity {
  readonly id: string;
  readonly type: string;
  data: Data | undefined;
  config: IEntityArguments | undefined;

  constructor(config: IEntityArguments = {}) {
    const args = config as Record<string, unknown>;
    this.id = (args.id as string) ?? this.getDefaultId();
    this.type = (args.type as string) ?? this.getDefaultType();
    this.data = (args.data as Data | undefined) ?? undefined;
    this.config = config;
  }

  protected getDefaultId(): string {
    return "mock-entity";
  }

  protected getDefaultType(): string {
    const ctor = this.constructor as IEntityConstructor;
    if (typeof ctor.type === "string" && ctor.type.length > 0) {
      return ctor.type;
    }
    return ctor.name || "MockEntity";
  }

  dispose(): void {
    // noop for tests
  }
}

describe("AutoRegistry", () => {
  let mockRegistryManager: {
    addRegistry: ReturnType<typeof vi.fn>;
    hasRegistry: ReturnType<typeof vi.fn>;
    getRegistry: ReturnType<typeof vi.fn>;
    removeRegistry: ReturnType<typeof vi.fn>;
    updateRegistry: ReturnType<typeof vi.fn>;
    clearRegistries: ReturnType<typeof vi.fn>;
    getDefaultRegistry: ReturnType<typeof vi.fn>;
    getRegistryForEntity: ReturnType<typeof vi.fn>;
    getRegistryForType: ReturnType<typeof vi.fn>;
    setDefaultRegistry: ReturnType<typeof vi.fn>;
  };
  let mockDynamicRegistryGenerator: {
    generateRegistry: ReturnType<typeof vi.fn>;
  };

  // Mock entity class
  class MockEntity extends BaseTestEntity {
    protected override getDefaultId(): string {
      return "mock-entity";
    }

    protected override getDefaultType(): string {
      return "MockEntity";
    }
  }

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Set up RegistryManager mock
    mockRegistryManager = {
      addRegistry: vi.fn(),
      hasRegistry: vi.fn().mockReturnValue(false),
      getRegistry: vi.fn(),
      removeRegistry: vi.fn().mockReturnValue(true),
      updateRegistry: vi.fn(),
      clearRegistries: vi.fn(),
      getDefaultRegistry: vi.fn(),
      getRegistryForEntity: vi.fn(),
      getRegistryForType: vi.fn(),
      setDefaultRegistry: vi.fn(),
    };

    // Set up DynamicRegistryGenerator mock
    mockDynamicRegistryGenerator = {
      generateRegistry: vi.fn().mockReturnValue(
        class MockDynamicRegistry {
          constructor(entityConstructor: IEntityConstructor<IEntity>) {
            this.entityConstructor = entityConstructor;
          }
          entityConstructor: IEntityConstructor<IEntity>;
          getConstructor() {
            return MockEntity;
          }
          meta = { type: "MockRegistry" };
        }
      ),
    };

    (
      DynamicRegistryGenerator as unknown as {
        generateRegistry: typeof mockDynamicRegistryGenerator.generateRegistry;
      }
    ).generateRegistry = mockDynamicRegistryGenerator.generateRegistry;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("AutoRegistry decorator", () => {
    test("should correctly decorate class and add metadata", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
        capabilities: ["render", "execute"],
      };

      @AutoRegistry(options)
      class TestEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "test-entity";
        }
      }

      const meta = getAutoRegistryMeta(TestEntity);
      expect(meta).toBeDefined();
      expect(meta?.detectedCapabilities).toEqual(["render", "execute"]);
      expect(meta?.createdAt).toBeDefined();
    });

    test("should use default options", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
      };

      @AutoRegistry(options)
      class TestEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "test-entity";
        }
      }

      const meta = getAutoRegistryMeta(TestEntity);
      expect(meta).toBeDefined();
      expect(meta?.detectedCapabilities).toEqual([]);
      expect(meta?.createdAt).toBeDefined();
    });

    test("should automatically register to RegistryManager", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
        registryName: "auto-registry",
        capabilities: ["test"],
      };

      @AutoRegistry(options)
      class TestEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "test-entity";
        }
      }

      // Trigger class decorator execution
      new TestEntity();

      expect(mockRegistryManager.addRegistry).toHaveBeenCalledWith(
        "auto-registry",
        expect.any(Object)
      );
    });

    test("should not auto-register when autoRegister is false", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
        registryName: "manual-registry",
        autoRegister: false,
      };

      @AutoRegistry(options)
      class TestEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "test-entity";
        }
      }

      new TestEntity();

      expect(mockRegistryManager.addRegistry).not.toHaveBeenCalled();
    });

    test("should handle decorator errors", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
        registryName: "error-registry",
      };

      // Mock DynamicRegistryGenerator generation failure
      mockDynamicRegistryGenerator.generateRegistry.mockImplementation(() => {
        throw new Error("Generation failed");
      });

      expect(() => {
        @AutoRegistry(options)
        class TestEntity extends BaseTestEntity {
          protected override getDefaultId(): string {
            return "test-entity";
          }
        }
        // Use void operator to avoid unused variable warnings
        void TestEntity;
        // Decorator should throw error because generateRegistry is called before try-catch
      }).toThrow("Generation failed");
    });
  });

  describe("getAutoRegistryMeta", () => {
    test("should return correct metadata", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
        capabilities: ["meta"],
      };

      @AutoRegistry(options)
      class TestEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "test-entity";
        }
      }

      const meta = getAutoRegistryMeta(TestEntity);
      expect(meta).toBeDefined();
      expect(meta?.detectedCapabilities).toEqual(["meta"]);
      expect(meta?.createdAt).toBeDefined();
    });

    test("should return undefined for classes without decorator", () => {
      class PlainEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "plain-entity";
        }
      }

      const meta = getAutoRegistryMeta(PlainEntity);
      expect(meta).toBeUndefined();
    });
  });

  describe("getDynamicRegistryClass", () => {
    test("should return dynamically generated registry class", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
      };

      @AutoRegistry(options)
      class TestEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "test-entity";
        }
      }

      const registryClass = getDynamicRegistryClass(TestEntity);
      expect(registryClass).toBeDefined();
      expect(typeof registryClass).toBe("function");
    });

    test("should return undefined for classes without decorator", () => {
      class PlainEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "plain-entity";
        }
      }

      const registryClass = getDynamicRegistryClass(PlainEntity);
      expect(registryClass).toBeUndefined();
    });
  });

  describe("getRegistryInstance", () => {
    test("should return registry instance", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
      };

      @AutoRegistry(options)
      class TestEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "test-entity";
        }
      }

      // Manually register to set instance
      manualRegister(TestEntity, undefined, mockRegistryManager as unknown as RegistryManager);

      const instance = getRegistryInstance(TestEntity);
      expect(instance).toBeDefined();
    });

    test("should return undefined for unregistered classes", () => {
      class PlainEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "plain-entity";
        }
      }

      const instance = getRegistryInstance(PlainEntity);
      expect(instance).toBeUndefined();
    });
  });

  describe("hasAutoRegistry", () => {
    test("should return true for classes with decorator", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
      };

      @AutoRegistry(options)
      class TestEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "test-entity";
        }
      }

      expect(hasAutoRegistry(TestEntity)).toBe(true);
    });

    test("should return false for classes without decorator", () => {
      class PlainEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "plain-entity";
        }
      }

      expect(hasAutoRegistry(PlainEntity)).toBe(false);
    });
  });

  describe("manualRegister", () => {
    test("should manually register entity", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
      };

      @AutoRegistry(options)
      class TestEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "test-entity";
        }
      }

      const result = manualRegister(
        TestEntity,
        undefined,
        mockRegistryManager as unknown as RegistryManager
      );

      expect(result).toBe(true);
      expect(mockRegistryManager.addRegistry).toHaveBeenCalledWith(
        "TestEntity",
        expect.any(Object)
      );
    });

    test("should use custom registry name", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
      };

      @AutoRegistry(options)
      class TestEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "test-entity";
        }
      }

      const result = manualRegister(
        TestEntity,
        "custom-name",
        mockRegistryManager as unknown as RegistryManager
      );

      expect(result).toBe(true);
      expect(mockRegistryManager.addRegistry).toHaveBeenCalledWith(
        "custom-name",
        expect.any(Object)
      );
    });

    test("should return false for classes without decorator", () => {
      class PlainEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "plain-entity";
        }
      }

      const result = manualRegister(
        PlainEntity,
        undefined,
        mockRegistryManager as unknown as RegistryManager
      );
      expect(result).toBe(false);
    });

    test("should handle registration errors", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
      };

      @AutoRegistry(options)
      class TestEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "test-entity";
        }
      }

      mockRegistryManager.addRegistry.mockImplementation(() => {
        throw new Error("Registration failed");
      });

      const result = manualRegister(
        TestEntity,
        undefined,
        mockRegistryManager as unknown as RegistryManager
      );
      expect(result).toBe(false);
    });
  });

  describe("unregister", () => {
    test("should remove from registry", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
      };

      @AutoRegistry(options)
      class TestEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "test-entity";
        }
      }

      const result = unregister(
        TestEntity,
        undefined,
        mockRegistryManager as unknown as RegistryManager
      );

      expect(mockRegistryManager.removeRegistry).toHaveBeenCalledWith("TestEntity");
      expect(result).toBeDefined();
    });

    test("should use custom registry name", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
      };

      @AutoRegistry(options)
      class TestEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "test-entity";
        }
      }

      const result = unregister(
        TestEntity,
        "custom-name",
        mockRegistryManager as unknown as RegistryManager
      );

      expect(mockRegistryManager.removeRegistry).toHaveBeenCalledWith("custom-name");
      expect(result).toBeDefined();
    });

    test("should handle unregistration errors", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
      };

      @AutoRegistry(options)
      class TestEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "test-entity";
        }
      }

      mockRegistryManager.removeRegistry.mockImplementation(() => {
        throw new Error("Unregistration failed");
      });

      const result = unregister(
        TestEntity,
        undefined,
        mockRegistryManager as unknown as RegistryManager
      );
      expect(result).toBe(false);
    });
  });

  describe("updateRegistry", () => {
    test("should update registry", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
      };

      @AutoRegistry(options)
      class TestEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "test-entity";
        }
      }

      // Register first
      manualRegister(TestEntity, undefined, mockRegistryManager as unknown as RegistryManager);

      const result = updateRegistry(TestEntity, {
        capabilities: ["updated"],
        registryManager: mockRegistryManager as unknown as RegistryManager,
      });

      expect(result).toBeDefined();
    });

    test("should return false for unregistered classes", () => {
      class PlainEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "plain-entity";
        }
      }

      // Mock removeRegistry to return false for unregistered entities
      mockRegistryManager.removeRegistry.mockReturnValueOnce(false);

      const result = updateRegistry(PlainEntity, {
        capabilities: ["test"],
        registryManager: mockRegistryManager as unknown as RegistryManager,
      });
      expect(result).toBe(false);
    });
  });
});
