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

  describe("Constructor and Initialization", () => {
    it("should successfully create an instance", () => {
      expect(debugConfig).toBeDefined();
      expect(debugConfig).toBeInstanceOf(RuntimeDebugConfiguration);
    });

    it("should have debug options as undefined on initialization", () => {
      const options = debugConfig.getDebugOptions();
      expect(options).toBeUndefined();
    });
  });

  describe("configureDebug() - Configure Debug Options", () => {
    it("should be able to set full debug options", () => {
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

    it("should be able to set partial debug options", () => {
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

    it("should be able to clear debug options (pass undefined)", () => {
      // First set debug options
      debugConfig.configureDebug({
        enabled: true,
        logLevel: "debug",
      });

      // Then clear
      debugConfig.configureDebug();

      const options = debugConfig.getDebugOptions();
      expect(options).toBeUndefined();
    });

    it("should deep clone debug options so external modifications don't affect internal state", () => {
      const originalOptions = {
        enabled: true,
        panel: { position: "bottom" as "bottom" | "top" },
      };

      debugConfig.configureDebug(originalOptions);

      // Modify original object
      originalOptions.enabled = false;
      if (originalOptions.panel) {
        originalOptions.panel.position = "top";
      }

      // Verify internal state is not modified
      const storedOptions = debugConfig.getDebugOptions();
      expect(storedOptions?.enabled).toBe(true);
      expect(storedOptions?.panel?.position).toBe("bottom");
    });

    it("should handle options without panel", () => {
      debugConfig.configureDebug({
        enabled: false,
        logLevel: "warn",
      });

      const options = debugConfig.getDebugOptions();
      expect(options).toBeDefined();
      expect(options?.panel).toBeUndefined();
    });
  });

  describe("getDebugOptions() - Get Debug Options", () => {
    it("should return a clone of debug options", () => {
      debugConfig.configureDebug({
        enabled: true,
        panel: { position: "bottom" },
      });

      const options1 = debugConfig.getDebugOptions();
      const options2 = debugConfig.getDebugOptions();

      expect(options1).toEqual(options2);
      expect(options1).not.toBe(options2); // Different object references
    });

    it("should deep clone panel object", () => {
      debugConfig.configureDebug({
        enabled: true,
        panel: { position: "bottom" },
      });

      const options1 = debugConfig.getDebugOptions();
      const options2 = debugConfig.getDebugOptions();

      expect(options1?.panel).toEqual(options2?.panel);
      expect(options1?.panel).not.toBe(options2?.panel); // Different object references
    });

    it("should prevent internal state modification through return value", () => {
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

      // Verify internal state is not modified
      const storedOptions = debugConfig.getDebugOptions();
      expect(storedOptions?.enabled).toBe(true);
      expect(storedOptions?.panel?.position).toBe("bottom");
    });

    it("should return undefined when not configured", () => {
      const options = debugConfig.getDebugOptions();
      expect(options).toBeUndefined();
    });
  });

  describe("Logger Sync", () => {
    it("should sync enabled to Logger when enabled", () => {
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

    it("should sync enabled to Logger when disabled", () => {
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

    it("should sync logLevel to Logger", () => {
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

    it("should sync includeEmoji to Logger", () => {
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

    it("should sync multiple Logger config items at the same time", () => {
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

    it("should not call Logger.setConfig when options is empty object", () => {
      const setConfigSpy = vi.spyOn(logger, "setConfig");

      debugConfig.configureDebug({});

      expect(setConfigSpy).not.toHaveBeenCalled();
    });

    it("should not call Logger.setConfig when options is undefined", () => {
      const setConfigSpy = vi.spyOn(logger, "setConfig");

      debugConfig.configureDebug();

      expect(setConfigSpy).not.toHaveBeenCalled();
    });
  });

  describe("Event Manager Sync", () => {
    it("should enable debug mode for all event managers when eventTracking=true", () => {
      debugConfig.configureDebug({
        eventTracking: true,
      });

      expect(mockEventManagers.eventBus.setDebugMode).toHaveBeenCalledWith(true);
      expect(mockEventManagers.renderEvents.setDebugMode).toHaveBeenCalledWith(true);
      expect(mockEventManagers.entityEvents.setDebugMode).toHaveBeenCalledWith(true);
    });

    it("should disable debug mode for all event managers when eventTracking=false", () => {
      debugConfig.configureDebug({
        eventTracking: false,
      });

      expect(mockEventManagers.eventBus.setDebugMode).toHaveBeenCalledWith(false);
      expect(mockEventManagers.renderEvents.setDebugMode).toHaveBeenCalledWith(false);
      expect(mockEventManagers.entityEvents.setDebugMode).toHaveBeenCalledWith(false);
    });

    it("should disable debug mode for all event managers when eventTracking is undefined", () => {
      debugConfig.configureDebug({
        enabled: true,
      });

      expect(mockEventManagers.eventBus.setDebugMode).toHaveBeenCalledWith(false);
      expect(mockEventManagers.renderEvents.setDebugMode).toHaveBeenCalledWith(false);
      expect(mockEventManagers.entityEvents.setDebugMode).toHaveBeenCalledWith(false);
    });

    it("should disable debug mode for all event managers when options is undefined", () => {
      debugConfig.configureDebug();

      expect(mockEventManagers.eventBus.setDebugMode).toHaveBeenCalledWith(false);
      expect(mockEventManagers.renderEvents.setDebugMode).toHaveBeenCalledWith(false);
      expect(mockEventManagers.entityEvents.setDebugMode).toHaveBeenCalledWith(false);
    });

    it("should not throw when renderEvents.setDebugMode does not exist", () => {
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

  describe("Integration Scenarios", () => {
    it("should support full configure-get-modify flow", () => {
      // First configuration
      debugConfig.configureDebug({
        enabled: true,
        logLevel: "debug",
        eventTracking: true,
      });

      let options = debugConfig.getDebugOptions();
      expect(options?.enabled).toBe(true);

      // Second configuration (modify)
      debugConfig.configureDebug({
        enabled: false,
        logLevel: "error",
      });

      options = debugConfig.getDebugOptions();
      expect(options?.enabled).toBe(false);
      expect(options?.logLevel).toBe("error");
    });

    it("should support clearing after configuration", () => {
      debugConfig.configureDebug({
        enabled: true,
        eventTracking: true,
      });

      expect(debugConfig.getDebugOptions()).toBeDefined();

      debugConfig.configureDebug();

      expect(debugConfig.getDebugOptions()).toBeUndefined();
    });

    it("should sync to Logger and event managers on every configuration", () => {
      const setConfigSpy = vi.spyOn(logger, "setConfig");

      // First configuration
      debugConfig.configureDebug({
        enabled: true,
        eventTracking: true,
      });

      expect(setConfigSpy).toHaveBeenCalledTimes(1);
      expect(mockEventManagers.eventBus.setDebugMode).toHaveBeenCalledTimes(1);

      // Second configuration
      debugConfig.configureDebug({
        enabled: false,
        eventTracking: false,
      });

      expect(setConfigSpy).toHaveBeenCalledTimes(2);
      expect(mockEventManagers.eventBus.setDebugMode).toHaveBeenCalledTimes(2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle panel as empty object", () => {
      debugConfig.configureDebug({
        enabled: true,
        panel: {},
      });

      const options = debugConfig.getDebugOptions();
      expect(options?.panel).toEqual({});
    });

    it("should handle multiple option retrievals", () => {
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
