/**
 * @module src/components/provider/hooks/useFlow
 * @description React hook for managing KoduckFlow flow graph state and operations.
 * Provides full CRUD operations on flow nodes and edges with automatic rendering.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Flow, FlowGraphAST, BaseNode } from "../../../common/flow";
import type {
  IEdge,
  IFlowEdgeEntity,
  IFlowNodeEntity,
  FlowLinkMetadata,
} from "../../../common/flow/types";
import type { IEntity } from "../../../common/entity";
import type { IRenderContext } from "../../../common/render";
import { logger } from "../../../common/logger";
import {
  UMLClassEntity,
  UMLInterfaceEntity,
  UMLUseCaseEntity,
  UMLActorEntity,
  UMLLineEntity,
  getUMLEntityRegistryInfo,
} from "../../demo/FlowDemo/uml-entities-new-decorator";
import { useKoduckFlowManagers } from "./useKoduckFlowRuntime";

/**
 * Represents a node in the flow graph.
 */
type FlowNode = BaseNode;

/**
 * Flow entity representing a node with position and styling data.
 */
type FlowEntity = IFlowNodeEntity<FlowNode> & {
  data?: {
    position?: { x: number; y: number };
    fillColor?: string;
  } & Record<string, unknown>;
};

/**
 * Flow entity representing an edge/link in the graph.
 */
type FlowEdgeEntity = IFlowEdgeEntity<IEdge> & {
  data?: Record<string, unknown>;
};

/**
 * Flow graph instance typed with node, edge, entity, and edge entity types.
 */
type FlowInstance = Flow<FlowNode, IEdge, FlowEntity, FlowEdgeEntity>;

/**
 * Position metadata for a node in the visualization.
 * @typedef {Object} NodePosition
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 * @property {string} color - Node fill color
 */
type NodePosition = { x: number; y: number; color: string };

/**
 * Configuration for adding a new node to the flow.
 * @typedef {Object} AddNodeConfig
 * @property {string} type - Node type identifier
 * @property {string} [name] - Display name for the node
 * @property {string} [color] - Node fill color (hex)
 * @property {Object} [position] - Initial position
 * @property {number} [position.x] - X coordinate
 * @property {number} [position.y] - Y coordinate
 * @property {string[]} [parentIds] - IDs of parent nodes for parent-child relationships
 * @property {FlowLinkMetadata | Function} [linkMetadata] - Metadata for links to parent nodes
 */
type AddNodeConfig = {
  type: string;
  name?: string;
  color?: string;
  position?: { x: number; y: number };
  parentIds?: string[];
  linkMetadata?:
    | FlowLinkMetadata
    | ((parentId: string, childId: string) => FlowLinkMetadata | undefined);
} & Record<string, unknown>;

/**
 * Configuration for adding a new edge to the flow.
 * @typedef {Object} AddEdgeConfig
 * @property {string} type - Edge type identifier
 * @property {string} [sourceId] - Source node ID
 * @property {string} [targetId] - Target node ID
 * @property {string} [sourcePort] - Source port identifier
 * @property {string} [targetPort] - Target port identifier
 * @property {number} [sourcePortIndex] - Source port index
 * @property {number} [targetPortIndex] - Target port index
 * @property {FlowLinkMetadata} [linkMetadata] - Metadata for this edge
 */
type AddEdgeConfig = {
  type: string;
  sourceId?: string;
  targetId?: string;
  sourcePort?: string;
  targetPort?: string;
  sourcePortIndex?: number;
  targetPortIndex?: number;
  linkMetadata?: FlowLinkMetadata;
} & Record<string, unknown>;

/**
 * Configuration options for the useFlow hook.
 * @interface UseFlowOptions
 * @property {FlowEntity[]} [initialNodes] - Initial nodes to populate the flow
 * @property {boolean} [autoCreateAST] - Whether to automatically create AST from flow
 * @property {boolean} [autoRegisterNodeType] - Whether to auto-register new node types
 * @property {HTMLCanvasElement | null} [canvas] - Canvas element for rendering
 */
export interface UseFlowOptions {
  initialNodes?: FlowEntity[];
  autoCreateAST?: boolean;
  autoRegisterNodeType?: boolean;
  canvas?: HTMLCanvasElement | null;
}

