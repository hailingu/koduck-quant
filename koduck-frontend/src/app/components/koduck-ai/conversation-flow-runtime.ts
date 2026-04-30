import {
  createKoduckFlowRuntime,
  type KoduckFlowRuntime,
} from "@koduck-flow/common/runtime/koduck-flow-runtime";
import { EntityRegistry } from "@koduck-flow/common/entity/entity-registry";
import type {
  IFlowEdgeEntityArguments,
} from "@koduck-flow/common/flow/flow-edge-entity";
import { FlowEdgeEntity } from "@koduck-flow/common/flow/flow-edge-entity";
import type {
  IFlowNodeEntityArguments,
} from "@koduck-flow/common/flow/flow-node-entity";
import { FlowNodeEntity } from "@koduck-flow/common/flow/flow-node-entity";
import type {
  IFlowEdgeEntityData,
  IFlowNodeEntityData,
} from "@koduck-flow/common/flow/model-types";

export interface ConversationFlowRuntimeSnapshot {
  entityCount: number;
  renderQueueSize: number;
  dirtyEntityCount: number;
  pendingFullRedraw: boolean;
}

const CONVERSATION_FLOW_NODE_ENTITY_TYPE = "koduck-ai-conversation-flow-node";
const CONVERSATION_FLOW_EDGE_ENTITY_TYPE = "koduck-ai-conversation-flow-edge";

export function createConversationFlowRuntime(): KoduckFlowRuntime {
  const runtime = createKoduckFlowRuntime({
    enableMetrics: true,
    enableCache: true,
  });

  if (!runtime.EntityManager.hasEntityType(CONVERSATION_FLOW_NODE_ENTITY_TYPE)) {
    runtime.EntityManager.registerEntityType(
      CONVERSATION_FLOW_NODE_ENTITY_TYPE,
      new EntityRegistry(FlowNodeEntity, undefined, {
        type: CONVERSATION_FLOW_NODE_ENTITY_TYPE,
        description: "Koduck AI conversation flow node",
      }),
    );
  }

  if (!runtime.EntityManager.hasEntityType(CONVERSATION_FLOW_EDGE_ENTITY_TYPE)) {
    runtime.EntityManager.registerEntityType(
      CONVERSATION_FLOW_EDGE_ENTITY_TYPE,
      new EntityRegistry(FlowEdgeEntity, undefined, {
        type: CONVERSATION_FLOW_EDGE_ENTITY_TYPE,
        description: "Koduck AI conversation flow edge",
      }),
    );
  }

  runtime.RenderManager.init({
    autoRenderOnAdd: false,
    enableCache: true,
  });

  return runtime;
}

export function syncConversationFlowRuntime(
  runtime: KoduckFlowRuntime,
  nodes: IFlowNodeEntityData[],
  edges: IFlowEdgeEntityData[],
): ConversationFlowRuntimeSnapshot {
  clearConversationFlowRuntime(runtime);

  for (const node of nodes) {
    const entity = runtime.createEntity<FlowNodeEntity>(
      CONVERSATION_FLOW_NODE_ENTITY_TYPE,
      node as IFlowNodeEntityArguments,
    );
    if (!entity) {
      continue;
    }

    mergeConversationFlowEntityData(entity, node, node.id);
    runtime.RenderManager.addEntityToRender(entity, { markDirty: true });
  }

  for (const edge of edges) {
    const entity = runtime.createEntity<FlowEdgeEntity>(
      CONVERSATION_FLOW_EDGE_ENTITY_TYPE,
      edge as IFlowEdgeEntityArguments,
    );
    if (!entity) {
      continue;
    }

    mergeConversationFlowEntityData(entity, edge, edge.id);
    runtime.RenderManager.addEntityToRender(entity, { markDirty: true });
  }

  return getConversationFlowRuntimeSnapshot(runtime);
}

