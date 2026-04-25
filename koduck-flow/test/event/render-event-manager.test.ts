import { describe, test, expect, beforeEach, vi } from "vitest";
import {
  RenderEventManager,
  createRenderEventManager,
  type RenderAllPayload,
  type RenderEntitiesPayload,
  type ViewportChangedPayload,
} from "../../src/common/event/render-event-manager";

describe("RenderEventManager", () => {
  let renderManager: RenderEventManager;

  beforeEach(() => {
    renderManager = createRenderEventManager();
  });

  describe("实例创建", () => {
    test("应该导出创建函数", () => {
      expect(createRenderEventManager).toBeDefined();
      expect(typeof createRenderEventManager).toBe("function");
    });

    test("createRenderEventManager 每次调用返回独立实例", () => {
      const instance1 = createRenderEventManager();
      const instance2 = createRenderEventManager();

      expect(instance1).toBeInstanceOf(RenderEventManager);
      expect(instance2).toBeInstanceOf(RenderEventManager);
      expect(instance1).not.toBe(instance2);

      instance1.requestRenderAll({ reason: "sanity" });
      instance2.requestRenderAll({ reason: "sanity" });
    });

    test("仍然支持直接实例化", () => {
      const instance = new RenderEventManager();
      expect(instance).toBeInstanceOf(RenderEventManager);
    });
  });

  describe("RenderAll Events", () => {
    test("应该正确订阅renderAll事件", () => {
      const listener = vi.fn();
      const unsubscribe = renderManager.onRenderAll(listener);

      expect(typeof unsubscribe).toBe("function");
    });

    test("应该正确触发renderAll事件", () => {
      const listener = vi.fn();
      renderManager.onRenderAll(listener);

      const payload: RenderAllPayload = {
        reason: "test render",
        hints: {
          onlyEntities: ["entity1", "entity2"],
          onlyLayers: ["layer1"],
        },
      };

      renderManager.requestRenderAll(payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    test("应该处理空payload的renderAll请求", () => {
      const listener = vi.fn();
      renderManager.onRenderAll(listener);

      renderManager.requestRenderAll();

      expect(listener).toHaveBeenCalledWith({});
    });

    test("应该正确处理undefined payload", () => {
      const listener = vi.fn();
      renderManager.onRenderAll(listener);

      renderManager.requestRenderAll(undefined);

      expect(listener).toHaveBeenCalledWith({});
    });

    test("应该支持多个监听器", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      renderManager.onRenderAll(listener1);
      renderManager.onRenderAll(listener2);

      const payload: RenderAllPayload = { reason: "multi-listener test" };
      renderManager.requestRenderAll(payload);

      expect(listener1).toHaveBeenCalledWith(payload);
      expect(listener2).toHaveBeenCalledWith(payload);
    });

    test("应该支持取消订阅", () => {
      const listener = vi.fn();
      const unsubscribe = renderManager.onRenderAll(listener);

      unsubscribe();
      renderManager.requestRenderAll({ reason: "after unsubscribe" });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("RenderEntities Events", () => {
    test("应该正确订阅renderEntities事件", () => {
      const listener = vi.fn();
      const unsubscribe = renderManager.onRenderEntities(listener);

      expect(typeof unsubscribe).toBe("function");
    });

    test("应该正确触发renderEntities事件", () => {
      const listener = vi.fn();
      renderManager.onRenderEntities(listener);

      const payload: RenderEntitiesPayload = {
        entityIds: ["entity1", "entity2"],
        reason: "entity update",
        op: "render",
      };

      renderManager.requestRenderEntities(payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    test("应该去重entityIds", () => {
      const listener = vi.fn();
      renderManager.onRenderEntities(listener);

      const payload: RenderEntitiesPayload = {
        entityIds: ["entity1", "entity2", "entity1", "entity3", "entity2"],
        reason: "duplicate test",
      };

      renderManager.requestRenderEntities(payload);

      expect(listener).toHaveBeenCalledWith({
        ...payload,
        entityIds: ["entity1", "entity2", "entity3"],
      });
    });

    test("应该处理空entityIds数组", () => {
      const listener = vi.fn();
      renderManager.onRenderEntities(listener);

      const payload: RenderEntitiesPayload = {
        entityIds: [],
        reason: "empty array test",
      };

      renderManager.requestRenderEntities(payload);

      expect(listener).not.toHaveBeenCalled();
    });

    test("应该处理无效的payload", () => {
      const listener = vi.fn();
      renderManager.onRenderEntities(listener);

      // 测试 null payload
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      renderManager.requestRenderEntities(null as any);
      expect(listener).not.toHaveBeenCalled();

      // 测试 undefined payload
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      renderManager.requestRenderEntities(undefined as any);
      expect(listener).not.toHaveBeenCalled();

      // 测试 非数组 entityIds
      renderManager.requestRenderEntities({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        entityIds: "not-an-array" as any,
        reason: "invalid test",
      });
      expect(listener).not.toHaveBeenCalled();
    });

    test("应该支持remove操作", () => {
      const listener = vi.fn();
      renderManager.onRenderEntities(listener);

      const payload: RenderEntitiesPayload = {
        entityIds: ["entity1"],
        reason: "remove test",
        op: "remove",
      };

      renderManager.requestRenderEntities(payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    test("应该默认为render操作", () => {
      const listener = vi.fn();
      renderManager.onRenderEntities(listener);

      const payload: RenderEntitiesPayload = {
        entityIds: ["entity1"],
        reason: "default op test",
      };

      renderManager.requestRenderEntities(payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    test("应该支持取消订阅", () => {
      const listener = vi.fn();
      const unsubscribe = renderManager.onRenderEntities(listener);

      unsubscribe();
      renderManager.requestRenderEntities({
        entityIds: ["entity1"],
        reason: "after unsubscribe",
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("ViewportChanged Events", () => {
    test("应该正确订阅viewportChanged事件", () => {
      const listener = vi.fn();
      const unsubscribe = renderManager.onViewportChanged(listener);

      expect(typeof unsubscribe).toBe("function");
    });

    test("应该正确触发viewportChanged事件", () => {
      const listener = vi.fn();
      renderManager.onViewportChanged(listener);

      const payload: ViewportChangedPayload = {
        x: 100,
        y: 200,
        zoom: 1.5,
        size: { w: 800, h: 600 },
      };

      renderManager.notifyViewportChanged(payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    test("应该处理不带size的viewport变化", () => {
      const listener = vi.fn();
      renderManager.onViewportChanged(listener);

      const payload: ViewportChangedPayload = {
        x: 50,
        y: 75,
        zoom: 2.0,
      };

      renderManager.notifyViewportChanged(payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    test("应该支持负数坐标", () => {
      const listener = vi.fn();
      renderManager.onViewportChanged(listener);

      const payload: ViewportChangedPayload = {
        x: -100,
        y: -200,
        zoom: 0.5,
      };

      renderManager.notifyViewportChanged(payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    test("应该支持零缩放", () => {
      const listener = vi.fn();
      renderManager.onViewportChanged(listener);

      const payload: ViewportChangedPayload = {
        x: 0,
        y: 0,
        zoom: 0,
      };

      renderManager.notifyViewportChanged(payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    test("应该支持取消订阅", () => {
      const listener = vi.fn();
      const unsubscribe = renderManager.onViewportChanged(listener);

      unsubscribe();
      renderManager.notifyViewportChanged({
        x: 0,
        y: 0,
        zoom: 1,
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("Event Integration", () => {
    test("应该支持多种事件同时工作", () => {
      const renderAllListener = vi.fn();
      const renderEntitiesListener = vi.fn();
      const viewportListener = vi.fn();

      renderManager.onRenderAll(renderAllListener);
      renderManager.onRenderEntities(renderEntitiesListener);
      renderManager.onViewportChanged(viewportListener);

      // 触发所有类型的事件
      renderManager.requestRenderAll({ reason: "integration test" });
      renderManager.requestRenderEntities({
        entityIds: ["entity1"],
        reason: "integration test",
      });
      renderManager.notifyViewportChanged({
        x: 100,
        y: 100,
        zoom: 1.0,
      });

      expect(renderAllListener).toHaveBeenCalledTimes(1);
      expect(renderEntitiesListener).toHaveBeenCalledTimes(1);
      expect(viewportListener).toHaveBeenCalledTimes(1);
    });

    test("应该正确处理复杂的渲染场景", () => {
      const renderAllListener = vi.fn();
      const renderEntitiesListener = vi.fn();

      renderManager.onRenderAll(renderAllListener);
      renderManager.onRenderEntities(renderEntitiesListener);

      // 复杂渲染场景
      renderManager.requestRenderAll({
        reason: "complex scenario",
        hints: {
          onlyEntities: ["entity1", "entity2", "entity3"],
          onlyLayers: ["layer1", "layer2"],
        },
      });

      renderManager.requestRenderEntities({
        entityIds: ["entity4", "entity5", "entity4"], // 包含重复
        reason: "complex entities",
        op: "render",
      });

      expect(renderAllListener).toHaveBeenCalledWith({
        reason: "complex scenario",
        hints: {
          onlyEntities: ["entity1", "entity2", "entity3"],
          onlyLayers: ["layer1", "layer2"],
        },
      });

      expect(renderEntitiesListener).toHaveBeenCalledWith({
        entityIds: ["entity4", "entity5"], // 重复已去除
        reason: "complex entities",
        op: "render",
      });
    });

    test("应该正确处理事件取消订阅的混合场景", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      const unsubscribe1 = renderManager.onRenderAll(listener1);
      const unsubscribe2 = renderManager.onRenderEntities(listener2);
      const unsubscribe3 = renderManager.onViewportChanged(listener3);

      // 取消部分订阅
      unsubscribe2();

      // 触发所有事件
      renderManager.requestRenderAll({ reason: "mixed unsubscribe test" });
      renderManager.requestRenderEntities({
        entityIds: ["entity1"],
        reason: "mixed unsubscribe test",
      });
      renderManager.notifyViewportChanged({
        x: 0,
        y: 0,
        zoom: 1,
      });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).not.toHaveBeenCalled(); // 已取消订阅
      expect(listener3).toHaveBeenCalledTimes(1);

      // 清理剩余订阅
      unsubscribe1();
      unsubscribe3();
    });
  });

  describe("Type Aliases", () => {
    test("应该正确导出类型别名", () => {
      // 这些类型别名应该在编译时可用
      // 我们通过实际使用来测试
      const renderAllEvent: import("../../src/common/event/render-event-manager").RenderAllEvent =
        {
          reason: "type alias test",
        };

      const renderEntitiesEvent: import("../../src/common/event/render-event-manager").RenderEntitiesEvent =
        {
          entityIds: ["entity1"],
          op: "render",
        };

      expect(renderAllEvent.reason).toBe("type alias test");
      expect(renderEntitiesEvent.entityIds).toEqual(["entity1"]);
    });
  });

  describe("Event Configuration", () => {
    test("应该为renderAll禁用批处理", () => {
      // 由于无法直接访问私有字段，我们通过行为测试
      // renderAll应该立即触发，不会被批处理延迟
      const listener = vi.fn();
      renderManager.onRenderAll(listener);

      renderManager.requestRenderAll({ reason: "immediate test" });

      // 立即检查，应该已经被调用
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test("应该为renderEntities启用批处理", async () => {
      // renderEntities配置了批处理：batchSize: 200, batchInterval: 16ms
      const listener = vi.fn();
      renderManager.onRenderEntities(listener);

      // 快速发送多个请求
      for (let i = 0; i < 5; i++) {
        renderManager.requestRenderEntities({
          entityIds: [`entity${i}`],
          reason: `batch test ${i}`,
        });
      }

      // 由于批处理的存在，监听器可能还没有被调用或者批量调用
      // 这里我们验证至少会被调用
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(listener).toHaveBeenCalled();
    });

    test("应该为viewportChanged启用批处理", async () => {
      // viewportChanged配置了批处理：batchSize: 1, batchInterval: 16ms
      const listener = vi.fn();
      renderManager.onViewportChanged(listener);

      // 快速发送多个viewport变化
      for (let i = 0; i < 3; i++) {
        renderManager.notifyViewportChanged({
          x: i * 10,
          y: i * 10,
          zoom: 1 + i * 0.1,
        });
      }

      // 等待批处理间隔
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(listener).toHaveBeenCalled();
    });
  });
});
