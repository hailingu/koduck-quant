/**
 * @file Flow Entity Themes Index
 * @description Exports theme CSS files and theme utilities.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 5.3
 */

// Import theme CSS files
import "./default.css";
import "./dark.css";

/**
 * Available theme names for Flow Entity components.
 */
export type FlowThemeName = "default" | "dark" | "system";

/**
 * Resolved theme names (excludes 'system').
 */
export type ResolvedThemeName = "default" | "dark";

/**
 * Theme attribute name used on DOM elements.
 * Can be used with data-theme or data-flow-theme.
 */
export const FLOW_THEME_ATTRIBUTE = "data-flow-theme";

/**
 * Alternative theme attribute for compatibility with other theme systems.
 */
export const THEME_ATTRIBUTE = "data-theme";

/**
 * Default theme name when no theme is specified.
 */
export const DEFAULT_THEME: ResolvedThemeName = "default";

/**
 * CSS class names for themes (alternative to data attributes).
 */
export const THEME_CLASSES = {
  default: "flow-theme-default",
  dark: "flow-theme-dark",
} as const;

/**
 * Gets the default element for theme operations.
 * Returns document.documentElement in browser environments, null in SSR.
 *
 * @returns The document element or null if not in browser
 */
function getDefaultElement(): HTMLElement | null {
  if (globalThis.document === undefined) {
    return null;
  }
  return globalThis.document.documentElement;
}

/**
 * Checks if matchMedia is available.
 *
 * @returns True if matchMedia is available
 */
function hasMatchMedia(): boolean {
  return globalThis.window !== undefined && typeof globalThis.window.matchMedia === "function";
}

/**
 * Applies a theme to the specified element or document root.
 *
 * @param theme - The theme name to apply
 * @param element - The target element (defaults to document.documentElement)
 *
 * @example
 * ```ts
 * // Apply dark theme to document root
 * applyFlowTheme('dark');
 *
 * // Apply theme to a specific container
 * applyFlowTheme('dark', containerElement);
 * ```
 */
export function applyFlowTheme(theme: FlowThemeName, element?: HTMLElement | null): void {
  const targetElement = element ?? getDefaultElement();
  if (!targetElement) return;

  if (theme === "system") {
    // Remove explicit theme to let system preference take effect
    targetElement.removeAttribute(FLOW_THEME_ATTRIBUTE);
    targetElement.removeAttribute(THEME_ATTRIBUTE);
  } else {
    targetElement.setAttribute(FLOW_THEME_ATTRIBUTE, theme);
  }
}

/**
 * Gets the current theme from the specified element or document root.
 *
 * @param element - The target element (defaults to document.documentElement)
 * @returns The current theme name, or 'system' if following system preference
 *
 * @example
 * ```ts
 * const theme = getFlowTheme();
 * console.log('Current theme:', theme);
 * ```
 */
export function getFlowTheme(element?: HTMLElement | null): FlowThemeName {
  const targetElement = element ?? getDefaultElement();
  if (!targetElement) return DEFAULT_THEME;

  const themeAttr =
    targetElement.getAttribute(FLOW_THEME_ATTRIBUTE) || targetElement.getAttribute(THEME_ATTRIBUTE);

  if (themeAttr === "dark" || themeAttr === "default") {
    return themeAttr;
  }

  return "system";
}

/**
 * Detects the system's preferred color scheme.
 *
 * @returns 'dark' if system prefers dark mode, 'default' otherwise
 *
 * @example
 * ```ts
 * const systemTheme = getSystemPreferredTheme();
 * if (systemTheme === 'dark') {
 *   console.log('System prefers dark mode');
 * }
 * ```
 */
export function getSystemPreferredTheme(): ResolvedThemeName {
  if (!hasMatchMedia()) {
    return DEFAULT_THEME;
  }

  return globalThis.window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default";
}

/**
 * Gets the effective theme, resolving 'system' to the actual theme.
 *
 * @param theme - The theme setting (may be 'system')
 * @returns The resolved theme name ('default' or 'dark')
 *
 * @example
 * ```ts
 * const effectiveTheme = getEffectiveTheme('system');
 * // Returns 'dark' if system prefers dark mode, 'default' otherwise
 * ```
 */
