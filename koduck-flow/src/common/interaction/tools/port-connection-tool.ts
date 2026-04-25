/**
 * @module src/common/interaction/tools/port-connection-tool
 * @description Port connection tool for creating and managing connections between entity ports.
 * Enables interactive port-to-port link creation with visual feedback and validation.
 *
 * Features:
 * - Port hit detection with configurable padding
 * - Visual connection line during dragging
 * - Connection validation and flow link creation
 * - UML diagram integration support
 * - Automatic edge entity management
 *
 * Connection Workflow:
 * 1. Mouse down on source port -> Start connection with visual line
 * 2. Mouse move -> Drag line to target port
 * 3. Mouse up on target port -> Create connection via flow adapter
 *
 * @example
 * ```typescript
 * import { PortConnectionTool } from '@/interaction/tools/port-connection-tool';
 * import type { InteractionEnv, PointerLikeEvent } from '@/interaction/types';
 *
 * // Create tool with entity and event managers
 * const portTool = new PortConnectionTool({
 *   entityManager: entityManager,
 *   renderEvents: renderEventManager,
 *   adapter: {
 *     createEdgeEntity: (type, args) => {
 *       // Create flow edge entity
 *       return entityManager.createEntity('EdgeType', args);
 *     },
 *     linkNodes: (sourceId, targetId) => {
 *       // Create link in flow graph
 *       return flow.addLink(sourceId, targetId);
 *     },
 *     unlinkNodes: (sourceId, targetId) => {
 *       // Remove link from flow graph
 *       return flow.removeLink(sourceId, targetId);
 *     }
 *   }
 * });
 *
 * // Set up interaction environment
 * const canvas = document.getElementById('canvas') as HTMLCanvasElement;
 * const interactionEnv: InteractionEnv = {
 *   getCanvas: () => canvas,
 *   getViewport: () => ({ x: 0, y: 0, zoom: 1, width: 800, height: 600 }),
 *   getProvider: () => ({})
 * };
 *
 * // Handle port connection interaction
 * // 1. User clicks on source port
 * portTool.onMouseDown?.({ clientX: 100, clientY: 100 } as PointerLikeEvent, interactionEnv);
 *
 * // 2. User drags to target port
 * portTool.onMouseMove?.({ clientX: 200, clientY: 150 } as PointerLikeEvent, interactionEnv);
 *
 * // 3. User releases on target port
 * portTool.onMouseUp?.({ clientX: 200, clientY: 150 } as PointerLikeEvent, interactionEnv);
 * // -> Connection is created automatically
 * ```
 */

import type { Tool, InteractionEnv, PointerLikeEvent } from "../types";
import type { RenderEventManager } from "../../event";
import type { EntityUpdateDetail } from "../../entity/update-detail";
import type { IEntity } from "../../entity";
import type { EntityManager } from "../../entity/entity-manager";
import type { FlowLinkMetadata, IFlowEdgeEntity, IEdge } from "../../flow/types";
import {
  UMLLineEntity,
  UMLNodeEntity,
  type UMLPortInfo,
} from "../../../components/FlowDemo/uml-entities-new-decorator";

const PORT_HIT_PADDING = 4;

function toWorldPoint(e: PointerLikeEvent, env: InteractionEnv): { x: number; y: number } | null {
  const canvas = env.getCanvas();
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const viewport = env.getViewport();
  const zoom = viewport.zoom || 1;
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  return {
    x: mouseX / zoom + (viewport.x || 0),
    y: mouseY / zoom + (viewport.y || 0),
  };
}

type PortHit = {
  entity: UMLNodeEntity;
  port: UMLPortInfo;
  /** Zero-based occurrence index for ports sharing the same name */
  nameIndex: number;
  /** Absolute index within the node's port list */
  index: number;
};

type ConnectionState = {
  line: UMLLineEntity;
  source: {
    nodeId: string;
    portName: string;
    portIndex: number;
  };
};

type FlowLinkAdapter = {
  createEdgeEntity: (type: string, args?: Record<string, unknown>) => IFlowEdgeEntity<IEdge> | null;
  removeEdgeEntity?: (edgeId: string) => boolean;
  getEdgeEntity?: (edgeId: string) => IFlowEdgeEntity<IEdge> | undefined;
  linkNodes: (sourceId: string, targetId: string, metadata?: FlowLinkMetadata) => boolean;
  unlinkNodes: (sourceId: string, targetId: string) => boolean;
};

