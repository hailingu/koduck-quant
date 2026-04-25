/**
 * Flow 便捷 API
 *
 * 在通用实体模块基础上提供流程实体的便捷操作函数。
 * 主要功能包括：
 * - 创建流程实体 (createFlowEntity)
 * - 获取节点的父级节点 (getNodeParents)
 * - 获取节点的子级节点 (getNodeChildren)
 *
 * 这些函数负责参数调适和节点关系查询。运行时状态变更
 * 仍然通过共享的实体 API 进行。
 *
 * @module FlowAPI
 *
 * @example
 * ```typescript
 * // 创建流程实体
 * const flow = createFlowEntity('workflow', { name: 'My Flow' });
 *
 * // 获取节点关系
 * const parents = getNodeParents('node-123');
 * const children = getNodeChildren('node-123');
 * ```
 *
 * @see {@link createEntity}
 * @see {@link getEntity}
 */
import type { IEntity } from "../entity";
import { createEntity, getEntity } from "./entity";

/**
 * 创建流程实体
 *
 * 工厂函数，用于创建指定类型的流程实体。实体在创建后可以被
 * 添加到流程图中，并通过其他 API 进行操作。
 *
 * @template TData - 实体数据类型
 * @template TConfig - 实体配置类型
 *
 * @param nodeType - 节点类型标识符，用于实体工厂查询
 * @param data - 节点的初始数据
 * @param config - 可选的节点配置参数
 *
 * @returns 创建成功返回 IEntity 对象，失败返回 null
 *
 * @throws 捕获内部异常并返回 null，同时输出错误日志
 *
 * @example
 * ```typescript
 * // 基本用法
 * const entity = createFlowEntity('task-node', { label: 'Task 1' });
 * if (entity) {
 *   console.log('Created entity:', entity.id);
 * }
 *
 * // 带配置的用法
 * const configuredEntity = createFlowEntity(
 *   'decision-node',
 *   { condition: true },
 *   { timeout: 5000 }
 * );
 *
 * // 处理创建失败
 * const entity2 = createFlowEntity('unknown-type', {});
 * if (!entity2) {
 *   console.error('Failed to create entity');
 * }
 * ```
 *
 * @see {@link IEntity}
 * @see {@link createEntity}
 */
export function createFlowEntity<
  TData = Record<string, unknown>,
  TConfig = Record<string, unknown>,
>(nodeType: string, data: TData, config?: TConfig): IEntity | null {
  try {
    return createEntity<IEntity>("FlowEntity", {
      type: nodeType,
      data,
      config,
    });
  } catch (error) {
    console.error(`Failed to create flow entity of type ${nodeType}:`, error);
    return null;
  }
}

/**
 * 获取节点的所有父级节点
 *
 * 根据节点 ID 查询该节点在流程图中的所有父级节点 ID 列表。
 * 返回的是父节点的 ID 数组，不包含节点的完整对象。
 *
 * @param entityId - 目标节点的实体 ID
 *
 * @returns 父级节点 ID 数组，如果没有父级节点或查询失败返回空数组
 *
 * 注意事项：
 * - 如果实体不存在，返回空数组
 * - 如果实体没有 node 属性，返回空数组
 * - 内部异常会被捕获并记录日志，不会抛出异常
 *
 * @example
 * ```typescript
 * // 获取节点的所有父级
 * const parents = getNodeParents('node-456');
 * console.log('Parent nodes:', parents); // ['node-123', 'node-789']
 *
 * // 如果节点不存在
 * const orphanParents = getNodeParents('non-existent');
 * console.log('Orphan parents:', orphanParents); // []
 * ```
 *
 * @see {@link getNodeChildren}
 * @see {@link getEntity}
 */
export function getNodeParents(entityId: string): string[] {
  try {
    const entity = getEntity(entityId);
    if (entity && typeof entity === "object" && "node" in entity) {
      const node = (entity as Record<string, unknown>).node;
      if (node && typeof node === "object" && "parents" in node) {
        const parents = (node as Record<string, unknown>).parents;
        return Array.isArray(parents) ? (parents as string[]) : [];
      }
    }
    return [];
  } catch (error) {
    console.error(`Failed to get parents for node ${entityId}:`, error);
    return [];
  }
}

/**
 * 获取节点的所有子级节点
 *
 * 根据节点 ID 查询该节点在流程图中的所有子级节点 ID 列表。
 * 返回的是子节点的 ID 数组，不包含节点的完整对象。
 *
 * @param entityId - 目标节点的实体 ID
 *
 * @returns 子级节点 ID 数组，如果没有子级节点或查询失败返回空数组
 *
 * 注意事项：
 * - 如果实体不存在，返回空数组
 * - 如果实体没有 node 属性，返回空数组
 * - 内部异常会被捕获并记录日志，不会抛出异常
 *
 * @example
 * ```typescript
 * // 获取节点的所有子级
 * const children = getNodeChildren('node-456');
 * console.log('Child nodes:', children); // ['node-111', 'node-222']
 *
 * // 叶节点没有子节点
 * const leafChildren = getNodeChildren('leaf-node');
 * console.log('Leaf children:', leafChildren); // []
 * ```
 *
 * @see {@link getNodeParents}
 * @see {@link getEntity}
 */
export function getNodeChildren(entityId: string): string[] {
  try {
    const entity = getEntity(entityId);
    if (entity && typeof entity === "object" && "node" in entity) {
      const node = (entity as Record<string, unknown>).node;
      if (node && typeof node === "object" && "children" in node) {
        const children = (node as Record<string, unknown>).children;
        return Array.isArray(children) ? (children as string[]) : [];
      }
    }
    return [];
  } catch (error) {
    console.error(`Failed to get children for node ${entityId}:`, error);
    return [];
  }
}
