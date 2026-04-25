import { describe, test, expect, vi } from "vitest";
import { RegistryCapabilityUtils } from "../../src/common/registry/registry-capability-utils";
import type { IRegistry } from "../../src/common/registry/types";
import type { IEntity } from "../../src/common/entity";
import type { ICapability } from "../../src/utils";

describe("RegistryCapabilityUtils", () => {
  // Mock实体
  class MockEntity implements IEntity {
    readonly id = "mock-entity";
    readonly type = "MockEntity";
    dispose() {}
  }

  const mockEntity = new MockEntity();

  describe("getCapabilities方法", () => {
    test("应该从显式listCapabilities方法获取能力", () => {
      const registry: IRegistry<MockEntity> & {
        listCapabilities: () => string[];
      } = {
        getConstructor: () => MockEntity,
        listCapabilities: () => ["render", "execute"],
      };

      const capabilities = RegistryCapabilityUtils.getCapabilities(registry);
      expect(capabilities).toHaveLength(2);
      expect(capabilities[0].name).toBe("render");
      expect(capabilities[1].name).toBe("execute");
    });

    test("应该从显式getCapabilities方法获取能力", () => {
      const registry: IRegistry<MockEntity> & {
        getCapabilities: () => string[];
      } = {
        getConstructor: () => MockEntity,
        getCapabilities: () => ["debug", "validate"],
      };

      const capabilities = RegistryCapabilityUtils.getCapabilities(registry);
      expect(capabilities).toHaveLength(2);
      expect(capabilities[0].name).toBe("debug");
      expect(capabilities[1].name).toBe("validate");
    });

    test("应该从meta.extras.capabilities获取字符串数组能力", () => {
      const registry: IRegistry<MockEntity> = {
        getConstructor: () => MockEntity,
        meta: {
          type: "test",
          extras: {
            capabilities: ["render", "execute", "transform"],
          },
        },
      };

      const capabilities = RegistryCapabilityUtils.getCapabilities(registry);
      expect(capabilities).toHaveLength(3);
      expect(capabilities.map((c) => c.name)).toEqual([
        "render",
        "execute",
        "transform",
      ]);
    });

    test("应该从meta.extras.capabilities获取ICapability对象数组", () => {
      const mockCapabilities: ICapability[] = [
        {
          name: "render",
          canHandle: () => true,
          execute: async () => "rendered",
        },
        {
          name: "execute",
          canHandle: () => true,
          execute: async () => "executed",
        },
      ];

      const registry: IRegistry<MockEntity> = {
        getConstructor: () => MockEntity,
        meta: {
          type: "test",
          extras: {
            capabilities: mockCapabilities,
          },
        },
      };

      const capabilities = RegistryCapabilityUtils.getCapabilities(registry);
      expect(capabilities).toHaveLength(2);
      expect(capabilities).toBe(mockCapabilities);
    });

    test("应该返回空数组当没有能力时", () => {
      const registry: IRegistry<MockEntity> = {
        getConstructor: () => MockEntity,
      };

      const capabilities = RegistryCapabilityUtils.getCapabilities(registry);
      expect(capabilities).toHaveLength(0);
    });

    test("应该处理listCapabilities方法抛出异常", () => {
      const registry: IRegistry<MockEntity> & {
        listCapabilities: () => string[];
      } = {
        getConstructor: () => MockEntity,
        listCapabilities: () => {
          throw new Error("Test error");
        },
      };

      const capabilities = RegistryCapabilityUtils.getCapabilities(registry);
      expect(capabilities).toHaveLength(0);
    });
  });

  describe("hasCapability方法", () => {
    test("应该使用显式hasCapability方法检查能力", () => {
      const hasCapabilityMock = vi.fn((name: string) => name === "render");
      const registry: IRegistry<MockEntity> & {
        hasCapability: (name: string) => boolean;
      } = {
        getConstructor: () => MockEntity,
        hasCapability: hasCapabilityMock,
      };

      expect(RegistryCapabilityUtils.hasCapability(registry, "render")).toBe(
        true
      );
      expect(RegistryCapabilityUtils.hasCapability(registry, "unknown")).toBe(
        false
      );
      expect(hasCapabilityMock).toHaveBeenCalledWith("render");
      expect(hasCapabilityMock).toHaveBeenCalledWith("unknown");
    });

    test("应该处理hasCapability方法抛出异常", () => {
      const registry: IRegistry<MockEntity> & {
        hasCapability: (name: string) => boolean;
      } = {
        getConstructor: () => MockEntity,
        hasCapability: () => {
          throw new Error("Test error");
        },
      };

      // 应该fallback到能力名称检查
      expect(RegistryCapabilityUtils.hasCapability(registry, "render")).toBe(
        false
      );
    });

    test("应该从能力名称列表检查能力", () => {
      const registry: IRegistry<MockEntity> = {
        getConstructor: () => MockEntity,
        meta: {
          type: "test",
          extras: {
            capabilities: ["render", "execute"],
          },
        },
      };

      expect(RegistryCapabilityUtils.hasCapability(registry, "render")).toBe(
        true
      );
      expect(RegistryCapabilityUtils.hasCapability(registry, "execute")).toBe(
        true
      );
      expect(RegistryCapabilityUtils.hasCapability(registry, "unknown")).toBe(
        false
      );
    });
  });

  describe("hasRenderCapability方法", () => {
    test("应该检查render能力", () => {
      const registry: IRegistry<MockEntity> = {
        getConstructor: () => MockEntity,
        meta: {
          type: "test",
          extras: {
            capabilities: ["render", "execute"],
          },
        },
      };

      expect(RegistryCapabilityUtils.hasRenderCapability(registry)).toBe(true);
    });

    test("应该返回false当没有render能力时", () => {
      const registry: IRegistry<MockEntity> = {
        getConstructor: () => MockEntity,
        meta: {
          type: "test",
          extras: {
            capabilities: ["execute"],
          },
        },
      };

      expect(RegistryCapabilityUtils.hasRenderCapability(registry)).toBe(false);
    });
  });

  describe("hasExecuteCapability方法", () => {
    test("应该检查execute能力", () => {
      const registry: IRegistry<MockEntity> = {
        getConstructor: () => MockEntity,
        meta: {
          type: "test",
          extras: {
            capabilities: ["render", "execute"],
          },
        },
      };

      expect(RegistryCapabilityUtils.hasExecuteCapability(registry)).toBe(true);
    });

    test("应该返回false当没有execute能力时", () => {
      const registry: IRegistry<MockEntity> = {
        getConstructor: () => MockEntity,
        meta: {
          type: "test",
          extras: {
            capabilities: ["render"],
          },
        },
      };

      expect(RegistryCapabilityUtils.hasExecuteCapability(registry)).toBe(
        false
      );
    });
  });

  describe("executeCapability方法", () => {
    test("应该使用显式executeCapability方法执行能力", async () => {
      const executeCapabilityMock = vi.fn(
        async (name: string, entity: IEntity) => `${name}-${entity.id}`
      );
      const hasCapabilityMock = vi.fn(() => true);

      const registry: IRegistry<MockEntity> & {
        executeCapability: (
          name: string,
          entity: IEntity,
          ...args: unknown[]
        ) => Promise<unknown>;
        hasCapability: (name: string) => boolean;
      } = {
        getConstructor: () => MockEntity,
        executeCapability: executeCapabilityMock,
        hasCapability: hasCapabilityMock,
      };

      const result = await RegistryCapabilityUtils.executeCapability(
        registry,
        "render",
        mockEntity
      );
      expect(result).toBe("render-mock-entity");
      expect(executeCapabilityMock).toHaveBeenCalledWith("render", mockEntity);
    });

    test("应该抛出错误当能力不存在时", async () => {
      const hasCapabilityMock = vi.fn(() => false);

      const registry: IRegistry<MockEntity> & {
        executeCapability: (
          name: string,
          entity: IEntity,
          ...args: unknown[]
        ) => Promise<unknown>;
        hasCapability: (name: string) => boolean;
      } = {
        getConstructor: () => MockEntity,
        executeCapability: vi.fn(),
        hasCapability: hasCapabilityMock,
      };

      await expect(
        RegistryCapabilityUtils.executeCapability(
          registry,
          "unknown",
          mockEntity
        )
      ).rejects.toThrow('Capability "unknown" not found in registry');
    });

    test("应该使用虚拟能力对象执行能力", async () => {
      const registry: IRegistry<MockEntity> = {
        getConstructor: () => MockEntity,
        meta: {
          type: "test",
          extras: {
            capabilities: ["render"],
          },
        },
      };

      const result = await RegistryCapabilityUtils.executeCapability(
        registry,
        "render",
        mockEntity
      );
      expect(result).toBeUndefined(); // 虚拟能力默认返回undefined
    });

    test("应该抛出错误当能力不能处理实体时", async () => {
      const mockCapabilities: ICapability[] = [
        {
          name: "render",
          canHandle: () => false, // 不能处理
          execute: async () => "rendered",
        },
      ];

      const registry: IRegistry<MockEntity> = {
        getConstructor: () => MockEntity,
        meta: {
          type: "test",
          extras: {
            capabilities: mockCapabilities,
          },
        },
      };

      await expect(
        RegistryCapabilityUtils.executeCapability(
          registry,
          "render",
          mockEntity
        )
      ).rejects.toThrow('Capability "render" cannot handle entity mock-entity');
    });

    test("应该抛出错误当能力不存在于虚拟列表中时", async () => {
      const registry: IRegistry<MockEntity> = {
        getConstructor: () => MockEntity,
        meta: {
          type: "test",
          extras: {
            capabilities: ["render"],
          },
        },
      };

      await expect(
        RegistryCapabilityUtils.executeCapability(
          registry,
          "unknown",
          mockEntity
        )
      ).rejects.toThrow('Capability "unknown" not found');
    });
  });

  describe("边界情况和错误处理", () => {
    test("应该处理空的extras对象", () => {
      const registry: IRegistry<MockEntity> = {
        getConstructor: () => MockEntity,
        meta: {
          type: "test",
          extras: {},
        },
      };

      const capabilities = RegistryCapabilityUtils.getCapabilities(registry);
      expect(capabilities).toHaveLength(0);
      expect(RegistryCapabilityUtils.hasCapability(registry, "any")).toBe(
        false
      );
    });

    test("应该处理空的capabilities数组", () => {
      const registry: IRegistry<MockEntity> = {
        getConstructor: () => MockEntity,
        meta: {
          type: "test",
          extras: {
            capabilities: [],
          },
        },
      };

      const capabilities = RegistryCapabilityUtils.getCapabilities(registry);
      expect(capabilities).toHaveLength(0);
    });

    test("应该处理无效的capabilities类型", () => {
      const registry: IRegistry<MockEntity> = {
        getConstructor: () => MockEntity,
        meta: {
          type: "test",
          extras: {
            capabilities: "invalid" as unknown,
          },
        },
      };

      const capabilities = RegistryCapabilityUtils.getCapabilities(registry);
      expect(capabilities).toHaveLength(0);
    });
  });
});