function getAllUmlNodes(entityManager: EntityManager): UMLNodeEntity[] {
  const entities = entityManager.getEntities();
  const nodes: UMLNodeEntity[] = [];
  for (const entity of entities) {
    if (entity instanceof UMLNodeEntity) {
      nodes.push(entity);
    }
  }
  return nodes;
}

function hitTestPort(
  entityManager: EntityManager,
  point: { x: number; y: number },
  predicate?: (info: UMLPortInfo, entity: UMLNodeEntity) => boolean
): PortHit | null {
  const nodes = getAllUmlNodes(entityManager);
  for (const node of nodes) {
    const infos = node.getAllPortInfo();
    if (!infos.length) continue;
    const nameCounters = new Map<string, number>();
    for (let index = 0; index < infos.length; index++) {
      const info = infos[index];
      const portName = info.descriptor.name;
      const nameIndex = nameCounters.get(portName) ?? 0;
      nameCounters.set(portName, nameIndex + 1);
      if (predicate && !predicate(info, node)) continue;
      const dx = info.x - point.x;
      const dy = info.y - point.y;
      const radius = info.radius + PORT_HIT_PADDING;
      if (dx * dx + dy * dy <= radius * radius) {
        return { entity: node, port: info, index, nameIndex };
      }
    }
  }
  return null;
}

function updateEntity(entityManager: EntityManager, entity: IEntity, detail: EntityUpdateDetail) {
  try {
    entityManager.updateEntity(entity, detail);
  } catch {
    // ignore update errors - entity might have been removed
  }
}

/**
 * Tool for creating and managing connections between entity ports
 * @class
 * @implements {Tool}
 */
export class PortConnectionTool implements Tool {
  name = "port-connection-tool";
  private state: ConnectionState | null = null;
  private readonly entityManager: EntityManager;
  private readonly renderEvents: RenderEventManager;
  private getFlow: (() => FlowLinkAdapter | null) | undefined;

  /**
   * Create a new PortConnectionTool instance
   * @param {Object} options - Configuration options
   * @param {EntityManager} options.entityManager - Manager for entity operations
   * @param {RenderEventManager} options.renderEvents - Render event dispatcher
   * @param {Function} [options.getFlow] - Optional callback to get flow link adapter
   */
  constructor(options: {
    entityManager: EntityManager;
    renderEvents: RenderEventManager;
    getFlow?: () => FlowLinkAdapter | null;
  }) {
    this.entityManager = options.entityManager;
    this.renderEvents = options.renderEvents;
    this.getFlow = options.getFlow;
  }

  /**
   * Handle mouse down event to start port connection
   * @param {PointerLikeEvent} e - Pointer event details
   * @param {InteractionEnv} env - Interaction environment
   * @returns {boolean} True if event was consumed
   */
  onMouseDown(e: PointerLikeEvent, env: InteractionEnv): boolean {
    const world = toWorldPoint(e, env);
    if (!world) return false;

    const hit = hitTestPort(
      this.entityManager,
      world,
      (info) => info.descriptor.direction === "out"
    );
    if (!hit) return false;

    const flow = this.getFlow?.();
    const lineArgs = {
      x: hit.port.x,
      y: hit.port.y,
      width: 0,
      height: 0,
      sourceId: hit.entity.id,
      sourcePort: hit.port.descriptor.name,
      sourcePortIndex: hit.nameIndex,
    };

    const created = flow
      ? (flow.createEdgeEntity("uml-line-canvas", lineArgs) as UMLLineEntity | null)
      : (this.entityManager.createEntity("uml-line-canvas", lineArgs) as UMLLineEntity | null);

    const line = created;

    if (!line) return false;

    line.setConnection({
      sourceId: hit.entity.id,
      sourcePort: hit.port.descriptor.name,
      sourcePortIndex: hit.nameIndex,
      targetId: null,
    });

    const detail: EntityUpdateDetail = {
      changes: ["position"],
      prevBounds: line.getBounds(),
      nextBounds: line.getBounds(),
      renderHint: { level: "partial" },
    };
    updateEntity(this.entityManager, line, detail);

    this.renderEvents.requestRenderEntities({
      entityIds: [line.id],
      reason: "connection-start",
    });

    this.state = {
      line,
      source: {
        nodeId: hit.entity.id,
        portName: hit.port.descriptor.name,
        portIndex: hit.nameIndex,
      },
    };

    return true;
  }

