import { describe, expect, it } from "vitest";
import { createEntityGuards } from "../../src/common/flow/utils/entity-guards";
import type {
  IEndpoint,
  IFlowEdgeEntity,
  IFlowNodeEntity,
  INodeBase,
  IEdge,
} from "../../src/common/flow/types";

type TestNodeEntity = IFlowNodeEntity & { kind?: string };
type TestEdgeEntity = IFlowEdgeEntity;

const createStubNode = (id: string): INodeBase => {
  const addChild: INodeBase["addChild"] = () => 0;
  const removeChild: INodeBase["removeChild"] = () => false;
  const setChild: INodeBase["setChild"] = () => {
    /* noop for test stub */
  };
  const removeChildAt: INodeBase["removeChildAt"] = () => undefined;
  const insertChildAt: INodeBase["insertChildAt"] = () => {
    /* noop for test stub */
  };

  return {
    id,
    parent: undefined,
    next: undefined,
    pre: undefined,
    children: [] as INodeBase[],
    getChildCount: () => 0,
    getDepth: () => 0,
    isRoot: () => true,
    isLeaf: () => true,
    addChild,
    removeChild,
    setChild,
    removeChildAt,
    insertChildAt,
    dispose: () => {
      /* noop for test stub */
    },
    toJSON: () => ({ id }),
  };
};

const createStubEndpoint = (nodeId: string): IEndpoint => ({
  nodeId,
  port: "out",
  state: "active",
  dispose: () => {
    /* noop for test stub */
  },
  toJSON: () => ({ nodeId }),
});

const createStubEdge = (sourceId: string, targetId: string): IEdge => ({
  sources: [createStubEndpoint(sourceId)],
  targets: [createStubEndpoint(targetId)],
  isValid: true,
  state: "active",
  dispose: () => {
    /* noop for test stub */
  },
  toJSON: () => ({ sourceId, targetId }),
  setState: () => {
    /* noop for test stub */
  },
  activate: () => {
    /* noop for test stub */
  },
  deactivate: () => {
    /* noop for test stub */
  },
  disable: () => {
    /* noop for test stub */
  },
  isActive: () => true,
  connectsNode: () => false,
  connectsNodes: () => false,
  getOtherNodes: () => [],
  isSelfLoop: () => false,
});

const createBaseEntity = (id: string, type: string) => ({
  id,
  type,
  data: undefined,
  config: undefined,
  dispose: () => {
    /* noop for test stub */
  },
  toJSON: () => ({ id, type }),
});

const createNodeEntity = (id: string, extras?: Record<string, unknown>): TestNodeEntity => {
  const entity = {
    ...createBaseEntity(id, "node"),
    node: createStubNode(id),
  };
  return extras ? ({ ...entity, ...extras } as TestNodeEntity) : (entity as TestNodeEntity);
};

const createEdgeEntity = (id: string, source: string, target: string): TestEdgeEntity =>
  ({
    ...createBaseEntity(id, "edge"),
    edge: createStubEdge(source, target),
  }) as TestEdgeEntity;

describe("createEntityGuards", () => {
  it("identifies node and edge entities using default heuristics", () => {
    const guards = createEntityGuards<TestNodeEntity, TestEdgeEntity>();

    const nodeEntity = createNodeEntity("node-1");
    const edgeEntity = createEdgeEntity("edge-1", "node-1", "node-2");

    const maybeNode: unknown = nodeEntity;
    const maybeEdge: unknown = edgeEntity;

    expect(guards.isNodeEntity(maybeNode)).toBe(true);
    if (guards.isNodeEntity(maybeNode)) {
      expect(maybeNode.node.id).toBe("node-1");
    }

    expect(guards.isEdgeEntity(maybeEdge)).toBe(true);
    if (guards.isEdgeEntity(maybeEdge)) {
      expect(maybeEdge.edge.sources[0]?.nodeId).toBe("node-1");
    }

    expect(guards.isNodeEntity(edgeEntity)).toBe(false);
    expect(guards.isEdgeEntity(nodeEntity)).toBe(false);
  });

  it("rejects values that are not flow entities", () => {
    const guards = createEntityGuards<TestNodeEntity, TestEdgeEntity>();

    expect(guards.isNodeEntity(null)).toBe(false);
    expect(guards.isNodeEntity(undefined)).toBe(false);
    expect(guards.isNodeEntity({ id: "node-1" })).toBe(false);

    expect(guards.isEdgeEntity(null)).toBe(false);
    expect(guards.isEdgeEntity(42)).toBe(false);
    expect(guards.isEdgeEntity({ id: "edge-1" })).toBe(false);
  });

  it("supports custom guard overrides with fallback to default heuristics", () => {
    const guards = createEntityGuards<TestNodeEntity, TestEdgeEntity>({
      isNodeEntity: (entity, fallback): entity is TestNodeEntity => {
        if (typeof entity === "object" && entity !== null && "kind" in entity) {
          const candidate = entity as { kind?: string };
          if (candidate.kind === "node") {
            return fallback(entity);
          }
          return false;
        }
        return fallback(entity);
      },
    });

    const standardNode = createNodeEntity("node-2");
    const decoratedNode = createNodeEntity("node-3", { kind: "node" });
    const mismatched = createNodeEntity("node-4", { kind: "edge" });

    expect(guards.isNodeEntity(decoratedNode)).toBe(true);
    expect(guards.isNodeEntity(standardNode)).toBe(true);
    expect(guards.isNodeEntity(mismatched)).toBe(false);
  });
});
