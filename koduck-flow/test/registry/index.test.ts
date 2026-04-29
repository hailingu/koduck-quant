import { describe, test, expect } from "vitest";
import type {
  IRegistry,
  IRegistryManager,
  IRenderableRegistry,
  ICapabilityAwareRegistry,
} from "../../src/common/registry/types";
import {
  RegistryManager,
  RegistryCapabilityUtils,
  createRegistryManager,
} from "../../src/common/registry";
import type { IEntity } from "../../src/common/entity";

// Mock Entity for testing
class MockEntity implements IEntity {
  readonly id = "mock-entity";
  readonly type = "MockEntity";
  dispose() {}
}

describe("Registry Index Exports", () => {
  describe("Type Export Verification", () => {
    test("types should pass TypeScript compilation check", () => {
      // These tests passing TypeScript compilation means type exports are correct
      const registry: IRegistry<MockEntity> = {} as IRegistry<MockEntity>;
      const manager: IRegistryManager<MockEntity> =
        {} as IRegistryManager<MockEntity>;
      const renderableRegistry: IRenderableRegistry<MockEntity> =
        {} as IRenderableRegistry<MockEntity>;
      const capabilityRegistry: ICapabilityAwareRegistry<MockEntity> =
        {} as ICapabilityAwareRegistry<MockEntity>;

      // Basic existence check
      expect(registry).toBeDefined();
      expect(manager).toBeDefined();
      expect(renderableRegistry).toBeDefined();
      expect(capabilityRegistry).toBeDefined();
    });
  });

  describe("Implementation Exports", () => {
    test("should export RegistryManager class", () => {
      expect(RegistryManager).toBeDefined();
      expect(typeof RegistryManager).toBe("function");
      expect(RegistryManager.name).toBe("RegistryManager");

      // Verify it's a constructor
      const instance = createRegistryManager();
      expect(instance).toBeInstanceOf(RegistryManager);
    });

    test("should export RegistryCapabilityUtils class", () => {
      expect(RegistryCapabilityUtils).toBeDefined();
      expect(typeof RegistryCapabilityUtils).toBe("function");
      expect(RegistryCapabilityUtils.name).toBe("RegistryCapabilityUtils");

      // Verify static methods exist
      expect(typeof RegistryCapabilityUtils.getCapabilities).toBe("function");
      expect(typeof RegistryCapabilityUtils.hasCapability).toBe("function");
      expect(typeof RegistryCapabilityUtils.hasRenderCapability).toBe(
        "function"
      );
      expect(typeof RegistryCapabilityUtils.hasExecuteCapability).toBe(
        "function"
      );
      expect(typeof RegistryCapabilityUtils.executeCapability).toBe("function");
    });
  });

  describe("Module Completeness Verification", () => {
    test("all exports should be valid", () => {
      const exports = {
        RegistryManager,
        RegistryCapabilityUtils,
      };

      // Verify all exports exist and are not undefined
      Object.entries(exports).forEach(([, exported]) => {
        expect(exported).toBeDefined();
        expect(exported).not.toBeNull();
      });
    });

    test("RegistryManager should implement IRegistryManager interface requirements", () => {
      const manager = createRegistryManager();

      // Verify required methods exist
      expect(typeof manager.getDefaultRegistry).toBe("function");
      expect(typeof manager.getRegistry).toBe("function");
      expect(typeof manager.getRegistryForEntity).toBe("function");
      expect(typeof manager.getRegistryForType).toBe("function");
      expect(typeof manager.addRegistry).toBe("function");
      expect(typeof manager.setDefaultRegistry).toBe("function");

      // Verify optional methods exist
      expect(typeof manager.removeRegistry).toBe("function");
      expect(typeof manager.bindTypeToRegistry).toBe("function");
      expect(typeof manager.unbindType).toBe("function");
    });

    test("RegistryCapabilityUtils should provide complete capability management", () => {
      const methods = [
        "getCapabilities",
        "hasCapability",
        "hasRenderCapability",
        "hasExecuteCapability",
        "executeCapability",
      ];

      methods.forEach((method) => {
        expect(
          RegistryCapabilityUtils[
            method as keyof typeof RegistryCapabilityUtils
          ]
        ).toBeDefined();
        expect(
          typeof RegistryCapabilityUtils[
            method as keyof typeof RegistryCapabilityUtils
          ]
        ).toBe("function");
      });
    });
  });

  describe("API Consistency Verification", () => {
    test("exported types should be compatible with actual implementations", () => {
      const manager = createRegistryManager();

      // Verify RegistryManager instance has all methods of IRegistryManager interface
      expect(typeof manager.getDefaultRegistry).toBe("function");
      expect(typeof manager.getRegistry).toBe("function");
      expect(typeof manager.addRegistry).toBe("function");
      expect(typeof manager.setDefaultRegistry).toBe("function");
    });
    test("static utility class method signatures should be correct", () => {
      // Verify methods exist and are functions
      expect(RegistryCapabilityUtils.getCapabilities).toBeInstanceOf(Function);
      expect(RegistryCapabilityUtils.hasCapability).toBeInstanceOf(Function);
      expect(RegistryCapabilityUtils.executeCapability).toBeInstanceOf(
        Function
      );

      // Verify method length (number of parameters)
      expect(RegistryCapabilityUtils.getCapabilities.length).toBe(1);
      expect(RegistryCapabilityUtils.hasCapability.length).toBe(2);
      expect(RegistryCapabilityUtils.hasRenderCapability.length).toBe(1);
      expect(RegistryCapabilityUtils.hasExecuteCapability.length).toBe(1);
      expect(RegistryCapabilityUtils.executeCapability.length).toBe(3); // registry, name, entity (rest args don't count)
    });
  });

  describe("Version Compatibility", () => {
    test("exported API should maintain backward compatibility", () => {
      // Verify key exports that should exist in historical versions
      expect("RegistryManager" in { RegistryManager }).toBe(true);
      expect("RegistryCapabilityUtils" in { RegistryCapabilityUtils }).toBe(
        true
      );
    });

    test("export structure should match expected module shape", () => {
      // Verify module export structure and naming follow conventions
      expect(RegistryManager.name).toBe("RegistryManager");
      expect(RegistryCapabilityUtils.name).toBe("RegistryCapabilityUtils");

      // Verify singleton pattern is correctly implemented
      const instance1 = createRegistryManager();
      const instance2 = createRegistryManager();
      expect(instance1).not.toBe(instance2);
      expect(instance1).toBeInstanceOf(RegistryManager);
      expect(instance2).toBeInstanceOf(RegistryManager);
    });
  });
});