  /**
   * Handle mouse move event during connection drag
   * @param {PointerLikeEvent} e - Pointer event details
   * @param {InteractionEnv} env - Interaction environment
   * @returns {boolean} True if event was consumed
   */
  onMouseMove(e: PointerLikeEvent, env: InteractionEnv): boolean {
    if (!this.state) return false;
    const world = toWorldPoint(e, env);
    if (!world) return true;

    const { line } = this.state;
    const prevBounds = line.getBounds();
    line.setConnection({
      sourceId: this.state.source.nodeId,
      sourcePort: this.state.source.portName,
      sourcePortIndex: this.state.source.portIndex,
      targetId: null,
    });
    line.setLineEnd(world.x, world.y);
    const nextBounds = line.getBounds();

    updateEntity(this.entityManager, line, {
      changes: ["position"],
      prevBounds,
      nextBounds,
      renderHint: { level: "partial" },
    });

    this.renderEvents.requestRenderEntities({
      entityIds: [line.id],
      reason: "connection-drag",
    });

    return true;
  }

  /**
   * Handle mouse up event to complete or cancel connection
   * @param {PointerLikeEvent} e - Pointer event details
   * @param {InteractionEnv} env - Interaction environment
   * @returns {boolean} True if event was consumed
   */
  onMouseUp(e: PointerLikeEvent, env: InteractionEnv): boolean {
    if (!this.state) return false;

    const world = toWorldPoint(e, env);
    if (!world) {
      this.cancelConnection();
      return true;
    }

    const targetHit = hitTestPort(
      this.entityManager,
      world,
      (info) => info.descriptor.direction === "in"
    );
    if (!targetHit) {
      this.cancelConnection();
      return true;
    }

    const { line, source } = this.state;
    const flow = this.getFlow?.();
    const prevBounds = line.getBounds();

    line.setConnection({
      sourceId: source.nodeId,
      sourcePort: source.portName,
      sourcePortIndex: source.portIndex,
      targetId: targetHit.entity.id,
      targetPort: targetHit.port.descriptor.name,
      targetPortIndex: targetHit.nameIndex,
    });

    line.setLineEnd(targetHit.port.x, targetHit.port.y);
    const nextBounds = line.getBounds();

    updateEntity(this.entityManager, line, {
      changes: ["position", "connection"],
      prevBounds,
      nextBounds,
      renderHint: { level: "partial" },
    });

    this.renderEvents.requestRenderEntities({
      entityIds: [line.id],
      reason: "connection-complete",
    });

    if (flow) {
      flow.linkNodes(source.nodeId, targetHit.entity.id, {
        edgeId: line.id,
        sourcePort: source.portName,
        sourcePortIndex: source.portIndex,
        targetPort: targetHit.port.descriptor.name,
        targetPortIndex: targetHit.nameIndex,
      });
    }

    this.state = null;
    return true;
  }

  /**
   * Handle mouse leave event to cancel ongoing connection
   * @returns {boolean} True if event was consumed
   */
  onMouseLeave(): boolean {
    if (!this.state) return false;
    this.cancelConnection();
    return true;
  }

  /**
   * Cleanup tool resources and cancel any pending operation
   */
  dispose() {
    if (this.state) {
      this.cancelConnection();
    }
  }

  private cancelConnection() {
    if (!this.state) return;
    const { line, source } = this.state;
    const flow = this.getFlow?.();
    const lineId = line.id;
    const existingEdge = flow?.getEdgeEntity?.(lineId);
    try {
      if (flow) {
        flow.removeEdgeEntity?.(lineId);
      } else {
        this.entityManager.removeEntity(lineId);
      }
    } catch {
      // ignore removal errors
    }
    this.renderEvents.requestRenderEntities({
      entityIds: [lineId],
      reason: "connection-cancel",
      op: "remove",
    });

    if (flow && source.nodeId && existingEdge?.edge?.targets) {
      for (const target of existingEdge.edge.targets) {
        if (target?.nodeId) {
          flow.unlinkNodes(source.nodeId, target.nodeId);
        }
      }
    }
    this.state = null;
  }
}
