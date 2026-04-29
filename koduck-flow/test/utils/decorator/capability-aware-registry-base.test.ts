import { describe, it, expect, beforeEach, vi } from "vitest";
import type { IEntity, IEntityArguments } from "../../../src/common/entity/types";
import type { ICapability } from "../../../src/utils/decorator/types";
import { CapabilityAwareRegistryBase } from "../../../src/utils/decorator/capability-aware-registry-base";

 

// Mock entity class for testing
class MockEntity implements IEntity {
  public id: string;
  public type: string;

  constructor(public args?: IEntityArguments) {
    this.id = "mock-entity";
    this.type = "mock";
  }

  dispose(): void {
    // Mock dispose
  }

  canTest(...args: unknown[]): boolean {
    return args.length > 0;
  }

  test(...args: unknown[]): string {
    return `executed with ${args.join(", ")}`;
  }

  canInvalid(): boolean {
    return false;
  }
}

// Concrete implementation for testing
class TestCapabilityAwareRegistry extends CapabilityAwareRegistryBase<MockEntity> {
  constructor(args?: IEntityArguments, meta?: Record<string, unknown>) {
    super(MockEntity, args, { type: "test-registry", ...meta } as any);
  }
}

describe("CapabilityAwareRegistryBase", () => {
  let registry: TestCapabilityAwareRegistry;
  let mockCapability: ICapability;
  let mockCanHandle: ReturnType<typeof vi.fn>;
  let mockExecute: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    registry = new TestCapabilityAwareRegistry();
    mockCanHandle = vi.fn().mockReturnValue(true);
    mockExecute = vi.fn().mockResolvedValue("capability result");
    mockCapability = {
      name: "testCapability",
      canHandle: mockCanHandle,
      execute: mockExecute,
    } as ICapability;
  });

  describe("constructor", () => {
    it("should initialize with entity constructor", () => {
      expect(registry.getConstructor()).toBe(MockEntity);
    });

    it("should initialize with args", () => {
      const args = { test: "value" };
      const registryWithArgs = new TestCapabilityAwareRegistry(args);

      expect(registryWithArgs.args).toEqual(args);
    });

    it("should initialize with meta", () => {
      const meta = { type: "test" };
      const registryWithMeta = new TestCapabilityAwareRegistry(undefined, meta);

      expect(registryWithMeta.meta.type).toBe("test");
    });

    it("should initialize capabilities metadata", () => {
      const registryWithMeta = new TestCapabilityAwareRegistry();

      expect(registryWithMeta.meta.extras.capabilities).toEqual([]);
      expect(registryWithMeta.meta.extras._capabilitiesStorageVersion).toBe(2);
      expect(registryWithMeta.meta.capabilitiesDetectedAt).toBeDefined();
    });
  });

  describe("IRegistry interface implementation", () => {
    describe("getConstructor", () => {
      it("should return the entity constructor", () => {
        expect(registry.getConstructor()).toBe(MockEntity);
      });
    });

    describe("createEntity", () => {
      it("should create entity with stored args", () => {
        const args = { test: "value" };
        const registryWithArgs = new TestCapabilityAwareRegistry(args);

        const entity = registryWithArgs.createEntity();

        expect(entity).toBeInstanceOf(MockEntity);
        expect(entity.args).toEqual(args);
      });

      it("should create entity with provided args", () => {
        const providedArgs = { provided: "args" };

        const entity = registry.createEntity(providedArgs);

        expect(entity).toBeInstanceOf(MockEntity);
        expect(entity.args).toEqual(providedArgs);
      });

      it("should create entity with default args when no args provided", () => {
        const entity = registry.createEntity();

        expect(entity).toBeInstanceOf(MockEntity);
        expect(entity.args).toBeUndefined();
      });
    });
  });

  describe("ICapabilityAwareRegistry interface implementation", () => {
    beforeEach(() => {
      // Add capability to registry for testing
      (registry as any).addCapability(mockCapability);
    });

    describe("hasCapability", () => {
      it("should return true when capability exists", () => {
        expect(registry.hasCapability("testCapability")).toBe(true);
      });

      it("should return false when capability does not exist", () => {
        expect(registry.hasCapability("nonexistent")).toBe(false);
      });
    });

    describe("executeCapability", () => {
      it("should execute capability successfully", async () => {
        const result = await registry.executeCapability("testCapability", "arg1", "arg2");

        expect(result).toBe("capability result");
        expect(mockCapability.canHandle).toHaveBeenCalledWith("arg1", "arg2");
        expect(mockCapability.execute).toHaveBeenCalledWith("arg1", "arg2");
      });

      it("should throw error when capability not found", async () => {
        await expect(registry.executeCapability("nonexistent")).rejects.toThrow(
          "Capability 'nonexistent' not found in registry"
        );
      });

      it("should throw error when capability cannot handle args", async () => {
        mockCanHandle.mockReturnValue(false);

        await expect(registry.executeCapability("testCapability", "arg")).rejects.toThrow(
          "Capability 'testCapability' cannot handle the provided arguments"
        );
      });
    });

    describe("getCapabilities", () => {
      it("should return array of capability names", () => {
        const capabilities = registry.getCapabilities();

        expect(capabilities).toEqual(["testCapability"]);
      });

      it("should return empty array when no capabilities", () => {
        const emptyRegistry = new TestCapabilityAwareRegistry();
        const capabilities = emptyRegistry.getCapabilities();

        expect(capabilities).toEqual([]);
      });
    });
  });

  describe("ICapabilityContainer interface implementation", () => {
    beforeEach(() => {
      (registry as any).addCapability(mockCapability);
    });

    describe("supportedCapabilities", () => {
      it("should return supported capabilities", () => {
        expect(registry.supportedCapabilities).toEqual(["testCapability"]);
      });
    });

    describe("getCapability", () => {
      it("should return capability by name", () => {
        const capability = registry.getCapability("testCapability");

        expect(capability).toBe(mockCapability);
      });

      it("should return undefined for non-existent capability", () => {
        const capability = registry.getCapability("nonexistent");

        expect(capability).toBeUndefined();
      });
    });

    describe("executeCapabilityWithContext", () => {
      it("should execute capability with entity context", async () => {
        const entity = new MockEntity();

        const result = await registry.executeCapabilityWithContext("testCapability", entity, [
          "arg1",
        ]);

        expect(result).toBe("capability result");
        expect(mockCapability.canHandle).toHaveBeenCalledWith("arg1");
        expect(mockCapability.execute).toHaveBeenCalledWith("arg1");
      });

      it("should throw error when capability not found", async () => {
        const entity = new MockEntity();

        try {
          await registry.executeCapabilityWithContext("nonexistent", entity, []);
          expect.fail("Expected error to be thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe("Capability 'nonexistent' not found");
        }
      });

      it("should throw error when capability cannot handle context", async () => {
        const entity = new MockEntity();
        mockCanHandle.mockReturnValue(false);

        try {
          await registry.executeCapabilityWithContext("testCapability", entity, ["arg"]);
          expect.fail("Expected error to be thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe(
            "Capability 'testCapability' cannot handle the provided context"
          );
        }
      });
    });
  });

  describe("optional batch operations", () => {
    // Note: batch operations are not implemented in this base class
  });

  describe("utility methods", () => {
    describe("getCapabilityStats", () => {
      it("should return capability statistics", () => {
        (registry as any).addCapability(mockCapability);

        const stats = registry.getCapabilityStats();

        expect(stats).toEqual({
          totalCapabilities: 1,
          capabilityNames: ["testCapability"],
          lastUpdated: registry.meta.capabilitiesDetectedAt,
        });
      });
    });

    describe("validate", () => {
      it("should return valid when registry is properly configured", () => {
        (registry as any).addCapability(mockCapability);

        const validation = registry.validate();

        expect(validation.isValid).toBe(true);
        expect(validation.issues).toEqual([]);
      });
    });
  });
});
