/**
 * Flow - Flow management and entity rendering framework
 *
 * This is the main entry file of the Flow framework, exporting all core features and APIs.
 */

// Core API - most commonly used global interfaces
export * from "./common/api";

// Entity system
export * from "./common/entity/entity";
export * from "./common/entity/entity-manager";
export * from "./common/entity/entity-registry";

// Registry system
export * from "./common/registry";

// Rendering system
export * from "./common/render";

// Event system
export * from "./common/event";

// Data and time
export * from "./common/data";

// Resource management
export * from "./common/disposable";

// Global Runtime Management
export {
  getGlobalRuntime,
  setGlobalRuntime,
  resetGlobalRuntime,
  disposeGlobalRuntime,
  type SetGlobalRuntimeOptions,
  type ResetGlobalRuntimeOptions,
  type DisposeGlobalRuntimeOptions,
} from "./common/global-runtime";

// KoduckFlow Runtime
export * from "./common/runtime";
export { KoduckFlowProvider, type KoduckFlowProviderProps } from "./components/provider/KoduckFlowProvider";
export { DebugPanel, type DebugPanelProps } from "./components/debug/DebugPanel";
export * from "./components/flow-entity";
export {
  useKoduckFlowContext,
  useKoduckFlowRuntime,
  useKoduckFlowManagers,
  useKoduckFlowManager,
  useKoduckFlowTenant,
  useTenantFeatureFlag,
  useTenantRollout,
} from "./components/provider/hooks/useKoduckFlowRuntime";

// Flow engine
export * from "./common/engine";

// Conversation native Plan Canvas
export * from "./conversation-plan";

// Type definitions (if needed, specific types can be manually exported)
