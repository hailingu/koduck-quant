import type { IEntity, IEntityConstructor, IEntityArguments } from "../../common/entity/types";
import type { ICapabilityAwareRegistry, IMeta } from "../../common/registry/types";
import { CapabilityAwareRegistryBase } from "./capability-aware-registry-base";

import type { IDynamicRegistryMeta } from "./types";
import { DefaultCapabilityDetector } from "./capability-detector";
import { logger } from "../../common/logger";

/**
 * 动态注册表生成器
 * 根据实体类自动生成对应的ICapabilityAwareRegistry实现
 */
export class DynamicRegistryGenerator {
  private static capabilityDetector = new DefaultCapabilityDetector();
  private static generatedRegistries = new WeakMap<
    IEntityConstructor<IEntity>,
    IDynamicRegistryMeta
  >();

  /**
   * 为实体类生成动态注册表
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

    // 检查是否已经生成过
    const existing = this.generatedRegistries.get(EntityClass as IEntityConstructor<IEntity>);
    if (existing) {
      return existing.registryClass as new (
        entityConstructor: IEntityConstructor<T>
      ) => ICapabilityAwareRegistry<T>;
    }

    // 检测实体的能力
    const detectedCapabilities = enableCapabilityDetection
      ? this.capabilityDetector.detectCapabilities(EntityClass.prototype as Record<string, unknown>)
      : [];

    const allCapabilities = [...new Set([...capabilities, ...detectedCapabilities])];

    // 创建动态注册表类
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

        // 初始化能力实例
        this.initializeCapabilities(EntityClass, allCapabilities);
      }

      /**
       * 初始化能力实例
       */
      private initializeCapabilities(
        _entityClass: IEntityConstructor<T>,
        capabilityNames: string[]
      ): void {
        capabilityNames.forEach((capabilityName) => {
          try {
            // 创建简单的能力实现
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
              error as unknown
            );
          }
        });
      }

      /**
       * 创建实体实例 - 覆盖基类实现以支持兼容性
       */
      override createEntity(...args: [IEntityArguments?]): T {
        const entityArgs = args[0] ?? this.args ?? {};
        return new this.entityConstructor(entityArgs);
      }

      /**
       * 创建具有特定参数的实体实例
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
       * 批量能力检查
       */
      override checkCapabilities(entity: T, capabilityNames: string[]): boolean[] {
        return capabilityNames.map((name) => {
          // 首先检查注册表是否有该能力
          if (!this.hasCapability(name)) {
            return false;
          }

          // 然后检查实体是否支持该能力
          return this.entityHasCapability(entity, name);
        });
      }

      /**
       * 批量能力执行
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
              error as unknown
            );
            results.push(error);
          }
        }

        return results;
      }

      /**
       * 为特定实体执行能力
       */
      private async executeCapabilityWithEntity(
        entity: T,
        capabilityName: string,
        ...args: unknown[]
      ): Promise<unknown> {
        // 首先尝试使用注册表中的能力
        if (this.hasCapability(capabilityName)) {
          try {
            return await this.executeCapability(capabilityName, entity, ...args);
          } catch (error) {
            logger.warn(
              `Registry capability '${capabilityName}' failed, trying entity method:`,
              error as unknown
            );
          }
        }

        // 回退到实体自身的方法
        return await this.executeEntityCapability(entity, capabilityName, ...args);
      }
    }

    // 记录生成的注册表
    const registryMeta: IDynamicRegistryMeta = {
      registryClass: DynamicRegistry as new (...args: unknown[]) => unknown,
      detectedCapabilities: allCapabilities,
      createdAt: Date.now(),
    };

    this.generatedRegistries.set(EntityClass as IEntityConstructor<IEntity>, registryMeta);

    return DynamicRegistry;
  }

  /**
   * 获取已生成的注册表元数据
   */
  static getRegistryMeta<T extends IEntity>(
    EntityClass: IEntityConstructor<T>
  ): IDynamicRegistryMeta | undefined {
    return this.generatedRegistries.get(EntityClass as IEntityConstructor<IEntity>);
  }

  /**
   * 清除生成的注册表缓存
   */
  static clearCache(): void {
    this.generatedRegistries = new WeakMap();
  }

  /**
   * 验证实体类是否适合生成注册表
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

    // 检查是否有基本的原型方法
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
   * 获取实体类支持的能力列表（静态分析）
   */
  static getEntityCapabilities<T extends IEntity>(EntityClass: IEntityConstructor<T>): string[] {
    return this.capabilityDetector.detectCapabilities(
      EntityClass.prototype as Record<string, unknown>
    );
  }
}