/**
 * Return value from the useFlow hook.
 * Provides complete flow graph state and manipulation methods.
 * @interface UseFlowResult
 * @property {FlowInstance | null} flow - Active flow instance
 * @property {FlowEntity[]} nodes - Current array of nodes
 * @property {FlowEdgeEntity[]} edges - Current array of edges
 * @property {Map<string, NodePosition>} nodePositions - Map of node positions and colors
 * @property {Function} addNode - Function to add a new node
 * @property {Function} addEdge - Function to add a new edge
 * @property {Function} updateNode - Function to update a node
 * @property {Function} updateEdge - Function to update an edge
 * @property {Function} removeNode - Function to remove a node
 * @property {Function} removeEdge - Function to remove an edge
 * @property {Function} getNode - Function to retrieve a node by ID
 * @property {Function} getEdge - Function to retrieve an edge by ID
 * @property {Function} clear - Function to clear all nodes and edges
 * @property {boolean} [loading] - Whether the hook is initializing
 * @property {Error | null} [error] - Any initialization error
 */
export interface UseFlowResult {
  flow: FlowInstance | null;
  nodes: FlowEntity[];
  edges: FlowEdgeEntity[];
  nodePositions: Map<string, NodePosition>;
  addNode: (config: AddNodeConfig) => FlowEntity | null;
  addEdge: (config: AddEdgeConfig) => FlowEdgeEntity | null;
  updateNode: (id: string, updates: Partial<FlowEntity>) => boolean;
  updateEdge: (id: string, updates: Partial<FlowEdgeEntity>) => boolean;
  removeNode: (id: string) => void;
  removeEdge: (id: string) => void;
  getNode: (id: string) => FlowEntity | undefined;
  getEdge: (id: string) => FlowEdgeEntity | undefined;
  clear: () => void;
  loading?: boolean;
  error?: Error | null;
}

/**
 * React hook for managing a KoduckFlow flow graph instance.
 * Initializes flow graph with entity and render managers, provides CRUD operations
 * and maintains node positions for visualization.
 *
 * @param {UseFlowOptions} [options={}] - Hook configuration options
 * @param {FlowEntity[]} [options.initialNodes] - Initial nodes to populate
 * @param {boolean} [options.autoCreateAST] - Auto-create AST on graph changes
 * @param {boolean} [options.autoRegisterNodeType] - Auto-register new node types
 * @param {HTMLCanvasElement | null} [options.canvas] - Canvas for rendering
 * @returns {UseFlowResult} Flow instance state and manipulation functions
 * @throws {Error} If hook is used outside KoduckFlowProvider context
 *
 * @example
 * const {
 *   flow, nodes, edges,
 *   addNode, addEdge, removeNode
 * } = useFlow({
 *   initialNodes: [],
 *   autoCreateAST: true
 * });
 *
 * // Add a node
 * const newNode = addNode({
 *   type: 'class',
 *   name: 'MyClass',
 *   position: { x: 100, y: 100 }
 * });
 *
 * // Add an edge
 * const edge = addEdge({
 *   type: 'extends',
 *   sourceId: nodeA.id,
 *   targetId: nodeB.id
 * });
 *
 * // Update a node
 * updateNode(newNode.id, { data: { fillColor: '#FF0000' } });
 *
 * // Remove a node
 * removeNode(newNode.id);
 */
