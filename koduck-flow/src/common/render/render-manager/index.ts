export * from "./dispatcher";
export * from "./types";
export * from "./render-frame-scheduler";
export * from "./dirty-region-manager";
export * from "./render-event-bridge";
export * from "./visibility-index";
export * from "./render-manager-metrics";
export * from "./entity-tracker";
export * from "./visibility-controller";
export * from "./visibility";
export * from "./contracts";
export * from "./render-cache-coordinator";
export * from "./render-orchestrator";
export * from "./entity-lifecycle-tracker";

// Legacy compatibility exports (previously provided via dedicated shim files).
export {
  DirtyRegionCoordinator,
  type DirtyRegionCoordinatorOptions,
} from "./dirty-region-coordinator";
export { EventBridgeModule, type EventBridgeModuleDependencies } from "./event-bridge-module";
export { RenderMetricsModule, type RenderMetricsModuleDependencies } from "./render-metrics-module";
