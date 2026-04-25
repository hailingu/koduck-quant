import { describe, expect, it } from "vitest";
import { FlowGraphAST } from "../../../src/common/flow";

describe("FlowGraphAST", () => {
  it("allows multiple parents per child and detaching one keeps others intact", () => {
    const graph = new FlowGraphAST();
    graph.addNode({ id: "parentA" });
    graph.addNode({ id: "parentB" });
    graph.addNode({ id: "child" });

    graph.attachChild("parentA", "child");
    graph.attachChild("parentB", "child");

    expect(graph.getParents("child").sort()).toEqual(["parentA", "parentB"]);
    expect(graph.getChildren("parentA").map((link) => link.targetId)).toEqual([
      "child",
    ]);
    expect(graph.getChildren("parentB").map((link) => link.targetId)).toEqual([
      "child",
    ]);
    expect(graph.getRoots().sort()).toEqual(["parentA", "parentB"]);

    graph.detachChild("parentA", "child");

    expect(graph.getParents("child")).toEqual(["parentB"]);
    expect(graph.getChildren("parentA")).toEqual([]);
    expect(graph.getChildren("parentB").map((link) => link.targetId)).toEqual([
      "child",
    ]);
    expect(graph.getRoots().sort()).toEqual(["parentA", "parentB"]);
  });

  it("prevents cycles when attaching children", () => {
    const graph = new FlowGraphAST();
    graph.addNode({ id: "a" });
    graph.addNode({ id: "b" });
    graph.attachChild("a", "b");

    expect(() => graph.attachChild("b", "a")).toThrow(/cycle/);
  });

  it("serializes and restores graph structure including metadata", () => {
    const graph = new FlowGraphAST();
    graph.addNode({ id: "source", entityType: "node" });
    graph.addNode({ id: "target" });

    const metadata = { edgeId: "edge-1", label: "primary" } as const;
    graph.attachChild("source", "target", { ...metadata });

    const snapshot = graph.toJSON();
    const restored = FlowGraphAST.fromJSON(snapshot);

    expect(restored.getRoots()).toEqual(["source"]);
    expect(restored.getParents("target")).toEqual(["source"]);
    const [link] = restored.getChildren("source");
    expect(link?.targetId).toBe("target");
    expect(link?.metadata).toEqual(metadata);

    const children = restored.getChildren("source");
    children[0].metadata!.label = "mutated";

    const freshSnapshot = restored.getChildren("source")[0];
    expect(freshSnapshot.metadata?.label).toBe("primary");
  });
});
