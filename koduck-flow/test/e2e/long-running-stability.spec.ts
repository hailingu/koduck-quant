import { test, expect, E2EHelpers } from "./fixtures";
import { getStabilityConfig, logStabilityConfig } from "./stability-config";
import type { Page } from "@playwright/test";

/**
 * Stability metrics tracker
 */
interface StabilityMetrics {
  startTime: number;
  iterations: number;
  errors: number;
  memoryPeaks: number[];
  renderTimes: number[];
  entityOperations: number;
  flowExecutions: number;
}

/**
 * Helper to execute a single stability iteration
 */
async function executeStabilityIteration(
  page: Page,
  iterationIndex: number,
  metrics: StabilityMetrics,
  checkInterval: number
): Promise<void> {
  const iterationStart = Date.now();

  try {
    // Create test entity
    const entityId = `stability-entity-${iterationIndex.toString().padStart(3, "0")}`;
    const entityData = { id: entityId, type: "node", name: `Stability Entity ${iterationIndex}` };
    await E2EHelpers.createTestEntity(page, entityData);
    await E2EHelpers.verifyEntityExists(page, entityId);
    metrics.entityOperations++;

    // Create and execute flow
    const flowData = {
      id: `stability-flow-${iterationIndex.toString().padStart(3, "0")}`,
      name: `Stability Flow ${iterationIndex}`,
      nodes: [
        { id: "start", type: "start", position: { x: 100, y: 100 } },
        { id: "process", type: "process", position: { x: 200, y: 100 } },
        { id: "end", type: "end", position: { x: 300, y: 100 } },
      ],
      connections: [
        { from: "start", to: "process" },
        { from: "process", to: "end" },
      ],
    };
    await E2EHelpers.createFlow(page, flowData);
    await E2EHelpers.executeFlow(page, flowData.id);
    await E2EHelpers.verifyFlowExecution(page, flowData.id);
    metrics.flowExecutions++;

    // Periodic renderer switching
    if (iterationIndex % 5 === 0) {
      await page.click('[data-testid="renderer-selector"]');
      await page.click('[data-testid="renderer-canvas"]');
      await page.waitForSelector('[data-testid="renderer-active-canvas"]', { timeout: 5000 });
      await page.click('[data-testid="renderer-selector"]');
      await page.click('[data-testid="renderer-react"]');
      await page.waitForSelector('[data-testid="renderer-active-react"]', { timeout: 5000 });
    }

    // Measure render performance
    const renderStart = Date.now();
    await page.click('[data-testid="refresh-view"]');
    await page.waitForSelector('[data-testid="render-complete"]', { timeout: 10000 });
    const renderTime = Date.now() - renderStart;
    metrics.renderTimes.push(renderTime);

    // Record memory usage
    const memoryUsage = await page.evaluate(() => {
      if (
        "memory" in performance &&
        (performance as { memory?: { usedJSHeapSize: number } }).memory
      ) {
        return (performance as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize;
      }
      return null;
    });
    if (memoryUsage !== null) {
      metrics.memoryPeaks.push(memoryUsage);
    }

    // Clean up old entities
    if (iterationIndex > 10) {
      const oldEntityId = `stability-entity-${(iterationIndex - 10).toString().padStart(3, "0")}`;
      try {
        await E2EHelpers.deleteTestEntity(page, oldEntityId);
      } catch {
        // Entity might already be deleted, continue
      }
    }

    metrics.iterations++;
    const iterationTime = Date.now() - iterationStart;
    if (getStabilityConfig().verboseLogging) {
      console.log(`Iteration ${iterationIndex + 1} completed in ${iterationTime}ms`);
    }

    // Wait for next iteration
    const remainingWait = checkInterval - iterationTime;
    if (remainingWait > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingWait));
    }
  } catch (error) {
    metrics.errors++;
    console.error(`Error in iteration ${iterationIndex + 1}:`, error);
  }
}

/**
 * Helper to log stability metrics
 */
