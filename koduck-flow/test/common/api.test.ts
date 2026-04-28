import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  createEntity,
  getEntity,
  removeEntity,
  hasEntity,
  getEntities,
  removeEntities,
  addToRender,
  removeFromRender,
  getRenderElement,
  createAndRender,
  removeAndStopRender,
  registerManager,
  getManager,
  hasManager,
  getAllManagerNames,
  createFlowEntity,
  getNodeParents,
  getNodeChildren,
  executeCapability,
  hasCapability,
  getEntityCapabilities,
  renderWithRenderer,
  batchRender,
  getApiRuntime,
  setApiRuntime,
  clearApiRuntime,
  getApiRuntimeInfo,
  runWithApiRuntime,
  setApiRuntimeConfig,
  getApiRuntimeConfig,
  resetApiRuntimeConfig,
  KoduckFlowRuntimeMissingError,
  addApiRuntimeMissingListener,
  removeApiRuntimeMissingListener,
  addApiRuntimeFallbackListener,
  removeApiRuntimeFallbackListener,
} from "../../src/common/api";
import * as EntityApiModule from "../../src/common/api/entity";
import * as RenderApiModule from "../../src/common/api/render";
import * as ManagerApiModule from "../../src/common/api/manager";
import * as FlowApiModule from "../../src/common/api/flow";
import * as RuntimeApiModule from "../../src/common/api/runtime";
import { runtime } from "../../src/common/api/runtime-context";
import type { IEntity } from "../../src/common/entity/types";
import type { KoduckFlowRuntime } from "../../src/common/runtime";

