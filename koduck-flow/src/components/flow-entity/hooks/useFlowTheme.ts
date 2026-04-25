/**
 * @file Flow Theme Hook
 * @description React hook for managing Flow Entity theme switching.
 * Provides theme state management and synchronization with system preferences.
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 5.3
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  type FlowThemeName,
  type ResolvedThemeName,
  type FlowThemeConfig,
  applyFlowTheme,
  getEffectiveTheme,
  getSystemPreferredTheme,
  onSystemThemeChange,
  getThemeConfig,
} from "../styles/themes";

/**
 * Options for the useFlowTheme hook.
 */
export interface UseFlowThemeOptions {
  /**
   * Initial theme to use. Defaults to 'system'.
   */
  initialTheme?: FlowThemeName;

  /**
   * Whether to persist theme to localStorage.
   * @default true
   */
  persist?: boolean;

  /**
   * localStorage key for persisting theme.
   * @default 'flow-entity-theme'
   */
  storageKey?: string;

  /**
   * Target element to apply theme to.
   * Defaults to document.documentElement.
   */
  targetElement?: HTMLElement | null;

  /**
   * Callback when theme changes.
   */
  onThemeChange?: (theme: FlowThemeName, resolved: ResolvedThemeName) => void;
}

/**
 * Return type for useFlowTheme hook.
 */
export interface UseFlowThemeReturn {
  /**
   * Current theme setting ('default', 'dark', or 'system').
   */
  theme: FlowThemeName;

  /**
   * Resolved theme (always 'default' or 'dark').
   * When theme is 'system', this reflects the actual system preference.
   */
  resolvedTheme: ResolvedThemeName;

  /**
   * Theme configuration object with color values.
   */
  themeConfig: FlowThemeConfig;

  /**
   * Whether dark mode is active.
   */
  isDark: boolean;

  /**
   * Set the theme.
   */
  setTheme: (theme: FlowThemeName) => void;

  /**
   * Toggle between light and dark themes.
   * If currently using 'system', switches to the opposite of system preference.
   */
  toggleTheme: () => void;

  /**
   * Reset to system preference.
   */
  useSystemTheme: () => void;
}

/**
 * LocalStorage key for theme persistence.
 */
const DEFAULT_STORAGE_KEY = "flow-entity-theme";

/**
 * Get initial theme from localStorage or default.
 *
 * @param storageKey - The localStorage key to read from
 * @returns The stored theme or null if not found
 */
