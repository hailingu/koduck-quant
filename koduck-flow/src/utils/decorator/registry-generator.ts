import type { IEntity, IEntityConstructor, IEntityArguments } from "../../common/entity/types";
import type { ICapabilityAwareRegistry, IMeta } from "../../common/registry/types";
import { CapabilityAwareRegistryBase } from "./capability-aware-registry-base";

import type { IDynamicRegistryMeta } from "./types";
import { DefaultCapabilityDetector } from "./capability-detector";
import { logger } from "../../common/logger";

/**
 * Dynamic registry generator
 * Automatically generates the corresponding ICapabilityAwareRegistry implementation based on entity classes
 */
export class DynamicRegistryGenerator {
  private static readonly capabilityDetector = new DefaultCapabilityDetector();
  private static generatedRegistries = new WeakMap<
    IEntityConstructor<IEntity>,
    IDynamicRegistryMeta
  >();

  /**
   * Generate dynamic registry for entity class
   */
  static generateRegistry<T extends IEntity>(
    EntityClass: IEntityConstructor<T>,
    options: {
      capabilities?: string[];
      priority?: number;
      meta?: Record<string, unknown>;
      enableCapabilityDetection?: boolean;
    } = {}
  ): new (entityConstructor: IEntityConstructor<T>) => ICapabilityAwareRegistry<T> {
    const {
      capabilities: capabilitiesOption = [],
      priority = 0,
      meta = {},
      enableCapabilityDetection = true,
    } = options;

    const capabilities = Array.isArray(capabilitiesOption) ? capabilitiesOption : [];

    // Check if already generated
    const existing = this.generatedRegistries.get(EntityClass as IEntityConstructor<IEntity>);
    if (existing) {
      return existing.registryClass as new (
        entityConstructor: IEntityConstructor<T>
      ) => ICapabilityAwareRegistry<T>;
    }

    // Detect entity capabilities
    const detectedCapabilities = enableCapabilityDetection
      ? this.capabilityDetector.detectCapabilities(EntityClass.prototype as Record<string, unknown>)
      : [];

    const allCapabilities = [...new Set([...capabilities, ...detectedCapabilities])];

    // Create dynamic registry class
    class DynamicRegistry extends CapabilityAwareRegistryBase<T> {
      constructor(entityConstructor: IEntityConstructor<T>) {
        const registryMeta = {
          type: EntityClass.type || EntityClass.name,
          description: `Auto-generated capability-aware registry for ${EntityClass.name}`,
          capabilities: allCapabilities,
          capabilitiesDetectedAt: Date.now(),
          ...meta,
        } as IMeta;

        super(entityConstructor, undefined, registryMeta);

        // Initialize capability instances
        this.initializeCapabilities(EntityClass, allCapabilities);
      }

      /**
       * Initialize capability instances
       */
      private initializeCapabilities(
        _entityClass: IEntityConstructor<T>,
        capabilityNames: string[]
      ): void {
        capabilityNames.forEach((capabilityName) => {
          try {
            // Create simple capability implementation
            const capability = {
              name: capabilityName,
              priority: priority,
              canHandle: () => true,
              execute: async (entity: T, ...args: unknown[]) => {
                return await this.executeEntityCapability(entity, capabilityName, ...args);
              },
              meta: {
                description: `Auto-generated capability: ${capabilityName}`,
                entityType: EntityClass.type || EntityClass.name,
              },
            };

            this.addCapability(capability);
          } catch (error) {
            logger.warn(
              `Failed to create capability '${capabilityName}' for entity '${EntityClass.name}':`,
              error
            );
          }
        });
      }

      /**
       * Create entity instance - overrides base class implementation for compatibility
       */
      override createEntity(...args: [IEntityArguments?]): T {
        const entityArgs = args[0] ?? this.args ?? {};
        return new this.entityConstructor(entityArgs);
      }

      /**
       * Create entity instance with specific parameters
       */
      createEntityWithParams(
        nodeType?: string,
        position?: { x: number; y: number },
        overrides?: Record<string, unknown>
      ): T {
        const entityArgs = {
          ...overrides,
          ...(position && { x: position.x, y: position.y }),
          ...(nodeType && { type: nodeType }),
        };

        return new this.entityConstructor(entityArgs);
      }

      /**
       * Batch capability check
       */
      override checkCapabilities(entity: T, capabilityNames: string[]): boolean[] {
        return capabilityNames.map((name) => {
          // First check if the registry has this capability
          if (!this.hasCapability(name)) {
            return false;
          }

          // Then check if the entity supports this capability
          return this.entityHasCapability(entity, name);
        });
      }

      /**
       * Batch capability execution
       */
      override async executeCapabilities(
        entity: T,
        operations: Array<{ capability: string; args: unknown[] }>
      ): Promise<unknown[]> {
        const results: unknown[] = [];

        for (const operation of operations) {
          try {
            const result = await this.executeCapabilityWithEntity(
              entity,
              operation.capability,
              ...operation.args
            );
            results.push(result);
          } catch (error) {
            logger.error(
              `Failed to execute capability '${operation.capability}':`,
              error
            );
            results.push(error);
          }
        }

        return results;
      }

      /**
       * Execute capability for a specific entity
       */
      private async executeCapabilityWithEntity(
        entity: T,
        capabilityName: string,
        ...args: unknown[]
      ): Promise<unknown> {
        // First try to use the capability from the registry
        if (this.hasCapability(capabilityName)) {
          try {
            return await this.executeCapability(capabilityName, entity, ...args);
          } catch (error) {
            logger.warn(
              `Registry capability '${capabilityName}' failed, trying entity method:`,
              error
            );
          }
        }

        // Fall back to the entity's own method
        return await this.executeEntityCapability(entity, capabilityName, ...args);
      }
    }

    // Record the generated registry
    const registryMeta: IDynamicRegistryMeta = {
      registryClass: DynamicRegistry as new (...args: unknown[]) => unknown,
      detectedCapabilities: allCapabilities,
      createdAt: Date.now(),
    };

    this.generatedRegistries.set(EntityClass as IEntityConstructor<IEntity>, registryMeta);

    return DynamicRegistry;
  }

  /**
   * Get generated registry metadata
   */
  static getRegistryMeta<T extends IEntity>(
    EntityClass: IEntityConstructor<T>
  ): IDynamicRegistryMeta | undefined {
    return this.generatedRegistries.get(EntityClass as IEntityConstructor<IEntity>);
  }

  /**
   * Clear generated registry cache
   */
  static clearCache(): void {
    this.generatedRegistries = new WeakMap();
  }

  /**
   * Validate whether the entity class is suitable for registry generation
   */
  static validateEntityClass<T extends IEntity>(
    EntityClass: IEntityConstructor<T>
  ): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!EntityClass.type && !EntityClass.name) {
      issues.push("Entity class must have a static type property or class name");
    }

    if (typeof EntityClass !== "function") {
      issues.push("EntityClass must be a constructor function");
    }

    // Check for basic prototype methods
    const prototype = EntityClass.prototype as Record<string, unknown>;
    if (!prototype || typeof prototype !== "object") {
      issues.push("Entity class must have a valid prototype");
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get the list of capabilities supported by the entity class (static analysis)
   */
  static getEntityCapabilities<T extends IEntity>(EntityClass: IEntityConstructor<T>): string[] {
    return this.capabilityDetector.detectCapabilities(
      EntityClass.prototype as Record<string, unknown>
    );
  }
}
