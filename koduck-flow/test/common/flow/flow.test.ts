import { describe, expect, it, beforeEach } from "vitest";
import { Flow } from "../../../src/common/flow";
import { FlowEntity } from "../../../src/common/flow/flow-entity";
import { BaseNode } from "../../../src/common/flow/base-node";
import type { EntityManager } from "../../../src/common/entity/entity-manager";
import type {
  FlowASTSnapshot,
  IEndpoint,
  IFlowEdgeEntity,
  IFlowEntity,
  IEdge,
} from "../../../src/common/flow/types";
import { FlowGraphAST } from "../../../src/common/flow/flow-graph";
import { projectFlowGraphToTree } from "../../../src/common/flow/flow-graph-view";

class StubEntityManager {
  private readonly entities = new Map<string, IFlowEntity>();
  events = {
    added: { addEventListener: () => () => void 0 },
    removed: { addEventListener: () => () => void 0 },
    updated: { addEventListener: () => () => void 0 },
  };

  add(entity: IFlowEntity): void {
    this.entities.set(entity.id, entity);
  }

  getEntity(id: string): IFlowEntity | undefined {
    return this.entities.get(id);
  }

  getEntities(): IFlowEntity[] {
    return [...this.entities.values()];
  }

  createEntity(): null {
    return null;
  }

  removeEntity(id: string): boolean {
    return this.entities.delete(id);
  }

  updateEntity(entity: IFlowEntity): boolean {
    if (!entity?.id) return false;
    this.entities.set(entity.id, entity);
    return true;
  }

  batchUpdateEntity(): number {
    return 0;
  }
}

class StubEndpoint implements IEndpoint {
  state: "active" | "inactive" | "disabled" = "active";

  constructor(
    public nodeId: string,
    public port: string,
    public portIndex?: number
  ) {}

  dispose(): void {
    // no-op for tests
  }

  toJSON(): Record<string, unknown> {
    return {
      nodeId: this.nodeId,
      port: this.port,
      portIndex: this.portIndex,
      state: this.state,
    };
  }
}

class StubEdge implements IEdge {
  private _state: "active" | "inactive" | "disabled";

  constructor(
    public readonly sources: IEndpoint[],
    public readonly targets: IEndpoint[],
    state: "active" | "inactive" | "disabled" = "active"
  ) {
    this._state = state;
  }

  get isValid(): boolean {
    return this.sources.length > 0 && this.targets.length > 0;
  }

  get state(): "active" | "inactive" | "disabled" {
    return this._state;
  }

  setState(state: "active" | "inactive" | "disabled"): void {
    this._state = state;
  }

  activate(): void {
    this._state = "active";
  }

  deactivate(): void {
    this._state = "inactive";
  }

  disable(): void {
    this._state = "disabled";
  }

  isActive(): boolean {
    return this._state === "active";
  }

  connectsNode(nodeId: string): boolean {
    return (
      this.sources.some((source) => source.nodeId === nodeId) ||
      this.targets.some((target) => target.nodeId === nodeId)
    );
  }

  connectsNodes(node1: string, node2: string): boolean {
    return (
      this.sources.some((source) => source.nodeId === node1) &&
      this.targets.some((target) => target.nodeId === node2)
    );
  }

  getOtherNodes(nodeId: string): string[] {
    const others = new Set<string>();
    for (const endpoint of [...this.sources, ...this.targets]) {
      if (endpoint.nodeId !== nodeId) {
        others.add(endpoint.nodeId);
      }
    }
    return [...others];
  }

  isSelfLoop(): boolean {
    return this.sources.some((source) =>
      this.targets.some((target) => target.nodeId === source.nodeId)
    );
  }

  dispose(): void {
    // no-op for tests
  }

  toJSON(): Record<string, unknown> {
    return {
      sources: this.sources.map((endpoint) => endpoint.toJSON()),
      targets: this.targets.map((endpoint) => endpoint.toJSON()),
      state: this._state,
    };
  }
}

class StubEdgeEntity implements IFlowEdgeEntity<StubEdge> {
  readonly type = "stub-edge";

  constructor(public readonly id: string, public readonly edge: StubEdge) {}

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      edge: this.edge.toJSON(),
    };
  }

  dispose(): void {
    // no-op for tests
  }
}