function getStoredTheme(storageKey: string): FlowThemeName | null {
  if (globalThis.localStorage === undefined) {
    return null;
  }

  try {
    const stored = globalThis.localStorage.getItem(storageKey);
    if (stored === "default" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage may be unavailable (e.g., in private browsing)
  }

  return null;
}

/**
 * Save theme to localStorage.
 *
 * @param storageKey - The localStorage key to write to
 * @param theme - The theme to save
 */
function saveTheme(storageKey: string, theme: FlowThemeName): void {
  if (globalThis.localStorage === undefined) {
    return;
  }

  try {
    globalThis.localStorage.setItem(storageKey, theme);
  } catch {
    // localStorage may be unavailable
  }
}

/**
 * React hook for managing Flow Entity themes.
 *
 * Features:
 * - Theme state management
 * - System preference detection and synchronization
 * - Optional localStorage persistence
 * - DOM attribute application
 *
 * @param options - Hook configuration options
 * @returns Theme state and control functions
 *
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const { theme, isDark, toggleTheme, setTheme } = useFlowTheme();
 *
 *   return (
 *     <div>
 *       <p>Current theme: {theme} (isDark: {isDark ? 'yes' : 'no'})</p>
 *       <button onClick={toggleTheme}>Toggle</button>
 *       <button onClick={() => setTheme('system')}>Use System</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFlowTheme(options: UseFlowThemeOptions = {}): UseFlowThemeReturn {
  const {
    initialTheme = "system",
    persist = true,
    storageKey = DEFAULT_STORAGE_KEY,
    targetElement,
    onThemeChange,
  } = options;

  // Track if this is the first render
  const isFirstRender = useRef(true);

  // Get initial theme from storage or props
  const getInitialTheme = useCallback((): FlowThemeName => {
    if (persist) {
      const stored = getStoredTheme(storageKey);
      if (stored) return stored;
    }
    return initialTheme;
  }, [persist, storageKey, initialTheme]);

  // Theme state - internal state with wrapper setter
  const [currentTheme, setCurrentTheme] = useState<FlowThemeName>(getInitialTheme);

  // System preference state (for 'system' theme) - used to trigger re-computation
  // when system theme changes while using 'system' theme option
  const [systemPreference, setSystemPreference] =
    useState<ResolvedThemeName>(getSystemPreferredTheme);

  // Calculate resolved theme - depends on systemPreference when theme is 'system'
  const resolvedTheme = useMemo<ResolvedThemeName>(() => {
    // When theme is 'system', use the tracked system preference
    if (currentTheme === "system") {
      return systemPreference;
    }
    return currentTheme;
  }, [currentTheme, systemPreference]);

  // Get theme config
  const themeConfig = useMemo<FlowThemeConfig>(() => {
    return getThemeConfig(currentTheme);
  }, [currentTheme]);

  // Is dark mode active?
  const isDark = resolvedTheme === "dark";

  // Apply theme to DOM
  useEffect(() => {
    applyFlowTheme(currentTheme, targetElement);

    // Notify on theme change (skip first render)
    if (!isFirstRender.current && onThemeChange) {
      onThemeChange(currentTheme, resolvedTheme);
    }
    isFirstRender.current = false;
  }, [currentTheme, resolvedTheme, targetElement, onThemeChange]);

  // Listen for system theme changes
  useEffect(() => {
    const cleanup = onSystemThemeChange((isDarkMode) => {
      setSystemPreference(isDarkMode ? "dark" : "default");
    });

    return cleanup;
  }, []);

  // Set theme function
  const setTheme = useCallback(
    (newTheme: FlowThemeName) => {
      setCurrentTheme(newTheme);
      if (persist) {
        saveTheme(storageKey, newTheme);
      }
    },
    [persist, storageKey]
  );

  // Toggle theme function
  const toggleTheme = useCallback(() => {
    const current = getEffectiveTheme(currentTheme);
    const newTheme: ResolvedThemeName = current === "dark" ? "default" : "dark";
    setTheme(newTheme);
  }, [currentTheme, setTheme]);

  // Reset to system theme
  const useSystemTheme = useCallback(() => {
    setTheme("system");
  }, [setTheme]);

  // Expose currentTheme as 'theme' in the return value
  return {
    theme: currentTheme,
    resolvedTheme,
    themeConfig,
    isDark,
    setTheme,
    toggleTheme,
    useSystemTheme,
  };
}

/**
 * Simplified hook that just returns whether dark mode is active.
 * Useful for components that only need to know the current mode.
 *
 * @returns Whether dark mode is currently active
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isDark = useIsDarkTheme();
 *   return <div style={{ color: isDark ? 'white' : 'black' }}>...</div>;
 * }
 * ```
 */
export function useIsDarkTheme(): boolean {
  const { isDark } = useFlowTheme();
  return isDark;
}

/**
 * Hook to get only the theme configuration.
 * Useful when you need color values for styling.
 *
 * @returns The current theme configuration
 *
 * @example
 * ```tsx
 * function StyledBox() {
 *   const config = useThemeConfig();
 *   return (
 *     <div style={{
 *       backgroundColor: config.nodeBackground,
 *       borderColor: config.nodeBorder
 *     }}>
 *       ...
 *     </div>
 *   );
 * }
 * ```
 */
export function useThemeConfig(): FlowThemeConfig {
  const { themeConfig } = useFlowTheme();
  return themeConfig;
}
