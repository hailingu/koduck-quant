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

// Mock 依赖
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

  // Mock 实体类
  class MockEntity extends BaseTestEntity {
    protected override getDefaultId(): string {
      return "mock-entity";
    }

    protected override getDefaultType(): string {
      return "MockEntity";
    }
  }

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks();

    // 设置 RegistryManager mock
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

    // 设置 DynamicRegistryGenerator mock
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
    test("应该正确装饰类并添加元数据", () => {
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

    test("应该使用默认选项", () => {
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

    test("应该自动注册到 RegistryManager", () => {
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

      // 触发类装饰器的执行
      new TestEntity();

      expect(mockRegistryManager.addRegistry).toHaveBeenCalledWith(
        "auto-registry",
        expect.any(Object)
      );
    });

    test("当 autoRegister 为 false 时不自动注册", () => {
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

    test("应该处理装饰器错误", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
        registryName: "error-registry",
      };

      // Mock DynamicRegistryGenerator 生成失败
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
        // 使用 void 运算符避免未使用变量警告
        void TestEntity;
        // 装饰器应该抛出错误，因为 generateRegistry 在 try-catch 之前调用
      }).toThrow("Generation failed");
    });
  });

  describe("getAutoRegistryMeta", () => {
    test("应该返回正确的元数据", () => {
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

    test("对于没有装饰器的类应该返回 undefined", () => {
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
    test("应该返回动态生成的注册表类", () => {
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

    test("对于没有装饰器的类应该返回 undefined", () => {
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
    test("应该返回注册表实例", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
      };

      @AutoRegistry(options)
      class TestEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "test-entity";
        }
      }

      // 手动注册以设置实例
      manualRegister(TestEntity, undefined, mockRegistryManager as unknown as RegistryManager);

      const instance = getRegistryInstance(TestEntity);
      expect(instance).toBeDefined();
    });

    test("对于没有注册的类应该返回 undefined", () => {
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
    test("对于有装饰器的类应该返回 true", () => {
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

    test("对于没有装饰器的类应该返回 false", () => {
      class PlainEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "plain-entity";
        }
      }

      expect(hasAutoRegistry(PlainEntity)).toBe(false);
    });
  });

  describe("manualRegister", () => {
    test("应该手动注册实体", () => {
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

    test("应该使用自定义注册表名称", () => {
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

    test("对于没有装饰器的类应该返回 false", () => {
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

    test("应该处理注册错误", () => {
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
    test("应该从注册表中移除", () => {
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

    test("应该使用自定义注册表名称", () => {
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

    test("应该处理注销错误", () => {
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
    test("应该更新注册表", () => {
      const options: AutoRegistryOptions = {
        registryManager: mockRegistryManager,
      };

      @AutoRegistry(options)
      class TestEntity extends BaseTestEntity {
        protected override getDefaultId(): string {
          return "test-entity";
        }
      }

      // 先注册
      manualRegister(TestEntity, undefined, mockRegistryManager as unknown as RegistryManager);

      const result = updateRegistry(TestEntity, {
        capabilities: ["updated"],
        registryManager: mockRegistryManager as unknown as RegistryManager,
      });

      expect(result).toBeDefined();
    });

    test("对于没有注册的类应该返回 false", () => {
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
