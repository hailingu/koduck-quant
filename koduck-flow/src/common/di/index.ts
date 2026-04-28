/**
 * @module src/common/di
 * @description
 * DI (Dependency Injection) container and service bootstrap module.
 * Provides the core DI container implementation and factory functions
 * to initialize Koduck Flow's service architecture.
 *
 * @example
 * ```typescript
 * import {
 *   createCoreContainer,
 *   TOKENS,
 *   type IDependencyContainer
 * } from '@/common/di';
 *
 * // Create container with all services registered
 * const container = createCoreContainer();
 *
 * // Resolve services by token
 * const runtime = container.resolve(TOKENS.runtime);
 * const renderManager = container.resolve(TOKENS.renderManager);
 * ```
 */

export type {
  IDependencyContainer,
  ServiceDescriptor,
  ServiceFactory,
  RegistrationOptions,
  ServiceLifecycle,
} from "./types";
export { DefaultDependencyContainer } from "./default-dependency-container";
export { TOKENS } from "./tokens";
export {
  createCoreContainer,
  registerCoreServices,
  type CoreServiceKey,
  type CoreServiceOverride,
  type CoreServiceOverrides,
} from "./bootstrap";
