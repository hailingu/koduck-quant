import { test, expect, E2EHelpers } from "./fixtures";

// NOTE: Suite disabled until flow execution telemetry is wired (see docs/e2e-remediation-plan.md#phase-c)
test.describe.skip("Flow Execution (E2E-002)", () => {
  test("should create and execute a simple flow", async ({ runtimePage, testFlow }) => {
    // Create flow
    await E2EHelpers.createFlow(runtimePage, testFlow);

    // Verify flow exists
    await expect(runtimePage.locator(`[data-testid="flow-${testFlow.id}"]`)).toBeVisible();

    // Execute flow
    await E2EHelpers.executeFlow(runtimePage, testFlow.id);

    // Verify execution result
    await E2EHelpers.verifyFlowExecution(runtimePage, testFlow.id);
  });

  test("should execute a complex flow with decision points", async ({ runtimePage }) => {
    const complexFlow = {
      id: "complex-flow-test",
      name: "Complex Decision Flow",
      nodes: [
        { id: "start", type: "start", position: { x: 100, y: 100 } },
        { id: "decision", type: "decision", position: { x: 200, y: 100 } },
        { id: "process1", type: "process", position: { x: 150, y: 200 } },
        { id: "process2", type: "process", position: { x: 250, y: 200 } },
        { id: "end", type: "end", position: { x: 300, y: 100 } },
      ],
      connections: [
        { from: "start", to: "decision" },
        { from: "decision", to: "process1", condition: "yes" },
        { from: "decision", to: "process2", condition: "no" },
        { from: "process1", to: "end" },
        { from: "process2", to: "end" },
      ],
    };

    // Create flow
    await E2EHelpers.createFlow(runtimePage, complexFlow);

    // Execute flow
    await E2EHelpers.executeFlow(runtimePage, complexFlow.id);

    // Verify execution result
    await E2EHelpers.verifyFlowExecution(runtimePage, complexFlow.id);
  });

  test("should handle flow execution errors gracefully", async ({ runtimePage }) => {
    const errorFlow = {
      id: "error-flow-test",
      name: "Flow with Error",
      nodes: [
        { id: "start", type: "start", position: { x: 100, y: 100 } },
        { id: "error-node", type: "error", position: { x: 200, y: 100 } },
        { id: "end", type: "end", position: { x: 300, y: 100 } },
      ],
      connections: [
        { from: "start", to: "error-node" },
        { from: "error-node", to: "end" },
      ],
    };

    // Create flow
    await E2EHelpers.createFlow(runtimePage, errorFlow);

    // Execute flow (expecting error handling)
    await E2EHelpers.executeFlow(runtimePage, errorFlow.id);

    // Verify error was handled
    await expect(runtimePage.locator('[data-testid="execution-error"]')).toBeVisible();
    await expect(runtimePage.locator('[data-testid="error-details"]')).toContainText("error-node");
  });

  test("should verify flow execution performance", async ({ runtimePage, testFlow }) => {
    // Create flow
    await E2EHelpers.createFlow(runtimePage, testFlow);

    // Measure execution time
    const startTime = Date.now();
    await E2EHelpers.executeFlow(runtimePage, testFlow.id);
    const endTime = Date.now();
    const executionTime = endTime - startTime;

    // Verify execution completed within reasonable time (30 seconds max)
    expect(executionTime).toBeLessThan(30000);

    // Verify performance metrics are displayed
    await expect(runtimePage.locator('[data-testid="execution-time"]')).toContainText(
      `${executionTime}ms`
    );
  });
});
