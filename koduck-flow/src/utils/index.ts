/**
 * Koduck Flow Utilities Module
 *
 * Central re-export point for all utility modules and helpers used throughout the application.
 * Provides organized access to decorators, capabilities, and utility functions.
 *
 * **Exported Submodules**:
 * - Decorator Module: Capability-aware entity system with automatic registration,
 * pattern-based capability detection, dynamic registry generation, and smart execution
 *
 * **Organization**:
 * This module serves as the public API for utilities, re-exporting from specialized submodules.
 * Current submodules:
 * - `./decorator` - Entity registration and capability management system
 *
 * **Key Concepts**:
 * - Capabilities: Pluggable functionality that entities can implement
 * - Decorators: TypeScript decorators for automatic entity registration
 * - Registries: Type-safe container management for entity types
 * - Execution: Smart capability execution with retry, timeout, batch support
 *
 * **Usage Pattern**:
 * ```typescript
 * import {
 * AutoRegistry,
 * CapabilityManager,
 * DefaultCapabilityDetector
 * } from '@/utils';
 * ```
 *
 * **Extension Guidelines**:
 * New utility modules should follow these patterns:
 * 1. Create submodule in `src/utils/<module-name>/`
 * 2. Export public API from `<module-name>/index.ts`
 * 3. Re-export from this file using `export * from "./<module-name>"`
 * 4. Document in module's JSDoc
 *
 * @module Utils
 * @see {@link ./decorator} - Decorator module with full documentation
 */

// Decorator tools - Entity registration and capability management system
export * from "./decorator";
