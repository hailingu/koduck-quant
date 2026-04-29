/**
 * @module src/components/provider/hooks/useEntity
 * @description React hook for managing entity lifecycle with creation, retrieval, and rendering support.
 */

import { logger } from "../../../common/logger/logger";
import { useState, useEffect, useCallback, useRef } from "react";
import { type IEntity } from "../../../common/entity/";
import {
  createEntity,
  getEntity,
  removeEntity,
  hasEntity,
  getEntities,
  createAndRender,
  removeAndStopRender,
} from "../../../common/api";

/**
 * Configuration options for useEntity hook.
 * @interface UseEntityOptions
 * @property {boolean} [autoRender=false] - Whether to automatically render created entities
 * @property {boolean} [autoCleanup=true] - Whether to automatically cleanup entities on unmount
 * @property {string} [entityType] - Default entity type for operations
 * @property {Record<string, unknown>} [initialProps] - Initial properties for entities
 */
export interface UseEntityOptions {
  /** Whether to automatically render created entities */
  autoRender?: boolean;
  /** Whether to automatically cleanup entities on component unmount */
  autoCleanup?: boolean;
  /** Default entity type for operations */
  entityType?: string;
  /** Initial properties for entities */
  initialProps?: Record<string, unknown>;
}

/**
 * Return value from useEntity hook.
 * Provides entity management state and operations.
 * @interface UseEntityResult
 * @property {IEntity | null} entity - Current active entity
 * @property {IEntity[]} entities - All managed entities
 * @property {Function} create - Create a new entity
 * @property {Function} createAndRender - Create and render a new entity
 * @property {Function} get - Get entity by ID
 * @property {Function} remove - Remove entity by ID
 * @property {Function} removeAndStopRender - Remove entity and stop rendering
 * @property {Function} exists - Check if entity exists
 * @property {Function} refresh - Refresh entity list from runtime
 * @property {Function} cleanup - Cleanup all managed entities
 * @property {boolean} loading - Loading state
 * @property {string | null} error - Error message if any
 */
export interface UseEntityResult {
  /** Current active entity */
  entity: IEntity | null;
  /** All entities managed by this hook */
  entities: IEntity[];
  /** Create a new entity */
  create: (type: string, props?: Record<string, unknown>) => IEntity | null;
  /** Create and render a new entity */
  createAndRender: (type: string, props?: Record<string, unknown>) => IEntity | null;
  /** Get entity by ID */
  get: (id: string) => IEntity | null;
  /** Remove entity by ID */
  remove: (id: string) => boolean;
  /** Remove entity and stop rendering */
  removeAndStopRender: (id: string) => boolean;
  /** Check if entity exists */
  exists: (id: string) => boolean;
  /** Refresh entity list from runtime */
  refresh: () => void;
  /** Cleanup all managed entities */
  cleanup: () => void;
  /** Loading state during operations */
  loading: boolean;
  /** Error message if operation failed */
  error: string | null;
}

/**
 * React hook for managing entity lifecycle and operations.
 * Provides complete entity management including creation, retrieval, deletion, and rendering.
 * Integrates with KoduckFlow runtime entity and render managers.
 *
 * @param {UseEntityOptions} [options={}] - Hook configuration
 * @param {boolean} [options.autoRender=false] - Auto-render created entities
 * @param {boolean} [options.autoCleanup=true] - Auto-cleanup on component unmount
 * @param {string} [options.entityType] - Default entity type
 * @param {Record<string, unknown>} [options.initialProps] - Initial entity properties
 * @returns {UseEntityResult} Entity management state and methods
 * @throws {Error} If used outside KoduckFlowProvider
 *
 * @example
 * const {
 *   entity, entities, create, remove, createAndRender
 * } = useEntity({
 *   autoRender: true,
 *   autoCleanup: true
 * });
 *
 * // Create entity
 * const node = create('StartNode', { x: 100, y: 100 });
 *
 * // Create and render
 * const rendered = createAndRender('ProcessNode', { label: 'Process' });
 *
 * // Remove entity
 * remove(node.id);
 *
 * // Refresh list
 * refresh();
 *
 * // Cleanup on unmount
 * cleanup();
 */
