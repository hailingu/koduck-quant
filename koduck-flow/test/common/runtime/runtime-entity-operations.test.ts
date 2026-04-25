import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RuntimeEntityOperations } from "../../../src/common/runtime/runtime-entity-operations";
import type { EntityManager } from "../../../src/common/entity/entity-manager";
import type { RenderManager } from "../../../src/common/render/render-manager";
import type { RuntimeQuotaManager } from "../../../src/common/runtime/runtime-quota-manager";
import type { IEntity } from "../../../src/common/entity";

describe("RuntimeEntityOperations", () => {
  let entityOperations: RuntimeEntityOperations;
  let mockEntityManager: EntityManager;
  let mockRenderManager: RenderManager;
  let mockQuotaManager: RuntimeQuotaManager;

  beforeEach(() => {
    // Mock EntityManager
    mockEntityManager = {
      createEntity: vi.fn(),
      getEntity: vi.fn(),
      removeEntity: vi.fn(),
      hasEntity: vi.fn(),
      getEntities: vi.fn(),
      removeEntities: vi.fn(),
    } as unknown as EntityManager;

    // Mock RenderManager
    mockRenderManager = {
      addEntityToRender: vi.fn(),
      removeEntityFromRender: vi.fn(),
      render: vi.fn(),
    } as unknown as RenderManager;

    // Mock RuntimeQuotaManager
    mockQuotaManager = {
      ensureEntityQuotaAvailable: vi.fn(),
      syncEntityQuotaUsage: vi.fn(),
    } as unknown as RuntimeQuotaManager;

    entityOperations = new RuntimeEntityOperations(
      mockEntityManager,
      mockRenderManager,
      mockQuotaManager
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================== Constructor ====================

  describe("constructor", () => {
    it("should create RuntimeEntityOperations with required dependencies", () => {
      expect(entityOperations).toBeDefined();
      expect(entityOperations).toBeInstanceOf(RuntimeEntityOperations);
    });
  });

  // ==================== Entity Operations ====================

  describe("createEntity", () => {
    it("should create entity when quota is available", () => {
      const mockEntity = { id: "entity-1", type: "Rectangle" } as IEntity;
      vi.mocked(mockQuotaManager.ensureEntityQuotaAvailable).mockReturnValue(true);
      vi.mocked(mockEntityManager.createEntity).mockReturnValue(mockEntity);

      const result = entityOperations.createEntity("Rectangle", { width: 100 });

      expect(mockQuotaManager.ensureEntityQuotaAvailable).toHaveBeenCalled();
      expect(mockEntityManager.createEntity).toHaveBeenCalledWith("Rectangle", { width: 100 });
      expect(mockQuotaManager.syncEntityQuotaUsage).toHaveBeenCalled();
      expect(result).toBe(mockEntity);
    });

    it("should return null when quota is not available", () => {
      vi.mocked(mockQuotaManager.ensureEntityQuotaAvailable).mockReturnValue(false);

      const result = entityOperations.createEntity("Rectangle");

      expect(mockQuotaManager.ensureEntityQuotaAvailable).toHaveBeenCalled();
      expect(mockEntityManager.createEntity).not.toHaveBeenCalled();
      expect(mockQuotaManager.syncEntityQuotaUsage).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should not sync quota if entity creation fails", () => {
      vi.mocked(mockQuotaManager.ensureEntityQuotaAvailable).mockReturnValue(true);
      vi.mocked(mockEntityManager.createEntity).mockReturnValue(null);

      const result = entityOperations.createEntity("Rectangle");

      expect(mockQuotaManager.ensureEntityQuotaAvailable).toHaveBeenCalled();
      expect(mockEntityManager.createEntity).toHaveBeenCalled();
      expect(mockQuotaManager.syncEntityQuotaUsage).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should pass arguments to entity manager", () => {
      const mockEntity = { id: "entity-1", type: "Circle" } as IEntity;
      const args = { radius: 50, fill: "#ff0000" };
      vi.mocked(mockQuotaManager.ensureEntityQuotaAvailable).mockReturnValue(true);
      vi.mocked(mockEntityManager.createEntity).mockReturnValue(mockEntity);

      entityOperations.createEntity("Circle", args);

      expect(mockEntityManager.createEntity).toHaveBeenCalledWith("Circle", args);
    });
  });

  describe("getEntity", () => {
    it("should delegate to entity manager", () => {
      const mockEntity = { id: "entity-1", type: "Rectangle" } as IEntity;
      vi.mocked(mockEntityManager.getEntity).mockReturnValue(mockEntity);

      const result = entityOperations.getEntity("entity-1");

      expect(mockEntityManager.getEntity).toHaveBeenCalledWith("entity-1");
      expect(result).toBe(mockEntity);
    });

    it("should return undefined when entity not found", () => {
      vi.mocked(mockEntityManager.getEntity).mockReturnValue(undefined);

      const result = entityOperations.getEntity("non-existent");

      expect(mockEntityManager.getEntity).toHaveBeenCalledWith("non-existent");
      expect(result).toBeUndefined();
    });

    it("should support generic type parameter", () => {
      interface CustomEntity extends IEntity {
        customProp: string;
      }

      const mockEntity = {
        id: "entity-1",
        type: "Custom",
        customProp: "value",
      } as CustomEntity;
      vi.mocked(mockEntityManager.getEntity).mockReturnValue(mockEntity);

      const result = entityOperations.getEntity<CustomEntity>("entity-1");

      expect(result).toBe(mockEntity);
      expect(result?.customProp).toBe("value");
    });
  });

  describe("removeEntity", () => {
    it("should remove entity and sync quota", () => {
      vi.mocked(mockEntityManager.removeEntity).mockReturnValue(true);

      const result = entityOperations.removeEntity("entity-1");

      expect(mockEntityManager.removeEntity).toHaveBeenCalledWith("entity-1");
      expect(mockQuotaManager.syncEntityQuotaUsage).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should not sync quota when removal fails", () => {
      vi.mocked(mockEntityManager.removeEntity).mockReturnValue(false);

      const result = entityOperations.removeEntity("non-existent");

      expect(mockEntityManager.removeEntity).toHaveBeenCalledWith("non-existent");
      expect(mockQuotaManager.syncEntityQuotaUsage).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe("hasEntity", () => {
    it("should delegate to entity manager and return true", () => {
      vi.mocked(mockEntityManager.hasEntity).mockReturnValue(true);

      const result = entityOperations.hasEntity("entity-1");

      expect(mockEntityManager.hasEntity).toHaveBeenCalledWith("entity-1");
      expect(result).toBe(true);
    });

    it("should delegate to entity manager and return false", () => {
      vi.mocked(mockEntityManager.hasEntity).mockReturnValue(false);

      const result = entityOperations.hasEntity("non-existent");

      expect(mockEntityManager.hasEntity).toHaveBeenCalledWith("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("getEntities", () => {
    it("should return all entities from entity manager", () => {
      const mockEntities = [
        { id: "entity-1", type: "Rectangle" },
        { id: "entity-2", type: "Circle" },
      ] as IEntity[];
      vi.mocked(mockEntityManager.getEntities).mockReturnValue(mockEntities);

      const result = entityOperations.getEntities();

      expect(mockEntityManager.getEntities).toHaveBeenCalled();
      expect(result).toBe(mockEntities);
      expect(result).toHaveLength(2);
    });

    it("should return empty array when no entities exist", () => {
      vi.mocked(mockEntityManager.getEntities).mockReturnValue([]);

      const result = entityOperations.getEntities();

      expect(mockEntityManager.getEntities).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe("removeEntities", () => {
    it("should remove multiple entities and sync quota", () => {
      vi.mocked(mockEntityManager.removeEntities).mockReturnValue(3);

      const result = entityOperations.removeEntities(["entity-1", "entity-2", "entity-3"]);

      expect(mockEntityManager.removeEntities).toHaveBeenCalledWith([
        "entity-1",
        "entity-2",
        "entity-3",
      ]);
      expect(mockQuotaManager.syncEntityQuotaUsage).toHaveBeenCalled();
      expect(result).toBe(3);
    });

    it("should not sync quota when no entities are removed", () => {
      vi.mocked(mockEntityManager.removeEntities).mockReturnValue(0);

      const result = entityOperations.removeEntities(["non-existent-1", "non-existent-2"]);

      expect(mockEntityManager.removeEntities).toHaveBeenCalledWith([
        "non-existent-1",
        "non-existent-2",
      ]);
      expect(mockQuotaManager.syncEntityQuotaUsage).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should handle empty array", () => {
      vi.mocked(mockEntityManager.removeEntities).mockReturnValue(0);

      const result = entityOperations.removeEntities([]);

      expect(mockEntityManager.removeEntities).toHaveBeenCalledWith([]);
      expect(mockQuotaManager.syncEntityQuotaUsage).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("should sync quota only once for batch removal", () => {
      vi.mocked(mockEntityManager.removeEntities).mockReturnValue(10);

      entityOperations.removeEntities(new Array(10).fill(0).map((_, i) => `entity-${i}`));

      expect(mockQuotaManager.syncEntityQuotaUsage).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== Render Operations ====================

  describe("addEntityToRender", () => {
    it("should add entity to render manager", () => {
      const mockEntity = { id: "entity-1", type: "Rectangle" } as IEntity;

      entityOperations.addEntityToRender(mockEntity);

      expect(mockRenderManager.addEntityToRender).toHaveBeenCalledWith(mockEntity);
    });
  });

  describe("removeEntityFromRender", () => {
    it("should remove entity from render manager", () => {
      entityOperations.removeEntityFromRender("entity-1");

      expect(mockRenderManager.removeEntityFromRender).toHaveBeenCalledWith("entity-1");
    });
  });

  describe("getEntityRenderElement", () => {
    it("should return render element from render manager", () => {
      const mockElement = { type: "div", props: {} };
      vi.mocked(mockRenderManager.render).mockReturnValue(
        mockElement as unknown as React.ReactElement
      );

      const result = entityOperations.getEntityRenderElement("entity-1");

      expect(mockRenderManager.render).toHaveBeenCalledWith("entity-1");
      expect(result).toBe(mockElement);
    });

    it("should return null when entity has no render element", () => {
      vi.mocked(mockRenderManager.render).mockReturnValue(null);

      const result = entityOperations.getEntityRenderElement("entity-1");

      expect(mockRenderManager.render).toHaveBeenCalledWith("entity-1");
      expect(result).toBeNull();
    });

    it("should support string render result", () => {
      vi.mocked(mockRenderManager.render).mockReturnValue("<div>Entity</div>");

      const result = entityOperations.getEntityRenderElement("entity-1");

      expect(result).toBe("<div>Entity</div>");
    });

    it("should support Promise render result", async () => {
      const mockPromise = Promise.resolve("<div>Async Entity</div>");
      vi.mocked(mockRenderManager.render).mockReturnValue(mockPromise);

      const result = entityOperations.getEntityRenderElement("entity-1");

      expect(result).toBe(mockPromise);
      await expect(result).resolves.toBe("<div>Async Entity</div>");
    });
  });

  // ==================== Integration Scenarios ====================

  describe("integration scenarios", () => {
    it("should handle full entity lifecycle: create -> render -> remove", () => {
      const mockEntity = { id: "entity-1", type: "Rectangle" } as IEntity;
      vi.mocked(mockQuotaManager.ensureEntityQuotaAvailable).mockReturnValue(true);
      vi.mocked(mockEntityManager.createEntity).mockReturnValue(mockEntity);
      vi.mocked(mockEntityManager.removeEntity).mockReturnValue(true);

      // Create
      const created = entityOperations.createEntity("Rectangle");
      expect(created).toBe(mockEntity);
      expect(mockQuotaManager.syncEntityQuotaUsage).toHaveBeenCalledTimes(1);

      // Add to render
      entityOperations.addEntityToRender(created!);
      expect(mockRenderManager.addEntityToRender).toHaveBeenCalledWith(mockEntity);

      // Remove from render
      entityOperations.removeEntityFromRender(created!.id);
      expect(mockRenderManager.removeEntityFromRender).toHaveBeenCalledWith("entity-1");

      // Remove entity
      const removed = entityOperations.removeEntity(created!.id);
      expect(removed).toBe(true);
      expect(mockQuotaManager.syncEntityQuotaUsage).toHaveBeenCalledTimes(2);
    });

    it("should handle quota rejection gracefully", () => {
      vi.mocked(mockQuotaManager.ensureEntityQuotaAvailable).mockReturnValue(false);

      const entity = entityOperations.createEntity("Rectangle");

      expect(entity).toBeNull();
      expect(mockEntityManager.createEntity).not.toHaveBeenCalled();
      expect(mockRenderManager.addEntityToRender).not.toHaveBeenCalled();
    });

    it("should handle batch operations efficiently", () => {
      vi.mocked(mockEntityManager.removeEntities).mockReturnValue(5);

      entityOperations.removeEntities(["e1", "e2", "e3", "e4", "e5"]);

      expect(mockEntityManager.removeEntities).toHaveBeenCalledTimes(1);
      expect(mockQuotaManager.syncEntityQuotaUsage).toHaveBeenCalledTimes(1);
    });
  });
});