describe("Flow graph APIs", () => {
  let manager: StubEntityManager;
  let flow: Flow;
  let parent: FlowEntity;
  let child: FlowEntity;

  beforeEach(() => {
    manager = new StubEntityManager();
    flow = new Flow(manager as unknown as EntityManager, "flow-test");

    parent = new FlowEntity(new BaseNode(), "parent");
    child = new FlowEntity(new BaseNode(), "child");
    manager.add(parent);
    manager.add(child);
  });

  it("registers nodes and parent links via addNode", () => {
    flow.addNode(parent);
    flow.addNode(child, {
      parentIds: [parent.id],
      linkMetadata: () => ({ role: "branch" }),
    });

    const parents = flow.flowGraph?.getParents(child.id) ?? [];
    expect(parents).toEqual([parent.id]);

    const children = flow.flowGraph?.getChildren(parent.id) ?? [];
    expect(children[0]?.metadata?.role).toBe("branch");
  });

  it("links and unlinks nodes directly", () => {
    flow.addNode(parent);
    flow.addNode(child);

    const ok = flow.linkNodes(parent.id, child.id, { label: "edge" });
    expect(ok).toBe(true);
    expect(flow.flowGraph?.getChildren(parent.id)).toHaveLength(1);

    const removed = flow.unlinkNodes(parent.id, child.id);
    expect(removed).toBe(true);
    expect(flow.flowGraph?.getChildren(parent.id)).toHaveLength(0);
  });

  it("supports nodes with multiple parents", () => {
    const altParent = new FlowEntity(new BaseNode(), "alt-parent");
    const multiChild = new FlowEntity(new BaseNode(), "multi-child");
    manager.add(altParent);
    manager.add(multiChild);

    flow.addNode(parent);
    flow.addNode(altParent);
    flow.addNode(multiChild, {
      parentIds: [parent.id, altParent.id],
      linkMetadata: (sourceId) => ({ sourceId }),
    });

    const parents = flow.flowGraph?.getParents(multiChild.id)?.sort();
    expect(parents).toEqual([altParent.id, parent.id].sort());
  });

  it("keeps AST and edge registry in sync when edges are added and removed", () => {
    const target = new FlowEntity(new BaseNode(), "target");
    manager.add(target);

    flow.addNode(parent);
    flow.addNode(target);

    const edge = new StubEdgeEntity(
      "edge-1",
      new StubEdge(
        [new StubEndpoint(parent.id, "out", 0)],
        [new StubEndpoint(target.id, "in", 0)]
      )
    );
    manager.add(edge);

    expect(flow.addEdgeEntity(edge)).toBe(true);
    expect(flow.getEdgeEntity(edge.id)).toBe(edge);

    const children = flow.flowGraph?.getChildren(parent.id) ?? [];
    expect(children).toHaveLength(1);
    expect(children[0]?.metadata?.edgeId).toBe(edge.id);

    const removed = flow.removeEdgeEntity(edge.id);
    expect(removed).toBe(true);
    expect(flow.getEdgeEntity(edge.id)).toBeUndefined();
    expect(flow.flowGraph?.getChildren(parent.id)).toHaveLength(0);
  });

  it("prevents cycles during linking", () => {
    const middle = new FlowEntity(new BaseNode(), "middle");
    const last = new FlowEntity(new BaseNode(), "last");
    manager.add(middle);
    manager.add(last);

    flow.addNode(parent);
    flow.addNode(middle, { parentIds: [parent.id] });
    flow.addNode(last, { parentIds: [middle.id] });

    const linked = flow.linkNodes(last.id, parent.id);
    expect(linked).toBe(false);
    const parents = flow.flowGraph?.getParents(parent.id) ?? [];
    expect(parents).toHaveLength(0);
  });
});

describe("projectFlowGraphToTree", () => {
  it("projects a multi-parent graph into a tree structure", () => {
    const graph = new FlowGraphAST();
    graph.addNode({ id: "root", entityType: "Root" });
    graph.addNode({ id: "leafA", entityType: "Leaf" });
    graph.addNode({ id: "leafB", entityType: "Leaf" });

    graph.attachChild("root", "leafA", { role: "left" });
    graph.attachChild("root", "leafB", { role: "right" });

    const forest = projectFlowGraphToTree(graph);
    expect(forest).toHaveLength(1);

    const [tree] = forest;
    expect(tree?.id).toBe("root");
    expect(tree?.children).toHaveLength(2);
    const childRoles = tree?.children.map((child) => child.linkMetadata?.role);
    expect(childRoles).toContain("left");
    expect(childRoles).toContain("right");
  });

  it("supports deduplication across branches", () => {
    const graph = new FlowGraphAST();
    graph.addNode({ id: "A" });
    graph.addNode({ id: "B" });
    graph.addNode({ id: "C" });

    graph.attachChild("A", "B");
    graph.attachChild("A", "C");
    graph.attachChild("B", "C");

    const forest = projectFlowGraphToTree(graph, { dedupe: true });
    const [tree] = forest;
    expect(tree?.children).toHaveLength(1);
    const bNode = tree?.children[0];
    expect(bNode?.children).toHaveLength(1);
    expect(bNode?.children[0]?.id).toBe("C");
  });
});

describe("Flow serialization", () => {
  it("preserves multi-parent relationships across serialization", () => {
    const manager = new StubEntityManager();
    const flow = new Flow(manager as unknown as EntityManager, "flow-json");

    const root = new FlowEntity(new BaseNode(), "root");
    const aux = new FlowEntity(new BaseNode(), "aux");
    const leaf = new FlowEntity(new BaseNode(), "leaf");
    manager.add(root);
    manager.add(aux);
    manager.add(leaf);

    flow.addNode(root);
    flow.addNode(aux);
    flow.addNode(leaf, { parentIds: [root.id, aux.id] });

    const snapshot = flow.toJSON().flowGraph as FlowASTSnapshot;
    const leafSnapshot = snapshot.nodes.find((node) => node.id === leaf.id);
    expect(leafSnapshot?.parents.sort()).toEqual([aux.id, root.id].sort());

    const restored = new Flow(
      new StubEntityManager() as unknown as EntityManager,
      "restored"
    );
    restored.loadFromJSON(flow.toJSON());

    const restoredParents = restored.flowGraph?.getParents(leaf.id)?.sort();
    expect(restoredParents).toEqual([aux.id, root.id].sort());
  });
});
