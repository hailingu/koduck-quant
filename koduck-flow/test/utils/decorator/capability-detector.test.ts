import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DefaultCapabilityDetector,
  BaseCapability,
  EntityMethodCapability,
} from "../../../src/utils/decorator/capability-detector";

describe("Capability Detector", () => {
  let detector: DefaultCapabilityDetector;

  beforeEach(() => {
    detector = new DefaultCapabilityDetector();
  });

  describe("DefaultCapabilityDetector", () => {
    describe("detectCapabilities", () => {
      it("should detect render capabilities", () => {
        const prototype = {
          render: vi.fn(),
          canRender: vi.fn(),
          getRenderStyle: vi.fn(),
        };

        const capabilities = detector.detectCapabilities(prototype);
        expect(capabilities).toContain("render");
      });

      it("should detect execute capabilities", () => {
        const prototype = {
          execute: vi.fn(),
          canExecute: vi.fn(),
          run: vi.fn(),
        };

        const capabilities = detector.detectCapabilities(prototype);
        expect(capabilities).toContain("execute");
      });

      it("should detect serialize capabilities", () => {
        const prototype = {
          serialize: vi.fn(),
          deserialize: vi.fn(),
          toJSON: vi.fn(),
          fromJSON: vi.fn(),
        };

        const capabilities = detector.detectCapabilities(prototype);
        expect(capabilities).toContain("serialize");
      });

      it("should detect validate capabilities", () => {
        const prototype = {
          validate: vi.fn(),
          isValid: vi.fn(),
          check: vi.fn(),
        };

        const capabilities = detector.detectCapabilities(prototype);
        expect(capabilities).toContain("validate");
      });

      it("should detect transform capabilities", () => {
        const prototype = {
          transform: vi.fn(),
          convert: vi.fn(),
          map: vi.fn(),
        };

        const capabilities = detector.detectCapabilities(prototype);
        expect(capabilities).toContain("transform");
      });

      it("should detect lifecycle capabilities", () => {
        const prototype = {
          init: vi.fn(),
          destroy: vi.fn(),
          dispose: vi.fn(),
          cleanup: vi.fn(),
        };

        const capabilities = detector.detectCapabilities(prototype);
        expect(capabilities).toContain("lifecycle");
      });

      it("should return unique capabilities", () => {
        const prototype = {
          render: vi.fn(),
          canRender: vi.fn(),
          execute: vi.fn(),
          canExecute: vi.fn(),
          render2: vi.fn(), // Another render pattern
        };

        const capabilities = detector.detectCapabilities(prototype);
        expect(capabilities.filter((cap) => cap === "render")).toHaveLength(1);
        expect(capabilities.filter((cap) => cap === "execute")).toHaveLength(1);
      });

      it("should handle empty prototype", () => {
        const prototype = {};
        const capabilities = detector.detectCapabilities(prototype);
        expect(capabilities).toEqual([]);
      });

      it("should handle prototype with non-function properties", () => {
        const prototype = {
          name: "test",
          value: 42,
          render: vi.fn(),
        };

        const capabilities = detector.detectCapabilities(prototype);
        expect(capabilities).toEqual(["render"]);
      });

      it("should handle prototype inheritance", () => {
        const parentPrototype = {
          render: vi.fn(),
        };

        const childPrototype = Object.create(parentPrototype);
        childPrototype.execute = vi.fn();

        const capabilities = detector.detectCapabilities(childPrototype);
        expect(capabilities).toContain("render");
        expect(capabilities).toContain("execute");
      });
    });

    describe("detectMethodCapability", () => {
      it("should detect render method capability", () => {
        expect(detector.detectMethodCapability("render", vi.fn())).toBe(
          "render"
        );
        expect(detector.detectMethodCapability("canRender", vi.fn())).toBe(
          "render"
        );
        expect(detector.detectMethodCapability("getRenderStyle", vi.fn())).toBe(
          "render"
        );
      });

      it("should detect execute method capability", () => {
        expect(detector.detectMethodCapability("execute", vi.fn())).toBe(
          "execute"
        );
        expect(detector.detectMethodCapability("canExecute", vi.fn())).toBe(
          "execute"
        );
        expect(detector.detectMethodCapability("run", vi.fn())).toBe("execute");
      });

      it("should detect serialize method capability", () => {
        expect(detector.detectMethodCapability("serialize", vi.fn())).toBe(
          "serialize"
        );
        expect(detector.detectMethodCapability("deserialize", vi.fn())).toBe(
          "serialize"
        );
        expect(detector.detectMethodCapability("toJSON", vi.fn())).toBe(
          "serialize"
        );
        expect(detector.detectMethodCapability("fromJSON", vi.fn())).toBe(
          "serialize"
        );
      });

      it("should detect validate method capability", () => {
        expect(detector.detectMethodCapability("validate", vi.fn())).toBe(
          "validate"
        );
        expect(detector.detectMethodCapability("isValid", vi.fn())).toBe(
          "validate"
        );
        expect(detector.detectMethodCapability("check", vi.fn())).toBe(
          "validate"
        );
      });

      it("should detect transform method capability", () => {
        expect(detector.detectMethodCapability("transform", vi.fn())).toBe(
          "transform"
        );
        expect(detector.detectMethodCapability("convert", vi.fn())).toBe(
          "transform"
        );
        expect(detector.detectMethodCapability("map", vi.fn())).toBe(
          "transform"
        );
      });

      it("should detect lifecycle method capability", () => {
        expect(detector.detectMethodCapability("init", vi.fn())).toBe(
          "lifecycle"
        );
        expect(detector.detectMethodCapability("destroy", vi.fn())).toBe(
          "lifecycle"
        );
        expect(detector.detectMethodCapability("dispose", vi.fn())).toBe(
          "lifecycle"
        );
        expect(detector.detectMethodCapability("cleanup", vi.fn())).toBe(
          "lifecycle"
        );
      });

      it("should return null for unknown method", () => {
        expect(
          detector.detectMethodCapability("unknownMethod", vi.fn())
        ).toBeNull();
      });

      it("should return null for unknown method", () => {
        expect(
          detector.detectMethodCapability("unknownMethod", vi.fn())
        ).toBeNull();
      });
    });

    describe("addCapabilityPattern", () => {
      it("should add custom capability pattern", () => {
        detector.addCapabilityPattern("custom", [/^custom/, /^canCustom$/]);

        const prototype = {
          custom: vi.fn(),
          canCustom: vi.fn(),
        };

        const capabilities = detector.detectCapabilities(prototype);
        expect(capabilities).toContain("custom");
      });

      it("should handle multiple patterns for same capability", () => {
        detector.addCapabilityPattern("multi", [/^multi1$/, /^multi2$/]);

        const prototype = {
          multi1: vi.fn(),
          multi2: vi.fn(),
        };

        const capabilities = detector.detectCapabilities(prototype);
        expect(capabilities.filter((cap) => cap === "multi")).toHaveLength(1);
      });
    });

    describe("removeCapabilityPattern", () => {
      it("should remove capability pattern", () => {
        detector.addCapabilityPattern("custom", [/^custom$/]);
        expect(detector.removeCapabilityPattern("custom")).toBe(true);

        const prototype = {
          custom: vi.fn(),
        };

        const capabilities = detector.detectCapabilities(prototype);
        expect(capabilities).not.toContain("custom");
      });

      it("should return false for non-existent pattern", () => {
        expect(detector.removeCapabilityPattern("nonexistent")).toBe(false);
      });
    });

    describe("createCapabilityFromMethod", () => {
      it("should create capability from detected method", () => {
        const prototype = {
          render: vi.fn().mockReturnValue("<div>Test</div>"),
          canRender: vi.fn().mockReturnValue(true),
        };

        const capability = detector.createCapabilityFromMethod(
          "render",
          prototype.render,
          prototype
        );

        expect(capability).not.toBeNull();
        expect(capability?.name).toBe("render");
        expect(capability?.priority).toBe(1);
        expect(capability?.canHandle([])).toBe(true);
        expect(capability?.execute()).toBe("<div>Test</div>");
        expect(capability?.meta).toEqual({
          methodName: "render",
          source: "auto-detected",
          entityPrototype: "Object",
          version: "1.0.0",
          description: "Auto-generated capability for render",
        });
      });

      it("should return null for undetected method", () => {
        const prototype = {
          unknownMethod: vi.fn(),
        };

        const capability = detector.createCapabilityFromMethod(
          "unknownMethod",
          prototype.unknownMethod,
          prototype
        );

        expect(capability).toBeNull();
      });

      it("should handle method with canHandle check", () => {
        const prototype = {
          render: vi.fn().mockReturnValue("<div>Test</div>"),
          canRender: vi.fn().mockReturnValue(false),
        };

        const capability = detector.createCapabilityFromMethod(
          "render",
          prototype.render,
          prototype
        );

        expect(capability?.canHandle([])).toBe(true); // Default behavior when no canHandle method
      });
    });
  });

  describe("BaseCapability", () => {
    it("should create base capability with defaults", () => {
      const capability = new BaseCapability("test");

      expect(capability.name).toBe("test");
      expect(capability.priority).toBe(0);
      expect(capability.meta).toEqual({});
    });

    it("should create base capability with options", () => {
      const capability = new BaseCapability("test", {
        priority: 5,
        meta: { description: "test capability" },
      });

      expect(capability.name).toBe("test");
      expect(capability.priority).toBe(5);
      expect(capability.meta).toEqual({ description: "test capability" });
    });

    it("should have default canHandle implementation", () => {
      const capability = new BaseCapability("test");
      expect(capability.canHandle()).toBe(true);
    });

    it("should throw error on execute by default", () => {
      const capability = new BaseCapability("test");
      expect(() => capability.execute()).toThrow(
        "Capability test execute method not implemented"
      );
    });

    it("should return meta copy", () => {
      const capability = new BaseCapability("test", {
        meta: { key: "value" },
      });

      const meta = capability.getMeta();
      expect(meta).toEqual({ key: "value" });
      expect(meta).not.toBe(capability.meta); // Should be a copy
    });

    it("should dispose capability", () => {
      const capability = new BaseCapability("test", {
        meta: { key: "value" },
      });

      capability.dispose();
      expect(capability.meta).toEqual({});
    });
  });

  describe("EntityMethodCapability", () => {
    const mockEntity = {
      id: "test-entity",
      type: "test",
      render: vi.fn().mockReturnValue("<div>Rendered</div>"),
      canRender: vi.fn().mockReturnValue(true),
      execute: vi.fn().mockReturnValue("executed"),
    };

    it("should create entity method capability", () => {
      const capability = new EntityMethodCapability(
        mockEntity,
        "render",
        "render"
      );

      expect(capability.name).toBe("render");
      expect(capability.priority).toBe(0);
    });

    it("should create entity method capability with options", () => {
      const capability = new EntityMethodCapability(
        mockEntity,
        "render",
        "render",
        {
          canHandleMethodName: "canRender",
          priority: 10,
          meta: { custom: "meta" },
        }
      );

      expect(capability.name).toBe("render");
      expect(capability.priority).toBe(10);
      expect(capability.getMeta()).toEqual({
        description: "Entity method: render",
        methodName: "render",
        custom: "meta",
        entityId: "test-entity",
        entityType: "test",
        canHandleMethodName: "canRender",
      });
    });

    it("should handle canHandle with canHandle method", () => {
      const capability = new EntityMethodCapability(
        mockEntity,
        "render",
        "render",
        { canHandleMethodName: "canRender" }
      );

      mockEntity.canRender.mockReturnValue(true);
      expect(capability.canHandle()).toBe(true);

      mockEntity.canRender.mockReturnValue(false);
      expect(capability.canHandle()).toBe(false);
    });

    it("should handle canHandle without canHandle method", () => {
      const capability = new EntityMethodCapability(
        mockEntity,
        "render",
        "render"
      );

      expect(capability.canHandle()).toBe(true); // Defaults to true when method exists
    });

    it("should execute entity method", () => {
      const capability = new EntityMethodCapability(
        mockEntity,
        "render",
        "render"
      );

      mockEntity.render.mockReturnValue("<div>Result</div>");
      const result = capability.execute();

      expect(mockEntity.render).toHaveBeenCalled();
      expect(result).toBe("<div>Result</div>");
    });

    it("should throw error when method doesn't exist", () => {
      const capability = new EntityMethodCapability(
        mockEntity,
        "nonexistent",
        "test"
      );

      expect(capability.canHandle()).toBe(false);
      expect(() => capability.execute()).toThrow(
        "Cannot execute capability test on entity test"
      );
    });

    it("should throw error when canHandle fails", () => {
      const capability = new EntityMethodCapability(
        mockEntity,
        "render",
        "render",
        { canHandleMethodName: "canRender" }
      );

      mockEntity.canRender.mockReturnValue(false);

      expect(() => capability.execute()).toThrow(
        "Cannot execute capability render on entity test"
      );
    });

    it("should handle method execution errors", () => {
      const capability = new EntityMethodCapability(
        mockEntity,
        "render",
        "render"
      );

      mockEntity.render.mockImplementation(() => {
        throw new Error("Render failed");
      });

      expect(() => capability.execute()).toThrow("Render failed");
    });

    it("should get correct meta information", () => {
      const capability = new EntityMethodCapability(
        mockEntity,
        "execute",
        "execute",
        { canHandleMethodName: "canExecute" }
      );

      const meta = capability.getMeta();
      expect(meta.entityId).toBe("test-entity");
      expect(meta.entityType).toBe("test");
      expect(meta.methodName).toBe("execute");
      expect(meta.canHandleMethodName).toBe("canExecute");
    });
  });

  describe("Integration Tests", () => {
    it("should work end-to-end with entity prototype", () => {
      const entityPrototype = {
        render: vi.fn(),
        canRender: vi.fn(),
        execute: vi.fn(),
        validate: vi.fn(),
        dispose: vi.fn(),
        customMethod: vi.fn(),
      };

      // Add custom pattern
      detector.addCapabilityPattern("custom", [/^customMethod$/]);

      const capabilities = detector.detectCapabilities(entityPrototype);
      expect(capabilities).toContain("render");
      expect(capabilities).toContain("execute");
      expect(capabilities).toContain("validate");
      expect(capabilities).toContain("lifecycle");
      expect(capabilities).toContain("custom");

      // Create capability from method
      const renderCapability = detector.createCapabilityFromMethod(
        "render",
        entityPrototype.render,
        entityPrototype
      );

      expect(renderCapability).not.toBeNull();
      expect(renderCapability?.name).toBe("render");
    });

    it("should handle complex inheritance chains", () => {
      const grandparent = {
        serialize: vi.fn(),
      };

      const parent = Object.create(grandparent);
      parent.render = vi.fn();

      const child = Object.create(parent);
      child.execute = vi.fn();

      const capabilities = detector.detectCapabilities(child);
      expect(capabilities).toContain("render");
      expect(capabilities).toContain("execute");
      expect(capabilities).toContain("serialize");
    });

    it("should handle custom capability patterns", () => {
      // Add custom pattern that doesn't conflict
      detector.addCapabilityPattern("custom", [/^customAction$/]);

      const prototype = {
        render: vi.fn(),
        execute: vi.fn(),
        customAction: vi.fn(),
      };

      const capabilities = detector.detectCapabilities(prototype);
      expect(capabilities).toContain("render");
      expect(capabilities).toContain("execute");
      expect(capabilities).toContain("custom");
    });
  });
});
