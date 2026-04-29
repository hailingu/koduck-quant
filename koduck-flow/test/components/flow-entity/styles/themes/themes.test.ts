/**
 * @file Theme system tests
 * @description Unit tests for theme utilities, CSS application, and theme switching.
 *
 * @see docs/design/flow-entity-step-plan-en.md Phase 5 Task 5.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type {
  FlowThemeName,
  ResolvedThemeName,
} from "../../../../../src/components/flow-entity/styles/themes";
import {
  FLOW_THEME_ATTRIBUTE,
  LIGHT_THEME_CONFIG,
  DARK_THEME_CONFIG,
  applyFlowTheme,
  getFlowTheme,
  toggleFlowTheme,
  getSystemPreferredTheme,
  getEffectiveTheme,
  getThemeConfig,
  onSystemThemeChange,
} from "../../../../../src/components/flow-entity/styles/themes";

describe("Theme System", () => {
  describe("Constants", () => {
    it("should export FLOW_THEME_ATTRIBUTE", () => {
      expect(FLOW_THEME_ATTRIBUTE).toBe("data-flow-theme");
    });

    it("should export LIGHT_THEME_CONFIG with all required properties", () => {
      expect(LIGHT_THEME_CONFIG).toBeDefined();
      expect(LIGHT_THEME_CONFIG.name).toBe("default");
      expect(LIGHT_THEME_CONFIG.nodeBackground).toBe("#ffffff");
      expect(LIGHT_THEME_CONFIG.nodeBorder).toBe("#e5e7eb");
      expect(LIGHT_THEME_CONFIG.headerBackground).toBe("#f3f4f6");
      expect(LIGHT_THEME_CONFIG.headerText).toBe("#1f2937");
      expect(LIGHT_THEME_CONFIG.contentText).toBe("#374151");
      expect(LIGHT_THEME_CONFIG.canvasBackground).toBe("#f9fafb");
      expect(LIGHT_THEME_CONFIG.gridColor).toBe("#e5e7eb");
      expect(LIGHT_THEME_CONFIG.accentColor).toBe("#3b82f6");
      expect(LIGHT_THEME_CONFIG.successColor).toBe("#10b981");
      expect(LIGHT_THEME_CONFIG.errorColor).toBe("#ef4444");
      expect(LIGHT_THEME_CONFIG.warningColor).toBe("#f59e0b");
    });

    it("should export DARK_THEME_CONFIG with all required properties", () => {
      expect(DARK_THEME_CONFIG).toBeDefined();
      expect(DARK_THEME_CONFIG.name).toBe("dark");
      expect(DARK_THEME_CONFIG.nodeBackground).toBe("#1f2937");
      expect(DARK_THEME_CONFIG.nodeBorder).toBe("#374151");
      expect(DARK_THEME_CONFIG.headerBackground).toBe("#111827");
      expect(DARK_THEME_CONFIG.headerText).toBe("#f3f4f6");
      expect(DARK_THEME_CONFIG.contentText).toBe("#e5e7eb");
      expect(DARK_THEME_CONFIG.canvasBackground).toBe("#111827");
      expect(DARK_THEME_CONFIG.gridColor).toBe("#1f2937");
      expect(DARK_THEME_CONFIG.accentColor).toBe("#60a5fa");
      expect(DARK_THEME_CONFIG.successColor).toBe("#34d399");
      expect(DARK_THEME_CONFIG.errorColor).toBe("#f87171");
      expect(DARK_THEME_CONFIG.warningColor).toBe("#fbbf24");
    });
  });

  describe("getEffectiveTheme", () => {
    it("should return default for default theme", () => {
      expect(getEffectiveTheme("default")).toBe("default");
    });

    it("should return dark for dark theme", () => {
      expect(getEffectiveTheme("dark")).toBe("dark");
    });

    it("should return system preference for system theme", () => {
      // This depends on window.matchMedia which may not be available in tests
      const result = getEffectiveTheme("system");
      expect(["default", "dark"]).toContain(result);
    });
  });

  describe("getThemeConfig", () => {
    it("should return light config for default theme", () => {
      expect(getThemeConfig("default")).toEqual(LIGHT_THEME_CONFIG);
    });

    it("should return dark config for dark theme", () => {
      expect(getThemeConfig("dark")).toEqual(DARK_THEME_CONFIG);
    });

    it("should return appropriate config for system theme", () => {
      const result = getThemeConfig("system");
      expect([LIGHT_THEME_CONFIG, DARK_THEME_CONFIG]).toContainEqual(result);
    });
  });

  describe("getSystemPreferredTheme", () => {
    let matchMediaMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      matchMediaMock = vi.fn();
      Object.defineProperty(globalThis, "window", {
        value: { matchMedia: matchMediaMock },
        writable: true,
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return dark when system prefers dark", () => {
      matchMediaMock.mockReturnValue({ matches: true });
      expect(getSystemPreferredTheme()).toBe("dark");
    });

    it("should return default when system prefers light", () => {
      matchMediaMock.mockReturnValue({ matches: false });
      expect(getSystemPreferredTheme()).toBe("default");
    });

    it("should return default when matchMedia is not available", () => {
      Object.defineProperty(globalThis, "window", {
        value: undefined,
        writable: true,
      });
      expect(getSystemPreferredTheme()).toBe("default");
    });
  });

  describe("DOM Theme Operations", () => {
    let testElement: HTMLElement;

    beforeEach(() => {
      // Create a test element to apply themes to
      testElement = document.createElement("div");
      document.body.appendChild(testElement);
    });

    afterEach(() => {
      testElement.remove();
      // Clean up document element attribute
      document.documentElement.removeAttribute(FLOW_THEME_ATTRIBUTE);
    });

    describe("applyFlowTheme", () => {
      it("should apply theme to document element by default", () => {
        applyFlowTheme("dark");
        expect(document.documentElement.getAttribute(FLOW_THEME_ATTRIBUTE)).toBe("dark");
      });

      it("should apply theme to specified element", () => {
        applyFlowTheme("dark", testElement);
        expect(testElement.getAttribute(FLOW_THEME_ATTRIBUTE)).toBe("dark");
      });

      it("should resolve system theme before applying (removes explicit attribute)", () => {
        applyFlowTheme("system", testElement);
        // When 'system' theme is applied, the attribute is removed to let CSS media queries take over
        const appliedTheme = testElement.getAttribute(FLOW_THEME_ATTRIBUTE);
        expect(appliedTheme).toBeNull();
      });

      it("should apply default theme", () => {
        applyFlowTheme("default", testElement);
        expect(testElement.getAttribute(FLOW_THEME_ATTRIBUTE)).toBe("default");
      });
    });

    describe("getFlowTheme", () => {
      it("should return current theme from document element by default", () => {
        document.documentElement.setAttribute(FLOW_THEME_ATTRIBUTE, "dark");
        expect(getFlowTheme()).toBe("dark");
      });

      it("should return current theme from specified element", () => {
        testElement.setAttribute(FLOW_THEME_ATTRIBUTE, "dark");
        expect(getFlowTheme(testElement)).toBe("dark");
      });

      it("should return system when no theme is set", () => {
        // When no explicit theme is set, returns 'system' meaning follow system preference
        expect(getFlowTheme(testElement)).toBe("system");
      });

      it("should return system for invalid theme attribute value", () => {
        testElement.setAttribute(FLOW_THEME_ATTRIBUTE, "invalid");
        // Invalid values are treated as unset (system follows preference)
        expect(getFlowTheme(testElement)).toBe("system");
      });
    });

    describe("toggleFlowTheme", () => {
      it("should toggle from default to dark", () => {
        testElement.setAttribute(FLOW_THEME_ATTRIBUTE, "default");
        const newTheme = toggleFlowTheme(testElement);
        expect(newTheme).toBe("dark");
        expect(testElement.getAttribute(FLOW_THEME_ATTRIBUTE)).toBe("dark");
      });

      it("should toggle from dark to default", () => {
        testElement.setAttribute(FLOW_THEME_ATTRIBUTE, "dark");
        const newTheme = toggleFlowTheme(testElement);
        expect(newTheme).toBe("default");
        expect(testElement.getAttribute(FLOW_THEME_ATTRIBUTE)).toBe("default");
      });

      it("should toggle on document element by default", () => {
        document.documentElement.setAttribute(FLOW_THEME_ATTRIBUTE, "default");
        const newTheme = toggleFlowTheme();
        expect(newTheme).toBe("dark");
        expect(document.documentElement.getAttribute(FLOW_THEME_ATTRIBUTE)).toBe("dark");
      });
    });
  });

  describe("onSystemThemeChange", () => {
    let matchMediaMock: ReturnType<typeof vi.fn>;
    let listenerCallback: ((e: { matches: boolean }) => void) | null = null;

    beforeEach(() => {
      listenerCallback = null;
      matchMediaMock = vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn((_event: string, callback: (e: { matches: boolean }) => void) => {
          listenerCallback = callback;
        }),
        removeEventListener: vi.fn(),
      });
      Object.defineProperty(globalThis, "window", {
        value: { matchMedia: matchMediaMock },
        writable: true,
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should call callback when system theme changes", () => {
      const callback = vi.fn();
      onSystemThemeChange(callback);

      // Simulate theme change
      if (listenerCallback) {
        listenerCallback({ matches: true });
      }

      expect(callback).toHaveBeenCalledWith(true);
    });

    it("should return cleanup function", () => {
      const callback = vi.fn();
      const cleanup = onSystemThemeChange(callback);

      expect(typeof cleanup).toBe("function");
      cleanup();
    });

    it("should return no-op cleanup when matchMedia is not available", () => {
      Object.defineProperty(globalThis, "window", {
        value: undefined,
        writable: true,
      });

      const callback = vi.fn();
      const cleanup = onSystemThemeChange(callback);

      expect(typeof cleanup).toBe("function");
      cleanup(); // Should not throw
    });
  });

  describe("Type Safety", () => {
    it("should have correct FlowThemeName type", () => {
      const themes: FlowThemeName[] = ["default", "dark", "system"];
      expect(themes).toHaveLength(3);
    });

    it("should have correct ResolvedThemeName type", () => {
      const themes: ResolvedThemeName[] = ["default", "dark"];
      expect(themes).toHaveLength(2);
    });
  });
});
