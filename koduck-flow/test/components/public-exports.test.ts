import { describe, expect, it } from "vitest";

import * as Root from "../../src";
import * as Components from "../../src/components";
import * as FlowEntity from "../../src/components/flow-entity";
import packageJson from "../../package.json";

describe("public component exports", () => {
  it("exports flow entity core components from the flow-entity barrel", () => {
    expect(FlowEntity.FlowCanvas).toBeDefined();
    expect(FlowEntity.BaseFlowNode).toBeDefined();
    expect(FlowEntity.BaseFlowEdge).toBeDefined();
  });

  it("exports flow entity core components from the components barrel", () => {
    expect(Components.FlowCanvas).toBe(FlowEntity.FlowCanvas);
    expect(Components.BaseFlowNode).toBe(FlowEntity.BaseFlowNode);
    expect(Components.BaseFlowEdge).toBe(FlowEntity.BaseFlowEdge);
  });

  it("exports flow entity core components from the package root", () => {
    expect(Root.FlowCanvas).toBe(FlowEntity.FlowCanvas);
    expect(Root.BaseFlowNode).toBe(FlowEntity.BaseFlowNode);
    expect(Root.BaseFlowEdge).toBe(FlowEntity.BaseFlowEdge);
  });

  it("declares stable package export entry points", () => {
    expect(packageJson.exports).toMatchObject({
      ".": {
        types: "./src/index.ts",
        import: "./src/index.ts",
      },
      "./components": {
        types: "./src/components/index.ts",
        import: "./src/components/index.ts",
      },
      "./components/flow-entity": {
        types: "./src/components/flow-entity/index.ts",
        import: "./src/components/flow-entity/index.ts",
      },
    });
  });
});