function logStabilityMetrics(metrics: StabilityMetrics): void {
  const totalDuration = Date.now() - metrics.startTime;
  console.log("\nStability Test Results:");
  console.log(`- Total duration: ${totalDuration}ms`);
  console.log(`- Iterations completed: ${metrics.iterations}`);
  console.log(`- Errors encountered: ${metrics.errors}`);
  console.log(`- Entity operations: ${metrics.entityOperations}`);
  console.log(`- Flow executions: ${metrics.flowExecutions}`);

  if (metrics.renderTimes.length > 0) {
    const avgRenderTime =
      metrics.renderTimes.reduce((a, b) => a + b, 0) / metrics.renderTimes.length;
    const maxRenderTime = Math.max(...metrics.renderTimes);
    console.log(`- Average render time: ${avgRenderTime.toFixed(2)}ms`);
    console.log(`- Max render time: ${maxRenderTime}ms`);
  }

  if (metrics.memoryPeaks.length > 0) {
    const avgMemory = metrics.memoryPeaks.reduce((a, b) => a + b, 0) / metrics.memoryPeaks.length;
    const maxMemory = Math.max(...metrics.memoryPeaks);
    console.log(`- Average memory usage: ${(avgMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Peak memory usage: ${(maxMemory / 1024 / 1024).toFixed(2)} MB`);
  }
}