vi.mock("../../src/common/logger", () => {
  const info = vi.fn();
  const warn = vi.fn();
  const error = vi.fn();
  const debug = vi.fn();
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

// Mock runtime proxy
vi.mock("../../src/common/api/runtime-context", async () => {
  const actual = await vi.importActual<typeof import("../../src/common/api/runtime-context")>(
    "../../src/common/api/runtime-context"
  );

  const runtimeMock = {
    createEntity: vi.fn(),
    getEntity: vi.fn(),
    removeEntity: vi.fn(),
    hasEntity: vi.fn(),
    getEntities: vi.fn(),
    removeEntities: vi.fn(),
    addEntityToRender: vi.fn(),
    removeEntityFromRender: vi.fn(),
    getEntityRenderElement: vi.fn(),
    registerManager: vi.fn(),
    getManager: vi.fn(),
    hasManager: vi.fn(),
    getRegisteredManagers: vi.fn(),
    EntityManager: {
      getEntities: vi.fn(),
      getEntity: vi.fn(),
      updateEntity: vi.fn(),
    },
  };

  return {
    ...actual,
    runtime: runtimeMock,
    getRuntimeProxy: vi.fn(() => runtimeMock),
  };
});

const createMockEntity = (overrides: Partial<IEntity> = {}): IEntity => {
  const base: IEntity = {
    id: "test-entity",
    type: "TestEntity",
    data: undefined,
    config: undefined,
    dispose: vi.fn<IEntity["dispose"]>(),
  };

  return { ...base, ...overrides };
};

describe("API Functions", () => {
  describe("Module export alignment", () => {
    test("entity module re-exports match root API", () => {
      expect(EntityApiModule.createEntity).toBe(createEntity);
      expect(EntityApiModule.getEntity).toBe(getEntity);
      expect(EntityApiModule.removeEntity).toBe(removeEntity);
      expect(EntityApiModule.hasEntity).toBe(hasEntity);
      expect(EntityApiModule.getEntities).toBe(getEntities);
      expect(EntityApiModule.removeEntities).toBe(removeEntities);
      expect(EntityApiModule.executeCapability).toBe(executeCapability);
      expect(EntityApiModule.hasCapability).toBe(hasCapability);
      expect(EntityApiModule.getEntityCapabilities).toBe(getEntityCapabilities);
    });

    test("render module re-exports match root API", () => {
      expect(RenderApiModule.addToRender).toBe(addToRender);
      expect(RenderApiModule.removeFromRender).toBe(removeFromRender);
      expect(RenderApiModule.getRenderElement).toBe(getRenderElement);
      expect(RenderApiModule.createAndRender).toBe(createAndRender);
      expect(RenderApiModule.removeAndStopRender).toBe(removeAndStopRender);
      expect(RenderApiModule.renderWithRenderer).toBe(renderWithRenderer);
      expect(RenderApiModule.batchRender).toBe(batchRender);
    });

    test("manager module re-exports match root API", () => {
      expect(ManagerApiModule.registerManager).toBe(registerManager);
      expect(ManagerApiModule.getManager).toBe(getManager);
      expect(ManagerApiModule.hasManager).toBe(hasManager);
      expect(ManagerApiModule.getAllManagerNames).toBe(getAllManagerNames);
    });

    test("flow module re-exports match root API", () => {
      expect(FlowApiModule.createFlowEntity).toBe(createFlowEntity);
      expect(FlowApiModule.getNodeParents).toBe(getNodeParents);
      expect(FlowApiModule.getNodeChildren).toBe(getNodeChildren);
    });

    test("runtime module re-exports match root API", () => {
      expect(RuntimeApiModule.getApiRuntime).toBe(getApiRuntime);
      expect(RuntimeApiModule.setApiRuntime).toBe(setApiRuntime);
      expect(RuntimeApiModule.clearApiRuntime).toBe(clearApiRuntime);
      expect(RuntimeApiModule.getApiRuntimeInfo).toBe(getApiRuntimeInfo);
      expect(RuntimeApiModule.runWithApiRuntime).toBe(runWithApiRuntime);
      expect(RuntimeApiModule.setApiRuntimeConfig).toBe(setApiRuntimeConfig);
      expect(RuntimeApiModule.getApiRuntimeConfig).toBe(getApiRuntimeConfig);
      expect(RuntimeApiModule.resetApiRuntimeConfig).toBe(resetApiRuntimeConfig);
      expect(RuntimeApiModule.KoduckFlowRuntimeMissingError).toBe(KoduckFlowRuntimeMissingError);
      expect(RuntimeApiModule.addApiRuntimeMissingListener).toBe(addApiRuntimeMissingListener);
      expect(RuntimeApiModule.removeApiRuntimeMissingListener).toBe(
        removeApiRuntimeMissingListener
      );
      expect(RuntimeApiModule.addApiRuntimeFallbackListener).toBe(addApiRuntimeFallbackListener);
      expect(RuntimeApiModule.removeApiRuntimeFallbackListener).toBe(
        removeApiRuntimeFallbackListener
      );
    });
  });
  let mockEntity: IEntity;
  let mockManager: Record<string, unknown>;
  let apiRuntimeToken: symbol | null;

  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRuntimeConfig();

    mockEntity = createMockEntity();

    mockManager = {
      name: "test-manager",
      type: "TestManager",
      dispose: vi.fn(),
    }; // Setup default mocks
    vi.mocked(runtime.createEntity).mockReturnValue(mockEntity);
    vi.mocked(runtime.getEntity).mockReturnValue(mockEntity);
    vi.mocked(runtime.removeEntity).mockReturnValue(true);
    vi.mocked(runtime.hasEntity).mockReturnValue(true);
    vi.mocked(runtime.getEntities).mockReturnValue([mockEntity]);
    vi.mocked(runtime.removeEntities).mockReturnValue(1);
    vi.mocked(runtime.addEntityToRender).mockImplementation(() => {});
    vi.mocked(runtime.removeEntityFromRender).mockImplementation(() => {});
    vi.mocked(runtime.getEntityRenderElement).mockReturnValue(null);
    vi.mocked(runtime.registerManager).mockImplementation(() => {});
    vi.mocked(runtime.getManager).mockReturnValue(
      mockManager as unknown as ReturnType<typeof runtime.getManager>
    );
    vi.mocked(runtime.hasManager).mockReturnValue(true);
    vi.mocked(runtime.getRegisteredManagers).mockReturnValue(["test-manager"]);

    apiRuntimeToken = setApiRuntime(runtime as unknown as KoduckFlowRuntime, {
      source: "test-suite",
      environment: { environment: "test-suite" },
    });
  });

  afterEach(() => {
    clearApiRuntime(apiRuntimeToken);
    apiRuntimeToken = null;
    vi.clearAllTimers();
    resetApiRuntimeConfig();
  });

  describe("Entity Operations", () => {
    test("createEntity should create entity successfully", () => {
      const result = createEntity("TestEntity", { name: "test" });

      expect(runtime.createEntity).toHaveBeenCalledWith("TestEntity", {
        name: "test",
      });
      expect(result).toBe(mockEntity);
    });

    test("createEntity should handle null return from runtime", () => {
      vi.mocked(runtime.createEntity).mockReturnValue(null);

      const result = createEntity("TestEntity");

      expect(result).toBeNull();
    });

    test("getEntity should get entity successfully", () => {
      const result = getEntity("test-id");

      expect(runtime.getEntity).toHaveBeenCalledWith("test-id");
      expect(result).toBe(mockEntity);
    });

    test("getEntity should handle undefined return", () => {
      vi.mocked(runtime.getEntity).mockReturnValue(undefined);

      const result = getEntity("non-existent");

      expect(result).toBeUndefined();
    });

    test("removeEntity should remove entity successfully", () => {
      const result = removeEntity("test-id");

      expect(runtime.removeEntity).toHaveBeenCalledWith("test-id");
      expect(result).toBe(true);
    });

    test("hasEntity should check entity existence", () => {
      const result = hasEntity("test-id");

      expect(runtime.hasEntity).toHaveBeenCalledWith("test-id");
      expect(result).toBe(true);
    });

    test("hasEntity should handle non-existent entity", () => {
      vi.mocked(runtime.hasEntity).mockReturnValue(false);

      const result = hasEntity("non-existent");

      expect(result).toBe(false);
    });

    test("getEntities should return all entities", () => {
      const result = getEntities();

      expect(runtime.getEntities).toHaveBeenCalled();
      expect(result).toEqual([mockEntity]);
    });

    test("removeEntities should remove multiple entities", () => {
      const result = removeEntities(["id1", "id2"]);

      expect(runtime.removeEntities).toHaveBeenCalledWith(["id1", "id2"]);
      expect(result).toBe(1);
    });
  });

  describe("Runtime Injection", () => {
    test("setApiRuntime provides metadata for API calls", () => {
      const info = getApiRuntimeInfo();
      expect(info.isLegacyFallback).toBe(false);
      expect(info.source).toBe("test-suite");
      expect(info.environment).toEqual({ environment: "test-suite" });
    });

    test("runWithApiRuntime temporarily overrides runtime", () => {
      const originalInfo = getApiRuntimeInfo();
      const alternateRuntime = {
        ...runtime,
        __runtime: "alternate",
      } as unknown as KoduckFlowRuntime;
      const alternateEnvironment = {
        environment: "alternate",
        tenantId: "tenant-42",
      } as const;

      const result = runWithApiRuntime(
        alternateRuntime,
        () => {
          const info = getApiRuntimeInfo();
          expect(info.isLegacyFallback).toBe(false);
          expect(info.source).toBe("alternate");
          expect(info.environment).toEqual(alternateEnvironment);
          return "done";
        },
        {
          source: "alternate",
          environment: alternateEnvironment,
        }
      );

      expect(result).toBe("done");
      const restoredInfo = getApiRuntimeInfo();
      expect(restoredInfo.source).toBe(originalInfo.source);
    });

    test("getApiRuntime throws when runtime is missing by default", () => {
      clearApiRuntime(apiRuntimeToken);
      apiRuntimeToken = null;

      expect(() => getApiRuntime()).toThrow(KoduckFlowRuntimeMissingError);
    });

    describe("Runtime configuration", () => {
      test("returns undefined handler by default", () => {
        const config = getApiRuntimeConfig();

        expect(config.onMissingRuntime).toBeUndefined();
      });

      test("setApiRuntimeConfig registers missing runtime handler", () => {
        clearApiRuntime(apiRuntimeToken);
        apiRuntimeToken = null;
        const handler = vi.fn();

        setApiRuntimeConfig({ onMissingRuntime: handler });

        expect(() => getApiRuntime()).toThrow(KoduckFlowRuntimeMissingError);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0]).toMatchObject({
          metadata: { source: "global-runtime" },
        });
      });

      test("resetApiRuntimeConfig clears missing runtime handler", () => {
        const handler = vi.fn();
        setApiRuntimeConfig({ onMissingRuntime: handler });

        resetApiRuntimeConfig();

        expect(getApiRuntimeConfig().onMissingRuntime).toBeUndefined();
      });
    });

    describe("Runtime missing listeners", () => {
      test("listeners are notified when runtime is missing", () => {
        clearApiRuntime(apiRuntimeToken);
        apiRuntimeToken = null;
        resetApiRuntimeConfig();

        const listener = vi.fn();
        const dispose = addApiRuntimeMissingListener(listener);

        try {
          expect(() => getApiRuntime()).toThrow(KoduckFlowRuntimeMissingError);
          expect(listener).toHaveBeenCalledTimes(1);
          expect(listener.mock.calls[0][0]).toMatchObject({
            metadata: { source: "global-runtime" },
          });
        } finally {
          dispose();
          removeApiRuntimeMissingListener(listener);
        }
      });
    });
  });

  describe("Render Operations", () => {
    test("addToRender should add entity to render queue", () => {
      addToRender(mockEntity);

      expect(runtime.addEntityToRender).toHaveBeenCalledWith(mockEntity);
    });

    test("removeFromRender should remove entity from render queue", () => {
      removeFromRender("test-id");

      expect(runtime.removeEntityFromRender).toHaveBeenCalledWith("test-id");
    });

    test("getRenderElement should get render element", () => {
      const result = getRenderElement("test-id");

      expect(runtime.getEntityRenderElement).toHaveBeenCalledWith("test-id");
      expect(result).toBe(null);
    });

    test("createAndRender should create and add to render", () => {
      const result = createAndRender("TestEntity");

      expect(runtime.createEntity).toHaveBeenCalledWith("TestEntity", undefined);
      expect(runtime.addEntityToRender).toHaveBeenCalledWith(mockEntity);
      expect(result).toBe(mockEntity);
    });

    test("createAndRender should handle null entity creation", () => {
      vi.mocked(runtime.createEntity).mockReturnValue(null);

      const result = createAndRender("TestEntity");

      expect(runtime.addEntityToRender).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    test("removeAndStopRender should remove and stop render", () => {
      const result = removeAndStopRender("test-id");

      expect(runtime.removeEntityFromRender).toHaveBeenCalledWith("test-id");
      expect(runtime.removeEntity).toHaveBeenCalledWith("test-id");
      expect(result).toBe(true);
    });
  });

  describe("Manager Operations", () => {
    test("registerManager should register manager successfully", () => {
      const result = registerManager("test-manager", mockManager);

      expect(runtime.registerManager).toHaveBeenCalledWith("test-manager", mockManager, undefined);
      expect(result).toBe(true);
    });

    test("registerManager should handle registration error", () => {
      vi.mocked(runtime.registerManager).mockImplementation(() => {
        throw new Error("Registration failed");
      });

      const result = registerManager("test-manager", mockManager);

      expect(result).toBe(false);
    });

    test("getManager should get manager successfully", () => {
      const result = getManager("test-manager");

      expect(runtime.getManager).toHaveBeenCalledWith("test-manager");
      expect(result).toBe(mockManager);
    });

    test("getManager should handle undefined manager", () => {
      vi.mocked(runtime.getManager).mockReturnValue(undefined);

      const result = getManager("non-existent");

      expect(result).toBeUndefined();
    });

    test("getManager should handle error", () => {
      vi.mocked(runtime.getManager).mockImplementation(() => {
        throw new Error("Get failed");
      });

      const result = getManager("test-manager");

      expect(result).toBeUndefined();
    });

    test("hasManager should check manager existence", () => {
      const result = hasManager("test-manager");

      expect(runtime.hasManager).toHaveBeenCalledWith("test-manager");
      expect(result).toBe(true);
    });

    test("hasManager should handle non-existent manager", () => {
      vi.mocked(runtime.hasManager).mockReturnValue(false);

      const result = hasManager("non-existent");

      expect(result).toBe(false);
    });

    test("hasManager should handle error", () => {
      vi.mocked(runtime.hasManager).mockImplementation(() => {
        throw new Error("Check failed");
      });

      const result = hasManager("test-manager");

      expect(result).toBe(false);
    });

    test("getAllManagerNames should return manager names", () => {
      const result = getAllManagerNames();

      expect(runtime.getRegisteredManagers).toHaveBeenCalled();
      expect(result).toEqual(["test-manager"]);
    });

    test("getAllManagerNames should handle error", () => {
      vi.mocked(runtime.getRegisteredManagers).mockImplementation(() => {
        throw new Error("Get names failed");
      });

      const result = getAllManagerNames();

      expect(result).toEqual([]);
    });
  });

  describe("Flow Operations", () => {
    test("createFlowEntity should create flow entity", () => {
      const result = createFlowEntity("ProcessNode", { name: "test" });

      expect(runtime.createEntity).toHaveBeenCalledWith("FlowEntity", {
        type: "ProcessNode",
        data: { name: "test" },
        config: undefined,
      });
      expect(result).toBe(mockEntity);
    });

    test("createFlowEntity should handle creation error", () => {
      vi.mocked(runtime.createEntity).mockImplementation(() => {
        throw new Error("Creation failed");
      });

      const result = createFlowEntity("ProcessNode", { name: "test" });

      expect(result).toBeNull();
    });

    test("getNodeParents should get node parents", () => {
      const mockEntityWithNode = {
        ...mockEntity,
        node: {
          parents: ["parent1", "parent2"],
        },
      };
      vi.mocked(runtime.getEntity).mockReturnValue(mockEntityWithNode);

      const result = getNodeParents("test-id");

      expect(result).toEqual(["parent1", "parent2"]);
    });

    test("getNodeParents should handle entity without node", () => {
      const result = getNodeParents("test-id");

      expect(result).toEqual([]);
    });

    test("getNodeParents should handle invalid parents", () => {
      const mockEntityWithNode = {
        ...mockEntity,
        node: {
          parents: "invalid",
        },
      };
      vi.mocked(runtime.getEntity).mockReturnValue(mockEntityWithNode);

      const result = getNodeParents("test-id");

      expect(result).toEqual([]);
    });

    test("getNodeParents should handle error", () => {
      vi.mocked(runtime.getEntity).mockImplementation(() => {
        throw new Error("Get failed");
      });

      const result = getNodeParents("test-id");

      expect(result).toEqual([]);
    });

    test("getNodeChildren should get node children", () => {
      const mockEntityWithNode = {
        ...mockEntity,
        node: {
          children: ["child1", "child2"],
        },
      };
      vi.mocked(runtime.getEntity).mockReturnValue(mockEntityWithNode);

      const result = getNodeChildren("test-id");

      expect(result).toEqual(["child1", "child2"]);
    });

    test("getNodeChildren should handle entity without node", () => {
      const result = getNodeChildren("test-id");

      expect(result).toEqual([]);
    });

    test("getNodeChildren should handle invalid children", () => {
      const mockEntityWithNode = {
        ...mockEntity,
        node: {
          children: "invalid",
        },
      };
      vi.mocked(runtime.getEntity).mockReturnValue(mockEntityWithNode);

      const result = getNodeChildren("test-id");

      expect(result).toEqual([]);
    });

    test("getNodeChildren should handle error", () => {
      vi.mocked(runtime.getEntity).mockImplementation(() => {
        throw new Error("Get failed");
      });

      const result = getNodeChildren("test-id");

      expect(result).toEqual([]);
    });
  });

  describe("Capability Operations", () => {
    test("executeCapability should execute capability successfully", async () => {
      const mockEntityWithCapability = {
        ...mockEntity,
        hasCapability: vi.fn().mockReturnValue(true),
        executeCapability: vi.fn().mockResolvedValue("result"),
      };

      const result = await executeCapability(mockEntityWithCapability, "render", "context");

      expect(mockEntityWithCapability.hasCapability).toHaveBeenCalledWith("render");
      expect(mockEntityWithCapability.executeCapability).toHaveBeenCalledWith("render", "context");
      expect(result).toBe("result");
    });

    test("executeCapability should return null when entity lacks capability", async () => {
      const mockEntityWithCapability = {
        ...mockEntity,
        hasCapability: vi.fn().mockReturnValue(false),
      };

      const result = await executeCapability(mockEntityWithCapability, "render");

      expect(result).toBeNull();
    });

    test("executeCapability should return null when entity has no capability methods", async () => {
      const result = await executeCapability(mockEntity, "render");

      expect(result).toBeNull();
    });

    test("executeCapability should handle execution error", async () => {
      const mockEntityWithCapability = {
        ...mockEntity,
        hasCapability: vi.fn().mockReturnValue(true),
        executeCapability: vi.fn().mockImplementation(() => {
          throw new Error("Execution failed");
        }),
      };

      const result = await executeCapability(mockEntityWithCapability, "render");

      expect(result).toBeNull();
    });

    test("hasCapability should check capability existence", () => {
      const mockEntityWithCapability = {
        ...mockEntity,
        hasCapability: vi.fn().mockReturnValue(true),
      };

      const result = hasCapability(mockEntityWithCapability, "render");

      expect(mockEntityWithCapability.hasCapability).toHaveBeenCalledWith("render");
      expect(result).toBe(true);
    });

    test("hasCapability should return false when entity has no capability method", () => {
      const result = hasCapability(mockEntity, "render");

      expect(result).toBe(false);
    });

    test("hasCapability should handle error", () => {
      const mockEntityWithCapability = {
        ...mockEntity,
        hasCapability: vi.fn().mockImplementation(() => {
          throw new Error("Check failed");
        }),
      };

      const result = hasCapability(mockEntityWithCapability, "render");

      expect(result).toBe(false);
    });

    test("getEntityCapabilities should get entity capabilities", () => {
      const mockEntityWithCapability = {
        ...mockEntity,
        getCapabilities: vi.fn().mockReturnValue(["render", "execute"]),
      };

      const result = getEntityCapabilities(mockEntityWithCapability);

      expect(mockEntityWithCapability.getCapabilities).toHaveBeenCalled();
      expect(result).toEqual(["render", "execute"]);
    });

    test("getEntityCapabilities should return empty array when entity has no method", () => {
      const result = getEntityCapabilities(mockEntity);

      expect(result).toEqual([]);
    });

    test("getEntityCapabilities should handle error", () => {
      const mockEntityWithCapability = {
        ...mockEntity,
        getCapabilities: vi.fn().mockImplementation(() => {
          throw new Error("Get failed");
        }),
      };

      const result = getEntityCapabilities(mockEntityWithCapability);

      expect(result).toEqual([]);
    });
  });

  describe("Advanced Render Operations", () => {
    test("renderWithRenderer should render with specified renderer", async () => {
      const mockRenderElement = React.createElement("div", null, "Test");
      const mockRenderManager = {
        name: "render-manager",
        type: "RenderManager",
        dispose: vi.fn(),
        setDefaultRenderer: vi.fn(),
        render: vi.fn().mockResolvedValue(mockRenderElement),
      };
      vi.mocked(runtime.getManager).mockReturnValue(
        mockRenderManager as unknown as ReturnType<typeof runtime.getManager>
      );

      const result = await renderWithRenderer(mockEntity, "react", {
        context: "test",
      });

      expect(runtime.getManager).toHaveBeenCalledWith("render");
      expect(mockRenderManager.setDefaultRenderer).toHaveBeenCalledWith("react");
      expect(mockRenderManager.render).toHaveBeenCalledWith(mockEntity, {
        context: "test",
      });
      expect(result).toBe(mockRenderElement);
    });

    test("renderWithRenderer should handle render manager not available", async () => {
      vi.mocked(runtime.getManager).mockReturnValue(undefined);

      const result = await renderWithRenderer(mockEntity, "react");

      expect(result).toBeNull();
    });

    test("renderWithRenderer should handle render error", async () => {
      const mockRenderManager = {
        name: "render-manager",
        type: "RenderManager",
        dispose: vi.fn(),
        setDefaultRenderer: vi.fn(),
        render: vi.fn().mockImplementation(() => {
          throw new Error("Render failed");
        }),
      };
      vi.mocked(runtime.getManager).mockReturnValue(
        mockRenderManager as unknown as ReturnType<typeof runtime.getManager>
      );

      const result = await renderWithRenderer(mockEntity, "canvas");

      expect(result).toBeNull();
    });

    test("batchRender should render multiple entities", async () => {
      const mockElements = [
        React.createElement("div", null, "Entity1"),
        React.createElement("div", null, "Entity2"),
      ];
      const mockRenderManager = {
        name: "render-manager",
        type: "RenderManager",
        dispose: vi.fn(),
        batchRender: vi.fn().mockResolvedValue(mockElements),
      };
      vi.mocked(runtime.getManager).mockReturnValue(
        mockRenderManager as unknown as ReturnType<typeof runtime.getManager>
      );

      const entities = [mockEntity, { ...mockEntity, id: "entity2" }];
      const result = await batchRender(entities, { context: "test" });

      expect(mockRenderManager.batchRender).toHaveBeenCalledWith(entities, {
        context: "test",
      });
      expect(result).toEqual(mockElements);
    });

    test("batchRender should fallback to individual rendering", async () => {
      const mockElement = React.createElement("div", null, "Test");
      const mockRenderManager = {
        name: "render-manager",
        type: "RenderManager",
        dispose: vi.fn(),
        render: vi.fn().mockResolvedValue(mockElement),
      };
      vi.mocked(runtime.getManager).mockReturnValue(
        mockRenderManager as unknown as ReturnType<typeof runtime.getManager>
      );

      const entities = [mockEntity];
      const result = await batchRender(entities);

      expect(mockRenderManager.render).toHaveBeenCalledWith(mockEntity, undefined);
      expect(result).toEqual([mockElement]);
    });

    test("batchRender should handle render manager not available", async () => {
      vi.mocked(runtime.getManager).mockReturnValue(undefined);

      const result = await batchRender([mockEntity]);

      expect(result).toEqual([]);
    });

    test("batchRender should handle render error", async () => {
      const mockRenderManager = {
        name: "render-manager",
        type: "RenderManager",
        dispose: vi.fn(),
        batchRender: vi.fn().mockImplementation(() => {
          throw new Error("Batch render failed");
        }),
      };
      vi.mocked(runtime.getManager).mockReturnValue(
        mockRenderManager as unknown as ReturnType<typeof runtime.getManager>
      );

      const result = await batchRender([mockEntity]);

      expect(result).toEqual([]);
    });
  });

  // System Access tests removed - getDeity() API no longer exists after deity removal
});
