import { describe, it, expect } from "vitest";
import { getGlobalRuntime } from "../../../src/common/global-runtime";

// Import FlowDemo which should trigger UML entity loading
import "../../../src/components/FlowDemo/FlowDemo";

describe("UML Registry Loading", () => {
  it("should have all UML registries loaded after FlowDemo import", () => {
    const registryManager = getGlobalRuntime().RegistryManager;

    const umlRegistryTypes = [
      "uml-class-canvas",
      "uml-interface-canvas",
      "uml-usecase-canvas",
      "uml-actor-canvas",
      "uml-line-canvas",
    ];

    umlRegistryTypes.forEach((registryType) => {
      const registry = registryManager.getRegistry(registryType);
      expect(registry, `${registryType} registry should be registered`).toBeDefined();
    });
  });

  it("should be able to create UML entities using entity manager", () => {
    const entityManager = getGlobalRuntime().EntityManager;

    // Test creating a UML UseCase entity (the one mentioned in the bug report)
    const entity = entityManager.createEntity("uml-usecase-canvas", {
      x: 100,
      y: 100,
      label: "Test UseCase",
    });

    expect(entity).toBeDefined();
    expect(entity?.type).toBe("uml-usecase-canvas");

    if (entity) {
      // Verify entity is in the manager
      const retrievedEntity = entityManager.getEntity(entity.id);
      expect(retrievedEntity).toBe(entity);

      // Cleanup
      entityManager.removeEntity(entity.id);
    }
  });
});