export function useEntity(options: UseEntityOptions = {}): UseEntityResult {
  const { autoRender = false, autoCleanup = true } = options;

  const [entity, setEntity] = useState<IEntity | null>(null);
  const [entities, setEntities] = useState<IEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track created entities for automatic cleanup
  const managedEntitiesRef = useRef<Set<string>>(new Set());

  /**
   * Refresh entity list from runtime
   */
  const refresh = useCallback(() => {
    try {
      setLoading(true);
      setError(null);
      const allEntities = getEntities();
      setEntities(allEntities);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get entity list");
      logger.error("刷新实体列表失败", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create entity
  const create = useCallback(
    (type: string, props?: Record<string, unknown>) => {
      try {
        setError(null);
        const newEntity = createEntity(type, props);
        if (newEntity) {
          managedEntitiesRef.current.add(newEntity.id);
          setEntity(newEntity);
          refresh();
          return newEntity;
        }
        return null;
      } catch (err) {
        setError(err instanceof Error ? err.message : "创建实体失败");
        logger.error("创建实体失败", err);
        return null;
      }
    },
    [refresh]
  );

  // Create and render entity
  const createAndRenderEntity = useCallback(
    (type: string, props?: Record<string, unknown>) => {
      try {
        setError(null);
        const newEntity = autoRender ? createAndRender(type, props) : createEntity(type, props);
        if (newEntity) {
          managedEntitiesRef.current.add(newEntity.id);
          setEntity(newEntity);
          refresh();
          return newEntity;
        }
        return null;
      } catch (err) {
        setError(err instanceof Error ? err.message : "创建并渲染实体失败");
        logger.error("创建并渲染实体失败", err);
        return null;
      }
    },
    [autoRender, refresh]
  );

  // Get entity
  const get = useCallback((id: string): IEntity | null => {
    try {
      setError(null);
      return getEntity(id) || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取实体失败");
      logger.error("获取实体失败", err);
      return null;
    }
  }, []);

  // Remove entity
  const remove = useCallback(
    (id: string) => {
      try {
        setError(null);
        const success = removeEntity(id);
        if (success) {
          managedEntitiesRef.current.delete(id);
          if (entity?.id === id) {
            setEntity(null);
          }
          refresh();
        }
        return success;
      } catch (err) {
        setError(err instanceof Error ? err.message : "移除实体失败");
        logger.error("移除实体失败", err);
        return false;
      }
    },
    [entity?.id, refresh]
  );

  // Remove and stop rendering
  const removeAndStopRenderEntity = useCallback(
    (id: string) => {
      try {
        setError(null);
        const success = autoRender ? removeAndStopRender(id) : removeEntity(id);
        if (success) {
          managedEntitiesRef.current.delete(id);
          if (entity?.id === id) {
            setEntity(null);
          }
          refresh();
        }
        return success;
      } catch (err) {
        setError(err instanceof Error ? err.message : "移除并停止渲染实体失败");
        logger.error("移除并停止渲染实体失败", err);
        return false;
      }
    },
    [autoRender, entity?.id, refresh]
  );

  // Check if entity exists
  const exists = useCallback((id: string) => {
    try {
      return hasEntity(id);
    } catch (err) {
      logger.error("检查实体存在性失败", err);
      return false;
    }
  }, []);

  // Cleanup all managed entities
  const cleanup = useCallback(() => {
    try {
      const entitiesToClean = Array.from(managedEntitiesRef.current);
      for (const id of entitiesToClean) {
        if (autoRender) {
          removeAndStopRender(id);
        } else {
          removeEntity(id);
        }
      }
      managedEntitiesRef.current.clear();
      setEntity(null);
      refresh();
    } catch (err) {
      logger.error("清理实体失败", err);
    }
  }, [autoRender, refresh]);

  // Cleanup function - only runs on unmount
  useEffect(() => {
    return () => {
      if (autoCleanup) {
        cleanup();
      }
    };
  }, [autoCleanup, cleanup]);

  return {
    entity,
    entities,
    create,
    createAndRender: createAndRenderEntity,
    get,
    remove,
    removeAndStopRender: removeAndStopRenderEntity,
    exists,
    refresh,
    cleanup,
    loading,
    error,
  };
}
