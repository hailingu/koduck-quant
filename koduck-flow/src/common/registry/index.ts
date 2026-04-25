/**
 * @module src/common/registry
 * @description Registry system barrel module. Exports registry interfaces and managers
 * for type registration and lifecycle management
 */

// Export registry-related interfaces and types
export type {
  IRegistry,
  IRegistryManager,
  IRenderableRegistry,
  ICapabilityAwareRegistry,
} from "./types";

export { RegistryManager, createRegistryManager } from "./registry-manager";

export type { IRegistryBroker } from "./broker";
export { RegistryBroker, RegistryBrokerEvent, createRegistryBroker } from "./broker-impl";

export { RegistryCapabilityUtils } from "./registry-capability-utils";