export function getEffectiveTheme(theme: FlowThemeName): ResolvedThemeName {
  if (theme === "system") {
    return getSystemPreferredTheme();
  }
  return theme;
}

/**
 * Toggles between light and dark themes.
 *
 * @param element - The target element (defaults to document.documentElement)
 * @returns The new theme after toggling
 *
 * @example
 * ```ts
 * const newTheme = toggleFlowTheme();
 * console.log('Switched to:', newTheme);
 * ```
 */
export function toggleFlowTheme(element?: HTMLElement | null): ResolvedThemeName {
  const current = getFlowTheme(element);
  const effectiveCurrent = getEffectiveTheme(current);
  const newTheme: ResolvedThemeName = effectiveCurrent === "dark" ? "default" : "dark";
  applyFlowTheme(newTheme, element);
  return newTheme;
}

/**
 * Creates a media query listener for system theme changes.
 *
 * @param callback - Function to call when system theme changes
 * @returns Cleanup function to remove the listener
 *
 * @example
 * ```ts
 * const cleanup = onSystemThemeChange((isDark) => {
 *   console.log('System theme changed:', isDark ? 'dark' : 'light');
 * });
 *
 * // Later, when component unmounts:
 * cleanup();
 * ```
 */
export function onSystemThemeChange(callback: (isDark: boolean) => void): () => void {
  if (!hasMatchMedia()) {
    return () => {
      /* no-op cleanup */
    };
  }

  const mediaQuery = globalThis.window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => callback(e.matches);

  // Use addEventListener (available in all modern browsers)
  mediaQuery.addEventListener("change", handler);
  return () => mediaQuery.removeEventListener("change", handler);
}

/**
 * Theme configuration for programmatic theming.
 * Used when JavaScript-based theme values are needed.
 */
export interface FlowThemeConfig {
  /** Theme identifier */
  name: FlowThemeName;
  /** Node background color */
  nodeBackground: string;
  /** Node border color */
  nodeBorder: string;
  /** Header background color */
  headerBackground: string;
  /** Header text color */
  headerText: string;
  /** Content text color */
  contentText: string;
  /** Canvas background color */
  canvasBackground: string;
  /** Grid color */
  gridColor: string;
  /** Primary accent color (used for selection, running state) */
  accentColor: string;
  /** Success state color */
  successColor: string;
  /** Error state color */
  errorColor: string;
  /** Warning state color */
  warningColor: string;
}

/**
 * Light theme configuration values.
 */
export const LIGHT_THEME_CONFIG: FlowThemeConfig = {
  name: "default",
  nodeBackground: "#ffffff",
  nodeBorder: "#e5e7eb",
  headerBackground: "#f3f4f6",
  headerText: "#1f2937",
  contentText: "#374151",
  canvasBackground: "#f9fafb",
  gridColor: "#e5e7eb",
  accentColor: "#3b82f6",
  successColor: "#10b981",
  errorColor: "#ef4444",
  warningColor: "#f59e0b",
};

/**
 * Dark theme configuration values.
 */
export const DARK_THEME_CONFIG: FlowThemeConfig = {
  name: "dark",
  nodeBackground: "#1f2937",
  nodeBorder: "#374151",
  headerBackground: "#111827",
  headerText: "#f3f4f6",
  contentText: "#e5e7eb",
  canvasBackground: "#111827",
  gridColor: "#1f2937",
  accentColor: "#60a5fa",
  successColor: "#34d399",
  errorColor: "#f87171",
  warningColor: "#fbbf24",
};

/**
 * Gets the theme configuration for the specified theme.
 *
 * @param theme - The theme name
 * @returns The theme configuration object
 */
export function getThemeConfig(theme: FlowThemeName): FlowThemeConfig {
  const effectiveTheme = getEffectiveTheme(theme);
  return effectiveTheme === "dark" ? DARK_THEME_CONFIG : LIGHT_THEME_CONFIG;
}
