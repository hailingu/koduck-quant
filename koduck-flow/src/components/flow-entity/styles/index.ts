/**
 * @file Flow Entity Styles Index
 * @description Entry point for Flow Entity CSS styles.
 * Import this file to include all base styles for Flow Entity components.
 *
 * @example
 * ```ts
 * // In your application entry point:
 * import '@/components/flow-entity/styles';
 *
 * // Or import the CSS directly:
 * import '@/components/flow-entity/styles/flow-entity.css';
 * ```
 *
 * @see docs/design/flow-entity-step-plan-en.md Task 1.11
 * @see docs/design/flow-entity-step-plan-en.md Task 5.3
 */

// Base styles for Flow Entity components
import "./flow-entity.css";

// Theme files (default and dark themes)
import "./themes/default.css";
import "./themes/dark.css";

// Re-export theme utilities
export {
  type FlowThemeName,
  type ResolvedThemeName,
  type FlowThemeConfig,
  FLOW_THEME_ATTRIBUTE,
  THEME_ATTRIBUTE,
  DEFAULT_THEME,
  THEME_CLASSES,
  LIGHT_THEME_CONFIG,
  DARK_THEME_CONFIG,
  applyFlowTheme,
  getFlowTheme,
  getSystemPreferredTheme,
  getEffectiveTheme,
  toggleFlowTheme,
  onSystemThemeChange,
  getThemeConfig,
} from "./themes";