export function useFlow(options: UseFlowOptions = {}): UseFlowResult {
  const [flow, setFlow] = useState<FlowInstance | null>(null);
  const [nodes, setNodes] = useState<FlowEntity[]>(options.initialNodes || []);
  const [edges, setEdges] = useState<FlowEdgeEntity[]>([]);
  const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const { entityManager, registryManager, renderManager } = useKoduckFlowManagers();

  const flowRef = useRef<FlowInstance | null>(null);
  const cleanupListenersRef = useRef<Array<() => void>>([]);

  const isFlowNodeEntity = useCallback((entity: unknown): entity is FlowEntity => {
    if (!entity || typeof entity !== "object") return false;
    return "node" in entity && Boolean((entity as FlowEntity).node);
  }, []);

  const isFlowEdgeEntity = useCallback((entity: unknown): entity is FlowEdgeEntity => {
    if (!entity || typeof entity !== "object") return false;
    return "edge" in entity && Boolean((entity as FlowEdgeEntity).edge);
  }, []);

  const syncPositionsFromEntity = useCallback((entity: FlowEntity) => {
    setNodePositions((prev) => {
      const next = new Map(prev);
      const pos = entity.data?.position;
      const color = (entity.data?.fillColor as string | undefined) || "#666666";
      if (pos) {
        next.set(entity.id, {
          x: pos.x ?? 0,
          y: pos.y ?? 0,
          color,
        });
      } else {
        next.delete(entity.id);
      }
      return next;
    });
  }, []);

  const removeNodePosition = useCallback((id: string) => {
    setNodePositions((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    try {
      setLoading(true);

      renderManager.init({
        autoRenderOnAdd: true,
      });

      try {
        const entityTypes = [
          UMLClassEntity,
          UMLInterfaceEntity,
          UMLUseCaseEntity,
          UMLActorEntity,
          UMLLineEntity,
        ];
        logger.info(
          "📦 UML实体类已加载，装饰器自动注册中...",
          entityTypes.map((c) => c.name)
        );

        const registryInfo = getUMLEntityRegistryInfo();
        const successfulRegistrations = registryInfo.filter((info) => info.registered);

        logger.info(
          "✅ 装饰器自动注册成功:",
          successfulRegistrations.length,
          "/",
          registryInfo.length
        );
        logger.debug("📋 注册详情:", registryInfo);
      } catch (registryError) {
        logger.error("❌ 装饰器自动注册失败:", registryError as unknown);
      }

      // 🔧 使用 context 中的 registryManager 进行检查（与装饰器注册保持一致）
      const globalRegistryManager = registryManager;
      [
        "uml-class-canvas",
        "uml-interface-canvas",
        "uml-usecase-canvas",
        "uml-actor-canvas",
        "uml-line-canvas",
      ].forEach((type) => {
        if (!globalRegistryManager.getRegistry(type)) {
          logger.warn(`Registry for ${type} not found. Make sure it's registered elsewhere.`);
        }
      });

      const newFlow = new Flow<FlowNode, IEdge, FlowEntity, FlowEdgeEntity>(entityManager);
      newFlow.enableHooks = false;
      newFlow.flowGraph = new FlowGraphAST();

      flowRef.current = newFlow;
      setFlow(newFlow);

      const allEntities = entityManager.getEntities();
      const existingNodeEntities = allEntities
        .filter(isFlowNodeEntity)
        .reduce<Map<string, FlowEntity>>((map, entity) => {
          map.set(entity.id, entity as FlowEntity);
          return map;
        }, new Map<string, FlowEntity>());

      const nodeList: FlowEntity[] = Array.from(existingNodeEntities.values());
      setNodes(nodeList);
      nodeList.forEach((entity) => syncPositionsFromEntity(entity));
      nodeList.forEach((entity) => {
        newFlow.attachEntityToNode?.(entity.node as FlowNode, entity);
      });

      const edgeList = allEntities.filter(isFlowEdgeEntity) as FlowEdgeEntity[];
      setEdges(edgeList);
      edgeList.forEach((edge) => {
        newFlow.addEdgeEntity?.(edge);
      });

      const addedListener = entityManager.events.added.addEventListener((entity: IEntity) => {
        if (isFlowNodeEntity(entity)) {
          setNodes((prev) => {
            if (prev.some((item) => item.id === entity.id)) return prev;
            return [...prev, entity];
          });
          syncPositionsFromEntity(entity);
          newFlow.attachEntityToNode?.(entity.node as FlowNode, entity);
          return;
        }

        if (isFlowEdgeEntity(entity)) {
          setEdges((prev) => {
            if (prev.some((edge) => edge.id === entity.id)) return prev;
            return [...prev, entity];
          });
          newFlow.addEdgeEntity?.(entity as FlowEdgeEntity);
        }
      });

      const removedListener = entityManager.events.removed.addEventListener((entity: IEntity) => {
        if (isFlowNodeEntity(entity)) {
          setNodes((prev) => prev.filter((item) => item.id !== entity.id));
          removeNodePosition(entity.id);
          return;
        }

        if (isFlowEdgeEntity(entity)) {
          setEdges((prev) => prev.filter((edge) => edge.id !== entity.id));
        }
      });

      const updatedListener = entityManager.events.updated.addEventListener((entity: IEntity) => {
        if (isFlowNodeEntity(entity)) {
          setNodes((prev) => {
            const index = prev.findIndex((item) => item.id === entity.id);
            if (index === -1) return prev;
            const next = prev.slice();
            next[index] = entity;
            return next;
          });
          syncPositionsFromEntity(entity);
          return;
        }

        if (isFlowEdgeEntity(entity)) {
          setEdges((prev) => {
            const index = prev.findIndex((edge) => edge.id === entity.id);
            if (index === -1) return prev;
            const next = prev.slice();
            next[index] = entity;
            return next;
          });
        }
      });

      cleanupListenersRef.current = [addedListener, removedListener, updatedListener];

      setLoading(false);

      return () => {
        cleanupListenersRef.current.forEach((dispose) => {
          try {
            dispose();
          } catch (listenerError) {
            logger.warn("Failed to cleanup entity event listener", listenerError as unknown);
          }
        });
        cleanupListenersRef.current = [];
        flowRef.current?.dispose();
        flowRef.current = null;
      };
    } catch (err) {
      setError(err as Error);
      setLoading(false);
    }
  }, [
    entityManager,
    registryManager,
    renderManager,
    isFlowNodeEntity,
    isFlowEdgeEntity,
    syncPositionsFromEntity,
    removeNodePosition,
  ]);

  const initializedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = options.canvas;
    if (!canvas) {
      initializedCanvasRef.current = null;
      return;
    }

    initializedCanvasRef.current = canvas;
    const viewport = {
      x: 0,
      y: 0,
      zoom: 1,
      width: canvas.width || 800,
      height: canvas.height || 600,
    };

    const renderContext: IRenderContext = {
      nodes: [...nodes, ...edges],
      viewport,
      canvas,
      timestamp: Date.now(),
      metadata: { source: "useFlow:canvas" },
    };

    renderManager.setRenderContext(renderContext);
  }, [nodes, edges, options.canvas, renderManager]);

  const addNode = useCallback(
    (config: AddNodeConfig) => {
      const currentFlow = flowRef.current;
      if (!currentFlow) throw new Error("Flow not initialized");
      if (!config.type) throw new Error("Entity type is required");

      logger.debug("[useFlow] addNode: creating entity of type", config.type);

      // 添加详细日志：检查注册表状态
      try {
        logger.info("[useFlow] 🔍 注册表详细检查", {
          type: config.type,
          hasRegistry: registryManager.hasRegistry(config.type),
          allRegistries: registryManager.getRegistryNames(),
          registryCount: registryManager.getRegistryNames().length,
        });
      } catch (error) {
        logger.error("[useFlow] ❌ 无法检查注册表状态", error);
      }

      const entity = currentFlow.createEntity(config.type, config);
      logger.debug("[useFlow] addNode: createEntity returned", !!entity, entity?.id);

      if (!entity) {
        logger.error("[useFlow] ❌ createEntity 返回null", {
          type: config.type,
        });
        return null;
      }

      currentFlow.addNode(entity, {
        parentIds: config.parentIds,
        linkMetadata: config.linkMetadata,
      });

      if (config.position) {
        setNodePositions((prev) => {
          const newMap = new Map(prev);
          newMap.set(entity.id, {
            x: config.position!.x,
            y: config.position!.y,
            color: config.color || "#666666",
          });
          return newMap;
        });
      }

      return entity;
    },
    [registryManager]
  );

  const addEdge = useCallback(
    (config: AddEdgeConfig) => {
      const currentFlow = flowRef.current;
      if (!currentFlow) throw new Error("Flow not initialized");
      if (!config.type) throw new Error("Entity type is required");

      logger.debug("[useFlow] addEdge: creating entity of type", config.type);

      if (typeof currentFlow.createEdgeEntity === "function") {
        const edgeEntity = currentFlow.createEdgeEntity(config.type, config);
        if (edgeEntity && config.sourceId && config.targetId) {
          const metadata: FlowLinkMetadata = {
            edgeId: edgeEntity.id,
            sourcePort: config.sourcePort,
            sourcePortIndex: config.sourcePortIndex,
            targetPort: config.targetPort,
            targetPortIndex: config.targetPortIndex,
          };
          if (config.linkMetadata) {
            Object.assign(metadata, config.linkMetadata);
          }
          currentFlow.linkNodes(config.sourceId, config.targetId, metadata);
        }
        return edgeEntity;
      }

      const entity = entityManager.createEntity(config.type, config);
      if (!entity) return null;
      if (!isFlowEdgeEntity(entity)) {
        entityManager.removeEntity(entity.id);
        throw new Error(`Entity type ${config.type} does not implement IFlowEdgeEntity`);
      }

      if (isFlowEdgeEntity(entity) && config.sourceId && config.targetId && flowRef.current) {
        const metadata: FlowLinkMetadata = {
          edgeId: entity.id,
          sourcePort: config.sourcePort,
          sourcePortIndex: config.sourcePortIndex,
          targetPort: config.targetPort,
          targetPortIndex: config.targetPortIndex,
        };
        if (config.linkMetadata) {
          Object.assign(metadata, config.linkMetadata);
        }
        flowRef.current.linkNodes(config.sourceId, config.targetId, metadata);
      }
      return entity;
    },
    [entityManager, isFlowEdgeEntity]
  );

  const updateNode = useCallback(
    (id: string, updates: Partial<FlowEntity>) => {
      const currentFlow = flowRef.current;
      if (!currentFlow) return false;

      try {
        logger.debug(`[useFlow] updateNode: updating entity ${id}`);
        const existingEntity = currentFlow.getEntity<FlowEntity>(id);
        if (!existingEntity) {
          logger.warn(`[useFlow] updateNode: entity ${id} not found`);
          return false;
        }

        const updatedEntity = Object.assign(existingEntity, updates);
        const success = currentFlow.updateEntity(updatedEntity);
        logger.debug(`[useFlow] updateNode: updateEntity returned ${success}`);

        if (success) {
          setNodes((prev) => prev.map((node) => (node.id === id ? updatedEntity : node)));
          syncPositionsFromEntity(updatedEntity);
        }

        return success;
      } catch (updateError) {
        logger.error(`[useFlow] updateNode: error updating entity ${id}:`, updateError as unknown);
        return false;
      }
    },
    [syncPositionsFromEntity]
  );

  const updateEdge = useCallback(
    (id: string, updates: Partial<FlowEdgeEntity>) => {
      const currentFlow = flowRef.current;
      if (!currentFlow) return false;

      try {
        logger.debug(`[useFlow] updateEdge: updating entity ${id}`);
        const existingEntity =
          (typeof currentFlow.getEdgeEntity === "function"
            ? currentFlow.getEdgeEntity(id)
            : undefined) ??
          currentFlow.getEntity<FlowEdgeEntity>(id) ??
          entityManager.getEntity<FlowEdgeEntity>(id);

        if (!existingEntity || !isFlowEdgeEntity(existingEntity)) {
          logger.warn(`[useFlow] updateEdge: entity ${id} not found`);
          return false;
        }

        const updatedEntity = Object.assign(existingEntity, updates);
        const success = entityManager.updateEntity(updatedEntity);
        logger.debug(`[useFlow] updateEdge: updateEntity returned ${success}`);

        if (success) {
          setEdges((prev) => prev.map((edge) => (edge.id === id ? updatedEntity : edge)));
        }

        return success;
      } catch (updateError) {
        logger.error(`[useFlow] updateEdge: error updating entity ${id}:`, updateError as unknown);
        return false;
      }
    },
    [entityManager, isFlowEdgeEntity]
  );

  const removeNode = useCallback(
    (id: string) => {
      const currentFlow = flowRef.current;
      if (!currentFlow) return;

      logger.debug(`[useFlow] removeNode: removing entity ${id}`);
      const success = currentFlow.removeEntity(id);
      logger.debug(`[useFlow] removeNode: removeEntity returned ${success}`);

      if (success) {
        setNodes((prev) => prev.filter((node) => node.id !== id));
        removeNodePosition(id);
      }
    },
    [removeNodePosition]
  );

  const removeEdge = useCallback((id: string) => {
    const currentFlow = flowRef.current;
    if (!currentFlow) return;

    logger.debug(`[useFlow] removeEdge: removing entity ${id}`);
    let success = false;
    if (typeof currentFlow.removeEdgeEntity === "function") {
      success = currentFlow.removeEdgeEntity(id);
    } else {
      success = currentFlow.removeEntity(id);
    }
    logger.debug(`[useFlow] removeEdge: remove returned ${success}`);

    if (success) {
      setEdges((prev) => prev.filter((edge) => edge.id !== id));
    }
  }, []);

  const getNode = useCallback((id: string) => nodes.find((node) => node.id === id), [nodes]);

  const getEdge = useCallback(
    (id: string) =>
      edges.find((edge) => edge.id === id) ??
      (typeof flowRef.current?.getEdgeEntity === "function"
        ? flowRef.current?.getEdgeEntity(id)
        : undefined),
    [edges]
  );

  const clear = useCallback(() => {
    const currentFlow = flowRef.current;
    if (!currentFlow) return;

    nodes.forEach((node) => currentFlow.removeEntity(node.id));
    if (typeof currentFlow.removeEdgeEntity === "function") {
      edges.forEach((edge) => currentFlow.removeEdgeEntity(edge.id));
    } else {
      edges.forEach((edge) => currentFlow.removeEntity(edge.id));
    }

    setNodes([]);
    setEdges([]);
    setNodePositions(new Map());
  }, [nodes, edges]);

  return {
    flow,
    nodes,
    edges,
    nodePositions,
    addNode,
    addEdge,
    updateNode,
    updateEdge,
    removeNode,
    removeEdge,
    getNode,
    getEdge,
    clear,
    loading,
    error,
  };
}