// NOTE: Stability harness requires configurable telemetry (tracked in docs/e2e-remediation-plan.md#phase-b)
test.describe("Long-running Stability", () => {
  const config = getStabilityConfig();
  const switchIterations = Math.max(
    1,
    Math.ceil(config.duration / Math.max(config.switchInterval, 1))
  );
  const websocketWindow = Math.max(config.duration / 2, config.checkInterval * 6);
  const suiteTimeout =
    Math.max(config.duration, config.switchInterval * switchIterations, websocketWindow) + 120_000;
  test.describe.configure({ timeout: suiteTimeout });
  // Note: This test suite implements parameterized stability tests that can be configured
  // via environment variables (PW_STABILITY_*) for different execution modes:
  // - 'quick': ~1 minute for PR CI verification
  // - 'standard': ~5 minutes for local development (default)
  // - 'extended': ~24 hours for nightly CI runs
  // - 'custom': user-defined parameters via individual env variables

  test("should maintain stability over extended period", async ({ runtimePage }) => {
    const config = getStabilityConfig();
    logStabilityConfig();

    await E2EHelpers.waitForRuntimeReady(runtimePage);

    const testDuration = config.duration;
    const checkInterval = config.interval;
    const maxIterations = config.iterations;

    const stabilityMetrics: StabilityMetrics = {
      startTime: Date.now(),
      iterations: 0,
      errors: 0,
      memoryPeaks: [],
      renderTimes: [],
      entityOperations: 0,
      flowExecutions: 0,
    };

    console.log(`Starting stability test for ${testDuration / 1000 / 60} minutes`);

    for (let i = 0; i < maxIterations; i++) {
      await executeStabilityIteration(runtimePage, i, stabilityMetrics, checkInterval);
    }

    // Log and validate results
    logStabilityMetrics(stabilityMetrics);

    // Stability assertions
    const successRate =
      (stabilityMetrics.iterations - stabilityMetrics.errors) / stabilityMetrics.iterations;
    expect(successRate).toBeGreaterThan(0.95); // 95% success rate

    expect(stabilityMetrics.entityOperations).toBeGreaterThan(0);
    expect(stabilityMetrics.flowExecutions).toBeGreaterThan(0);

    // Validate memory growth
    if (stabilityMetrics.memoryPeaks.length > 1) {
      const initialMemory = stabilityMetrics.memoryPeaks[0];
      const finalMemory = stabilityMetrics.memoryPeaks.at(-1);
      const memoryGrowth = ((finalMemory ?? 0) - initialMemory) / initialMemory;
      expect(memoryGrowth).toBeLessThan(2); // Memory growth should be less than 200%
    }

    // Validate render performance consistency
    if (stabilityMetrics.renderTimes.length > 10) {
      const recentRenders = stabilityMetrics.renderTimes.slice(-10);
      const avgRecent = recentRenders.reduce((a, b) => a + b, 0) / recentRenders.length;
      const firstRenders = stabilityMetrics.renderTimes.slice(0, 10);
      const avgFirst = firstRenders.reduce((a, b) => a + b, 0) / firstRenders.length;

      const performanceDegradation = (avgRecent - avgFirst) / avgFirst;
      expect(performanceDegradation).toBeLessThan(0.5); // Performance degradation should be less than 50%
    }
  });

  test("should handle tenant switching during long-running operations", async ({ runtimePage }) => {
    await E2EHelpers.waitForRuntimeReady(runtimePage);

    const config = getStabilityConfig();
    const testDuration = config.duration;
    const switchInterval = Math.max(1000, config.switchInterval);
    const maxIterations = Math.max(1, Math.floor(testDuration / switchInterval));

    for (let i = 0; i < maxIterations; i++) {
      // Switch between tenants
      const tenantId = i % 2 === 0 ? "tenant-a" : "tenant-b";
      await E2EHelpers.switchTenant(runtimePage, tenantId);

      // Perform operations in each tenant
      const entityData = {
        id: `tenant-stability-entity-${i}`,
        type: "node",
        name: `Tenant Stability Entity ${i}`,
      };

      await E2EHelpers.createEntityInTenant(runtimePage, tenantId, entityData);
      await E2EHelpers.verifyTenantIsolation(runtimePage, tenantId);

      // Execute a flow in the tenant
      const flowData = {
        id: `tenant-stability-flow-${i}`,
        name: `Tenant Stability Flow ${i}`,
        nodes: [
          { id: "start", type: "start", position: { x: 100, y: 100 } },
          { id: "process", type: "process", position: { x: 200, y: 100 } },
          { id: "end", type: "end", position: { x: 300, y: 100 } },
        ],
        connections: [
          { from: "start", to: "process" },
          { from: "process", to: "end" },
        ],
      };

      await E2EHelpers.createFlow(runtimePage, flowData);
      await E2EHelpers.executeFlow(runtimePage, flowData.id);

      console.log(`Tenant switch ${i + 1}/${maxIterations} completed for ${tenantId}`);

      // Wait before next switch
      await new Promise((resolve) => setTimeout(resolve, switchInterval));
    }

    // Verify tenant isolation is maintained
    await E2EHelpers.switchTenant(runtimePage, "tenant-a");
    await expect(
      runtimePage.locator('[data-testid="entity-tenant-stability-entity-0"]')
    ).toBeVisible();
    await expect(
      runtimePage.locator('[data-testid="entity-tenant-stability-entity-1"]')
    ).not.toBeVisible();

    await E2EHelpers.switchTenant(runtimePage, "tenant-b");
    await expect(
      runtimePage.locator('[data-testid="entity-tenant-stability-entity-1"]')
    ).toBeVisible();
    await expect(
      runtimePage.locator('[data-testid="entity-tenant-stability-entity-0"]')
    ).not.toBeVisible();
  });

  test("should maintain WebSocket connections during extended operations", async ({
    runtimePage,
  }) => {
    await E2EHelpers.waitForRuntimeReady(runtimePage);

    // This test assumes the app uses WebSocket connections
    // Monitor connection status over time

    const connectionChecks = [];
    const config = getStabilityConfig();
    const checkInterval = Math.max(1000, config.checkInterval);
    const testDuration = Math.max(config.duration / 2, checkInterval * 6);
    const iterations = Math.max(1, Math.ceil(testDuration / checkInterval));

    for (let i = 0; i < iterations; i++) {
      // Check WebSocket connection status
      const connectionStatus = await runtimePage.evaluate(() => {
        const harnessWindow = globalThis as typeof globalThis & {
          __entityHarnessBridge?: {
            getWebSocketStatus?: () => {
              connected: boolean;
              lastChange: number;
              reconnectAttempts: number;
            };
          };
        };

        return (
          harnessWindow.__entityHarnessBridge?.getWebSocketStatus?.() ?? {
            connected: false,
            lastChange: Date.now(),
            reconnectAttempts: 0,
          }
        );
      });

      connectionChecks.push(connectionStatus);

      // Perform some operations to generate WebSocket traffic
      const entityData = {
        id: `ws-test-entity-${i}`,
        type: "node",
        name: `WS Test Entity ${i}`,
      };

      await E2EHelpers.createTestEntity(runtimePage, entityData);

      // Wait for next check
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    // Verify connections remained stable
    const successfulConnections = connectionChecks.filter((check) => check.connected).length;
    const connectionStability = successfulConnections / connectionChecks.length;

    expect(connectionStability).toBe(1); // 100% connection stability

    const errorSnapshot = await runtimePage.evaluate(() => {
      const harnessWindow = globalThis as typeof globalThis & {
        __entityHarnessBridge?: {
          getErrorSnapshot?: () => { total: number };
        };
      };

      return harnessWindow.__entityHarnessBridge?.getErrorSnapshot?.() ?? { total: 0 };
    });

    expect(errorSnapshot.total).toBe(0);
  });
});
