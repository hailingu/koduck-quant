/**
 * @module src/common/di/tokens
 * @description
 * DI service tokens module that defines all core service token symbols.
 * Tokens serve as unique identifiers for dependency injection services
 * and enable type-safe service resolution from the container.
 *
 * @example
 * ```typescript
 * // Using tokens to resolve services
 * import { TOKENS } from '@/common/di/tokens';
 *
 * const container = createCoreContainer();
 * const runtime = container.resolve(TOKENS.runtime);
 * const renderManager = container.resolve(TOKENS.renderManager);
 * ```
 */

/**
 * Core service tokens for Koduck Flow dependency injection container
 *
 * Each token is a unique Symbol that identifies a specific service.
 * Services are registered and resolved using these tokens.
 *
 * @property runtime - Token for the Flow runtime engine service
 * @property entityManager - Token for entity lifecycle management service
 * @property renderManager - Token for render orchestration and strategy service
 * @property registryManager - Token for service registry management
 * @property registryBroker - Token for registry broker/communication service
 * @property renderEventManager - Token for render event bus and management
 * @property entityEventManager - Token for entity event bus and management
 * @property eventBus - Token for global event bus service
 * @property tenantContext - Token for multi-tenancy context service
 * @property tenantRollout - Token for feature rollout management service
 * @property tenantQuota - Token for tenant quota enforcement service
 * @property workerPoolManager - Token for worker pool manager service
 * @property workerPoolConfig - Token for worker pool configuration
 */
export const TOKENS = {
  /** Flow runtime engine - executes the core data flow logic */
  runtime: Symbol.for("koduck-flow:runtime"),
  /** Entity manager - manages entity lifecycle and storage */
  entityManager: Symbol.for("koduck-flow:entity-manager"),
  /** Render manager - orchestrates rendering strategies and caching */
  renderManager: Symbol.for("koduck-flow:render-manager"),
  /** Registry manager - manages service registrations */
  registryManager: Symbol.for("koduck-flow:registry-manager"),
  /** Registry broker - handles registry communication and updates */
  registryBroker: Symbol.for("koduck-flow:registry-broker"),
  /** Render event manager - manages render-related events */
  renderEventManager: Symbol.for("koduck-flow:render-event-manager"),
  /** Entity event manager - manages entity lifecycle events */
  entityEventManager: Symbol.for("koduck-flow:entity-event-manager"),
  /** Global event bus - central event aggregation and distribution */
  eventBus: Symbol.for("koduck-flow:event-bus"),
  /** Tenant context - provides current tenant information and scope */
  tenantContext: Symbol.for("koduck-flow:tenant-context"),
  /** Tenant rollout - manages feature flags and gradual rollouts per tenant */
  tenantRollout: Symbol.for("koduck-flow:tenant-rollout"),
  /** Tenant quota - enforces resource quotas and limits per tenant */
  tenantQuota: Symbol.for("koduck-flow:tenant-quota"),
  /** Worker pool manager - manages worker pool lifecycle and task execution */
  workerPoolManager: Symbol.for("koduck-flow:worker-pool-manager"),
  /** Worker pool configuration - stores worker pool configuration settings */
  workerPoolConfig: Symbol.for("koduck-flow:worker-pool-config"),
} as const;

/**
 * Type representing any key in the TOKENS object
 * @see TOKENS
 */
export type TokenKey = keyof typeof TOKENS;

/**
 * Type representing the token symbol for a specific service
 * @template K The service key (e.g., 'runtime', 'renderManager')
 * @example
 * ```typescript
 * // Get the type of runtime token
 * type RuntimeToken = TokenValue<'runtime'>; // Symbol
 * ```
 */
export type TokenValue<K extends TokenKey> = (typeof TOKENS)[K];
