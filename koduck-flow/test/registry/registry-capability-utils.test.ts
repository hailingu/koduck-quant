import { describe, test, expect, vi } from "vitest";
import { RegistryCapabilityUtils } from "../../src/common/registry/registry-capability-utils";
import type { IRegistry } from "../../src/common/registry/types";
import type { IEntity } from "../../src/common/entity";
import type { ICapability } from "../../src/utils";

describe("RegistryCapabilityUtils", () => {
  // Mock entity
  class MockEntity implements IEntity {
    readonly id = "mock-entity";
    readonly type = "MockEntity";
    dispose() {}
  }

  const mockEntity = new MockEntity();

  describe("getCapabilities method", () => {
    test("should get capabilities from explicit listCapabilities method", () => {
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

    test("should get capabilities from explicit getCapabilities method", () => {
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

    test("should get string array capabilities from meta.extras.capabilities", () => {
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

    test("should get ICapability object array from meta.extras.capabilities", () => {
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

    test("should return empty array when there are no capabilities", () => {
      const registry: IRegistry<MockEntity> = {
        getConstructor: () => MockEntity,
      };

      const capabilities = RegistryCapabilityUtils.getCapabilities(registry);
      expect(capabilities).toHaveLength(0);
    });

    test("should handle exceptions thrown by listCapabilities method", () => {
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

  describe("hasCapability method", () => {
    test("should use explicit hasCapability method to check capability", () => {
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

    test("should handle exceptions thrown by hasCapability method", () => {
      const registry: IRegistry<MockEntity> & {
        hasCapability: (name: string) => boolean;
      } = {
        getConstructor: () => MockEntity,
        hasCapability: () => {
          throw new Error("Test error");
        },
      };

      // Should fallback to capability name check
      expect(RegistryCapabilityUtils.hasCapability(registry, "render")).toBe(
        false
      );
    });

    test("should check capability from capability name list", () => {
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

  describe("hasRenderCapability method", () => {
    test("should check render capability", () => {
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

    test("should return false when there is no render capability", () => {
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

  describe("hasExecuteCapability method", () => {
    test("should check execute capability", () => {
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

    test("should return false when there is no execute capability", () => {
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

  describe("executeCapability method", () => {
    test("should use explicit executeCapability method to execute capability", async () => {
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

    test("should throw error when capability does not exist", async () => {
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

    test("should use virtual capability object to execute capability", async () => {
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
      expect(result).toBeUndefined(); // virtual capability returns undefined by default
    });

    test("should throw error when capability cannot handle entity", async () => {
      const mockCapabilities: ICapability[] = [
        {
          name: "render",
          canHandle: () => false, // cannot handle
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

    test("should throw error when capability does not exist in virtual list", async () => {
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

  describe("Edge Cases and Error Handling", () => {
    test("should handle empty extras object", () => {
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

    test("should handle empty capabilities array", () => {
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

    test("should handle invalid capabilities type", () => {
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