export function moveConversationFlowRuntimeNode(
  runtime: KoduckFlowRuntime,
  sourceNodeId: string,
  position: IFlowNodeEntityData["position"],
): ConversationFlowRuntimeSnapshot | undefined {
  const entityId = getConversationFlowRuntimeEntityId(runtime, sourceNodeId);
  if (!entityId) {
    return undefined;
  }

  const entity = runtime.getEntity<FlowNodeEntity>(entityId);
  if (!entity) {
    return undefined;
  }

  const previousPosition = entity.getPosition();
  const size = entity.getSize();
  entity.setPosition(position);
  runtime.EntityManager.updateEntity(entity, {
    changes: ["position"],
    prevBounds: { ...previousPosition, ...size },
    nextBounds: { ...position, ...size },
    renderHint: {
      level: "partial",
      rects: [
        { ...previousPosition, ...size },
        { ...position, ...size },
      ],
    },
  });
  runtime.RenderManager.entityTracker.markEntityDirtyById(
    entityId,
    "conversation-flow:node-move",
  );
  return getConversationFlowRuntimeSnapshot(runtime);
}

export function createConversationFlowRuntimeEdge(
  runtime: KoduckFlowRuntime,
  edge: IFlowEdgeEntityData,
): ConversationFlowRuntimeSnapshot | undefined {
  if (getConversationFlowRuntimeEntityId(runtime, edge.id)) {
    return getConversationFlowRuntimeSnapshot(runtime);
  }

  const entity = runtime.createEntity<FlowEdgeEntity>(
    CONVERSATION_FLOW_EDGE_ENTITY_TYPE,
    edge as IFlowEdgeEntityArguments,
  );
  if (!entity) {
    return undefined;
  }

  mergeConversationFlowEntityData(entity, edge, edge.id);
  runtime.RenderManager.addEntityToRender(entity, { markDirty: true });
  return getConversationFlowRuntimeSnapshot(runtime);
}

export function deleteConversationFlowRuntimeEdge(
  runtime: KoduckFlowRuntime,
  sourceEdgeId: string,
): ConversationFlowRuntimeSnapshot | undefined {
  const entityId = getConversationFlowRuntimeEntityId(runtime, sourceEdgeId);
  if (!entityId) {
    return undefined;
  }

  runtime.RenderManager.removeEntityFromRender(entityId, {
    markDirty: true,
    schedule: true,
  });
  runtime.removeEntity(entityId);
  return getConversationFlowRuntimeSnapshot(runtime);
}

export function getConversationFlowRuntimeEntityId(
  runtime: KoduckFlowRuntime,
  sourceId: string,
): string | undefined {
  return runtime
    .getEntities()
    .find((entity) => {
      const data = entity.data as
        | (Record<string, unknown> & {
            metadata?: Record<string, unknown>;
          })
        | undefined;
      return data?.id === sourceId || data?.metadata?.runtimeSourceId === sourceId;
    })?.id;
}

export function clearConversationFlowRuntime(runtime: KoduckFlowRuntime): void {
  for (const entity of Array.from(runtime.RenderManager.entityTracker.getEntities())) {
    runtime.RenderManager.removeEntityFromRender(entity.id, {
      markDirty: false,
      schedule: false,
    });
  }
  runtime.EntityManager.removeAllEntities();
}

function getConversationFlowRuntimeSnapshot(
  runtime: KoduckFlowRuntime,
): ConversationFlowRuntimeSnapshot {
  const renderStats = runtime.RenderManager.getRenderStats();
  return {
    entityCount: runtime.getEntities().length,
    renderQueueSize: runtime.RenderManager.entityTracker.getSize(),
    dirtyEntityCount: renderStats.dirtyEntityCount,
    pendingFullRedraw: renderStats.pendingFullRedraw,
  };
}

function mergeConversationFlowEntityData(
  entity: FlowNodeEntity | FlowEdgeEntity,
  data: IFlowNodeEntityData | IFlowEdgeEntityData,
  sourceId: string,
): void {
  const currentData = entity.data;
  if (!currentData) {
    entity.data = data;
    return;
  }

  Object.assign(currentData, data, {
    metadata: {
      ...(data.metadata ?? {}),
      runtimeSourceId: sourceId,
    },
  });
}
