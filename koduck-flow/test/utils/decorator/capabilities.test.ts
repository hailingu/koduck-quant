import { describe, it, expect, vi } from "vitest";
import React from "react";
import type { IEntity } from "../../../src/common/entity";
import type { IRenderContext } from "../../../src/common/render";
import {
  CAPABILITY_NAMES,
  type IRenderCapability,
  type IExecuteCapability,
  type ISerializeCapability,
  type IValidateCapability,
  type ITransformCapability,
  type ILifecycleCapability,
  type SpecificCapability,
  type CapabilityName,
} from "../../../src/utils/decorator/capabilities";

describe("Decorator Capabilities", () => {
  describe("Capability Names Constants", () => {
    it("should define all capability name constants", () => {
      expect(CAPABILITY_NAMES.RENDER).toBe("render");
      expect(CAPABILITY_NAMES.EXECUTE).toBe("execute");
      expect(CAPABILITY_NAMES.SERIALIZE).toBe("serialize");
      expect(CAPABILITY_NAMES.VALIDATE).toBe("validate");
      expect(CAPABILITY_NAMES.TRANSFORM).toBe("transform");
      expect(CAPABILITY_NAMES.LIFECYCLE).toBe("lifecycle");
    });

    it("should have correct type for CapabilityName", () => {
      const renderName: CapabilityName = CAPABILITY_NAMES.RENDER;
      const executeName: CapabilityName = CAPABILITY_NAMES.EXECUTE;
      const serializeName: CapabilityName = CAPABILITY_NAMES.SERIALIZE;
      const validateName: CapabilityName = CAPABILITY_NAMES.VALIDATE;
      const transformName: CapabilityName = CAPABILITY_NAMES.TRANSFORM;
      const lifecycleName: CapabilityName = CAPABILITY_NAMES.LIFECYCLE;

      expect(renderName).toBe("render");
      expect(executeName).toBe("execute");
      expect(serializeName).toBe("serialize");
      expect(validateName).toBe("validate");
      expect(transformName).toBe("transform");
      expect(lifecycleName).toBe("lifecycle");
    });
  });

  describe("IRenderCapability interface", () => {
    it("should define render capability interface correctly", () => {
      const mockEntity = {} as IEntity;
      const mockContext = {} as IRenderContext;

      const renderCapability: IRenderCapability = {
        name: "render",
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi
          .fn()
          .mockReturnValue(React.createElement("div", null, "Test")),
        css: { color: "red" },
      };

      expect(renderCapability.name).toBe("render");
      expect(renderCapability.css).toEqual({ color: "red" });
      expect(renderCapability.canHandle(mockEntity, mockContext)).toBe(true);
      expect(renderCapability.execute(mockEntity, mockContext)).toEqual(
        React.createElement("div", null, "Test")
      );
    });

    it("should support optional css property", () => {
      const renderCapability: IRenderCapability = {
        name: "render",
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockReturnValue(null),
      };

      expect(renderCapability.css).toBeUndefined();
    });
  });

  describe("IExecuteCapability interface", () => {
    it("should define execute capability interface correctly", () => {
      const mockEntity = {} as IEntity;

      const executeCapability: IExecuteCapability = {
        name: "execute",
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockReturnValue({ success: true, data: "executed" }),
      };

      expect(executeCapability.name).toBe("execute");
      expect(executeCapability.canHandle(mockEntity, { action: "run" })).toBe(
        true
      );
      expect(executeCapability.execute(mockEntity, { action: "run" })).toEqual({
        success: true,
        data: "executed",
      });
    });
  });

  describe("ISerializeCapability interface", () => {
    it("should define serialize capability interface correctly", () => {
      const mockEntity = {} as IEntity;

      const serializeCapability: ISerializeCapability = {
        name: "serialize",
        format: "json",
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockReturnValue('{"value":42}'),
      };

      expect(serializeCapability.name).toBe("serialize");
      expect(serializeCapability.format).toBe("json");
      expect(serializeCapability.canHandle(mockEntity, { pretty: true })).toBe(
        true
      );
      expect(serializeCapability.execute(mockEntity, { pretty: true })).toBe(
        '{"value":42}'
      );
    });

    it("should support optional format", () => {
      const serializeCapability: ISerializeCapability = {
        name: "serialize",
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockReturnValue("serialized"),
      };

      expect(serializeCapability.format).toBeUndefined();
    });
  });

  describe("IValidateCapability interface", () => {
    it("should define validate capability interface correctly", () => {
      const mockEntity = {} as IEntity;

      const validateCapability: IValidateCapability = {
        name: "validate",
        rules: ["required", "string"],
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockReturnValue({ valid: true }),
      };

      expect(validateCapability.name).toBe("validate");
      expect(validateCapability.rules).toEqual(["required", "string"]);
      expect(validateCapability.canHandle(mockEntity, { strict: true })).toBe(
        true
      );
      expect(validateCapability.execute(mockEntity, { strict: true })).toEqual({
        valid: true,
      });
    });

    it("should support validation errors", async () => {
      const mockEntity = {} as IEntity;

      const validateCapability: IValidateCapability = {
        name: "validate",
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockReturnValue({
          valid: false,
          errors: ["Field is required", "Invalid format"],
        }),
      };

      const result = await validateCapability.execute(mockEntity);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(["Field is required", "Invalid format"]);
    });

    it("should support optional rules", () => {
      const validateCapability: IValidateCapability = {
        name: "validate",
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockReturnValue({ valid: true }),
      };

      expect(validateCapability.rules).toBeUndefined();
    });
  });

  describe("ITransformCapability interface", () => {
    it("should define transform capability interface correctly", () => {
      const sourceEntity = {} as IEntity;
      const transformedEntity = {} as IEntity;

      const transformCapability: ITransformCapability = {
        name: "transform",
        supportedTransforms: ["source-to-target", "target-to-source"],
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockReturnValue(transformedEntity),
      };

      expect(transformCapability.name).toBe("transform");
      expect(transformCapability.supportedTransforms).toEqual([
        "source-to-target",
        "target-to-source",
      ]);
      expect(transformCapability.canHandle(sourceEntity, "target-type")).toBe(
        true
      );
      expect(transformCapability.execute(sourceEntity, "target-type")).toBe(
        transformedEntity
      );
    });

    it("should support optional supportedTransforms", () => {
      const transformCapability: ITransformCapability = {
        name: "transform",
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockReturnValue({} as IEntity),
      };

      expect(transformCapability.supportedTransforms).toBeUndefined();
    });
  });

  describe("ILifecycleCapability interface", () => {
    it("should define lifecycle capability interface correctly", () => {
      const mockEntity = {} as IEntity;

      const lifecycleCapability: ILifecycleCapability = {
        name: "lifecycle",
        supportedPhases: ["create", "update", "destroy"],
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockReturnValue(undefined),
      };

      expect(lifecycleCapability.name).toBe("lifecycle");
      expect(lifecycleCapability.supportedPhases).toEqual([
        "create",
        "update",
        "destroy",
      ]);
      expect(lifecycleCapability.canHandle(mockEntity, "create")).toBe(true);
      expect(lifecycleCapability.execute(mockEntity, "create")).toBeUndefined();
    });

    it("should support async lifecycle operations", async () => {
      const mockEntity = {} as IEntity;

      const lifecycleCapability: ILifecycleCapability = {
        name: "lifecycle",
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockResolvedValue(undefined),
      };

      await expect(
        lifecycleCapability.execute(mockEntity, "create")
      ).resolves.toBeUndefined();
    });

    it("should support optional supportedPhases", () => {
      const lifecycleCapability: ILifecycleCapability = {
        name: "lifecycle",
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockReturnValue(undefined),
      };

      expect(lifecycleCapability.supportedPhases).toBeUndefined();
    });
  });

  describe("SpecificCapability union type", () => {
    it("should accept render capability", () => {
      const capability: SpecificCapability = {
        name: "render",
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockReturnValue(React.createElement("div")),
      };

      expect(capability.name).toBe("render");
    });

    it("should accept execute capability", () => {
      const capability: SpecificCapability = {
        name: "execute",
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockReturnValue("executed"),
      };

      expect(capability.name).toBe("execute");
    });

    it("should accept serialize capability", () => {
      const capability: SpecificCapability = {
        name: "serialize",
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockReturnValue("{}"),
      };

      expect(capability.name).toBe("serialize");
    });

    it("should accept validate capability", () => {
      const capability: SpecificCapability = {
        name: "validate",
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockReturnValue({ valid: true }),
      };

      expect(capability.name).toBe("validate");
    });

    it("should accept transform capability", () => {
      const capability: SpecificCapability = {
        name: "transform",
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockReturnValue({} as IEntity),
      };

      expect(capability.name).toBe("transform");
    });

    it("should accept lifecycle capability", () => {
      const capability: SpecificCapability = {
        name: "lifecycle",
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockReturnValue(undefined),
      };

      expect(capability.name).toBe("lifecycle");
    });
  });

  describe("Type Safety and Integration", () => {
    it("should maintain type safety across capability types", () => {
      // Test that different capability types can be used in collections
      const capabilities: SpecificCapability[] = [
        {
          name: "render",
          canHandle: () => true,
          execute: () => React.createElement("div"),
        },
        {
          name: "execute",
          canHandle: () => true,
          execute: () => "result",
        },
        {
          name: "validate",
          canHandle: () => true,
          execute: () => ({ valid: true }),
        },
      ];

      expect(capabilities).toHaveLength(3);
      expect(capabilities[0].name).toBe("render");
      expect(capabilities[1].name).toBe("execute");
      expect(capabilities[2].name).toBe("validate");
    });

    it("should support capability name type guards", () => {
      const capabilityNames: CapabilityName[] = [
        "render",
        "execute",
        "serialize",
        "validate",
        "transform",
        "lifecycle",
      ];

      capabilityNames.forEach((name) => {
        expect(typeof name).toBe("string");
        expect(
          CAPABILITY_NAMES[name.toUpperCase() as keyof typeof CAPABILITY_NAMES]
        ).toBe(name);
      });
    });

    it("should work with React elements in render capabilities", () => {
      const renderCapability: IRenderCapability = {
        name: "render",
        canHandle: () => true,
        execute: () =>
          React.createElement("button", { onClick: () => {} }, "Click me"),
      };

      const result = renderCapability.execute({} as IEntity);
      expect(React.isValidElement(result)).toBe(true);
      if (
        React.isValidElement(result) &&
        typeof result.props === "object" &&
        result.props !== null
      ) {
        expect((result.props as { children?: unknown }).children).toBe(
          "Click me"
        );
      }
    });
  });
});
