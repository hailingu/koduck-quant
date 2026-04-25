/**
 * RuntimeDebugConfiguration Unit Tests
 *
 * @description
 * Comprehensive test suite for RuntimeDebugConfiguration module.
 * Tests debug option configuration, cloning, logger sync, and event manager sync.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RuntimeDebugConfiguration } from "../../../src/common/runtime/runtime-debug-configuration";
import { logger } from "../../../src/common/logger";
import type { EventBus } from "../../../src/common/event/event-bus";
import type { RenderEventManager } from "../../../src/common/event/render-event-manager";
import type { EntityEventManager } from "../../../src/common/event/entity-event-manager";
import type { IEntity } from "../../../src/common/entity/";

/**
 * Helper function to create mock event managers
 */
function createMockEventManagers() {
  return {
    eventBus: {
      setDebugMode: vi.fn(),
    } as unknown as EventBus,
    renderEvents: {
      setDebugMode: vi.fn(),
    } as unknown as RenderEventManager,
    entityEvents: {
      setDebugMode: vi.fn(),
    } as unknown as EntityEventManager<IEntity>,
  };
}

describe("RuntimeDebugConfiguration", () => {
  let debugConfig: RuntimeDebugConfiguration;
  let mockEventManagers: ReturnType<typeof createMockEventManagers>;

  beforeEach(() => {
    mockEventManagers = createMockEventManagers();
    debugConfig = new RuntimeDebugConfiguration(mockEventManagers);
    vi.clearAllMocks();
  });

  describe("构造函数和初始化", () => {
    it("应该成功创建实例", () => {
      expect(debugConfig).toBeDefined();
      expect(debugConfig).toBeInstanceOf(RuntimeDebugConfiguration);
    });

    it("应该初始化时调试选项为 undefined", () => {
      const options = debugConfig.getDebugOptions();
      expect(options).toBeUndefined();
    });
  });

  describe("configureDebug() - 配置调试选项", () => {
    it("应该能够设置完整的调试选项", () => {
      debugConfig.configureDebug({
        enabled: true,
        logLevel: "debug",
        eventTracking: true,
        includeEmoji: true,
        panel: { position: "bottom" },
      });

      const options = debugConfig.getDebugOptions();
      expect(options).toBeDefined();
      expect(options?.enabled).toBe(true);
      expect(options?.logLevel).toBe("debug");
      expect(options?.eventTracking).toBe(true);
      expect(options?.includeEmoji).toBe(true);
      expect(options?.panel).toEqual({ position: "bottom" });
    });

    it("应该能够设置部分调试选项", () => {
      debugConfig.configureDebug({
        enabled: true,
        logLevel: "info",
      });

      const options = debugConfig.getDebugOptions();
      expect(options).toBeDefined();
      expect(options?.enabled).toBe(true);
      expect(options?.logLevel).toBe("info");
      expect(options?.eventTracking).toBeUndefined();
    });

    it("应该能够清除调试选项（传入 undefined）", () => {
      // 先设置调试选项
      debugConfig.configureDebug({
        enabled: true,
        logLevel: "debug",
      });

      // 再清除
      debugConfig.configureDebug();

      const options = debugConfig.getDebugOptions();
      expect(options).toBeUndefined();
    });

    it("应该深度克隆调试选项，外部修改不影响内部状态", () => {
      const originalOptions = {
        enabled: true,
        panel: { position: "bottom" as "bottom" | "top" },
      };

      debugConfig.configureDebug(originalOptions);

      // 修改原始对象
      originalOptions.enabled = false;
      if (originalOptions.panel) {
        originalOptions.panel.position = "top";
      }

      // 验证内部状态未被修改
      const storedOptions = debugConfig.getDebugOptions();
      expect(storedOptions?.enabled).toBe(true);
      expect(storedOptions?.panel?.position).toBe("bottom");
    });

    it("应该处理没有 panel 的选项", () => {
      debugConfig.configureDebug({
        enabled: false,
        logLevel: "warn",
      });

      const options = debugConfig.getDebugOptions();
      expect(options).toBeDefined();
      expect(options?.panel).toBeUndefined();
    });
  });

  describe("getDebugOptions() - 获取调试选项", () => {
    it("应该返回调试选项的克隆", () => {
      debugConfig.configureDebug({
        enabled: true,
        panel: { position: "bottom" },
      });

      const options1 = debugConfig.getDebugOptions();
      const options2 = debugConfig.getDebugOptions();

      expect(options1).toEqual(options2);
      expect(options1).not.toBe(options2); // 不同对象引用
    });

    it("应该深度克隆 panel 对象", () => {
      debugConfig.configureDebug({
        enabled: true,
        panel: { position: "bottom" },
      });

      const options1 = debugConfig.getDebugOptions();
      const options2 = debugConfig.getDebugOptions();

      expect(options1?.panel).toEqual(options2?.panel);
      expect(options1?.panel).not.toBe(options2?.panel); // 不同对象引用
    });

    it("应该防止通过返回值修改内部状态", () => {
      debugConfig.configureDebug({
        enabled: true,
        panel: { position: "bottom" },
      });

      const options = debugConfig.getDebugOptions();
      if (options) {
        options.enabled = false;
        if (options.panel) {
          const mutablePanel = options.panel as { position: string };
          mutablePanel.position = "top";
        }
      }

      // 验证内部状态未被修改
      const storedOptions = debugConfig.getDebugOptions();
      expect(storedOptions?.enabled).toBe(true);
      expect(storedOptions?.panel?.position).toBe("bottom");
    });

    it("应该在未配置时返回 undefined", () => {
      const options = debugConfig.getDebugOptions();
      expect(options).toBeUndefined();
    });
  });

  describe("Logger 同步", () => {
    it("应该在启用时同步 enabled 到 Logger", () => {
      const setConfigSpy = vi.spyOn(logger, "setConfig");

      debugConfig.configureDebug({
        enabled: true,
      });

      expect(setConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
        })
      );
    });

    it("应该在禁用时同步 enabled 到 Logger", () => {
      const setConfigSpy = vi.spyOn(logger, "setConfig");

      debugConfig.configureDebug({
        enabled: false,
      });

      expect(setConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        })
      );
    });

    it("应该同步 logLevel 到 Logger", () => {
      const setConfigSpy = vi.spyOn(logger, "setConfig");

      debugConfig.configureDebug({
        logLevel: "debug",
      });

      expect(setConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "debug",
        })
      );
    });

    it("应该同步 includeEmoji 到 Logger", () => {
      const setConfigSpy = vi.spyOn(logger, "setConfig");

      debugConfig.configureDebug({
        includeEmoji: true,
      });

      expect(setConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          includeEmoji: true,
        })
      );
    });

    it("应该同时同步多个 Logger 配置项", () => {
      const setConfigSpy = vi.spyOn(logger, "setConfig");

      debugConfig.configureDebug({
        enabled: true,
        logLevel: "warn",
        includeEmoji: false,
      });

      expect(setConfigSpy).toHaveBeenCalledWith({
        enabled: true,
        level: "warn",
        includeEmoji: false,
      });
    });

    it("应该在选项为空对象时不调用 Logger.setConfig", () => {
      const setConfigSpy = vi.spyOn(logger, "setConfig");

      debugConfig.configureDebug({});

      expect(setConfigSpy).not.toHaveBeenCalled();
    });

    it("应该在选项为 undefined 时不调用 Logger.setConfig", () => {
      const setConfigSpy = vi.spyOn(logger, "setConfig");

      debugConfig.configureDebug();

      expect(setConfigSpy).not.toHaveBeenCalled();
    });
  });

  describe("事件管理器同步", () => {
    it("应该在 eventTracking=true 时启用所有事件管理器的调试模式", () => {
      debugConfig.configureDebug({
        eventTracking: true,
      });

      expect(mockEventManagers.eventBus.setDebugMode).toHaveBeenCalledWith(true);
      expect(mockEventManagers.renderEvents.setDebugMode).toHaveBeenCalledWith(true);
      expect(mockEventManagers.entityEvents.setDebugMode).toHaveBeenCalledWith(true);
    });

    it("应该在 eventTracking=false 时禁用所有事件管理器的调试模式", () => {
      debugConfig.configureDebug({
        eventTracking: false,
      });

      expect(mockEventManagers.eventBus.setDebugMode).toHaveBeenCalledWith(false);
      expect(mockEventManagers.renderEvents.setDebugMode).toHaveBeenCalledWith(false);
      expect(mockEventManagers.entityEvents.setDebugMode).toHaveBeenCalledWith(false);
    });

    it("应该在 eventTracking 未定义时禁用所有事件管理器的调试模式", () => {
      debugConfig.configureDebug({
        enabled: true,
      });

      expect(mockEventManagers.eventBus.setDebugMode).toHaveBeenCalledWith(false);
      expect(mockEventManagers.renderEvents.setDebugMode).toHaveBeenCalledWith(false);
      expect(mockEventManagers.entityEvents.setDebugMode).toHaveBeenCalledWith(false);
    });

    it("应该在选项为 undefined 时禁用所有事件管理器的调试模式", () => {
      debugConfig.configureDebug();

      expect(mockEventManagers.eventBus.setDebugMode).toHaveBeenCalledWith(false);
      expect(mockEventManagers.renderEvents.setDebugMode).toHaveBeenCalledWith(false);
      expect(mockEventManagers.entityEvents.setDebugMode).toHaveBeenCalledWith(false);
    });

    it("应该在 renderEvents.setDebugMode 不存在时不抛出错误", () => {
      const eventManagersWithoutRenderDebug = {
        ...mockEventManagers,
        renderEvents: {} as RenderEventManager,
      };

      const config = new RuntimeDebugConfiguration(eventManagersWithoutRenderDebug);

      expect(() => {
        config.configureDebug({ eventTracking: true });
      }).not.toThrow();
    });
  });

  describe("集成场景", () => {
    it("应该支持完整的配置-获取-修改流程", () => {
      // 第一次配置
      debugConfig.configureDebug({
        enabled: true,
        logLevel: "debug",
        eventTracking: true,
      });

      let options = debugConfig.getDebugOptions();
      expect(options?.enabled).toBe(true);

      // 第二次配置（修改）
      debugConfig.configureDebug({
        enabled: false,
        logLevel: "error",
      });

      options = debugConfig.getDebugOptions();
      expect(options?.enabled).toBe(false);
      expect(options?.logLevel).toBe("error");
    });

    it("应该支持配置后清除", () => {
      debugConfig.configureDebug({
        enabled: true,
        eventTracking: true,
      });

      expect(debugConfig.getDebugOptions()).toBeDefined();

      debugConfig.configureDebug();

      expect(debugConfig.getDebugOptions()).toBeUndefined();
    });

    it("应该在每次配置时都同步到 Logger 和事件管理器", () => {
      const setConfigSpy = vi.spyOn(logger, "setConfig");

      // 第一次配置
      debugConfig.configureDebug({
        enabled: true,
        eventTracking: true,
      });

      expect(setConfigSpy).toHaveBeenCalledTimes(1);
      expect(mockEventManagers.eventBus.setDebugMode).toHaveBeenCalledTimes(1);

      // 第二次配置
      debugConfig.configureDebug({
        enabled: false,
        eventTracking: false,
      });

      expect(setConfigSpy).toHaveBeenCalledTimes(2);
      expect(mockEventManagers.eventBus.setDebugMode).toHaveBeenCalledTimes(2);
    });
  });

  describe("边缘情况", () => {
    it("应该处理 panel 为空对象", () => {
      debugConfig.configureDebug({
        enabled: true,
        panel: {},
      });

      const options = debugConfig.getDebugOptions();
      expect(options?.panel).toEqual({});
    });

    it("应该处理多次获取选项", () => {
      debugConfig.configureDebug({
        enabled: true,
      });

      const options1 = debugConfig.getDebugOptions();
      const options2 = debugConfig.getDebugOptions();
      const options3 = debugConfig.getDebugOptions();

      expect(options1).toEqual(options2);
      expect(options2).toEqual(options3);
      expect(options1).not.toBe(options2);
      expect(options2).not.toBe(options3);
    });
  });
});
