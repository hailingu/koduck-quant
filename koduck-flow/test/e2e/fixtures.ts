/* eslint-disable react-hooks/rules-of-hooks */
import { test as base } from "@playwright/test";
import type { Page, BrowserContext } from "@playwright/test";
import { SelectorHelpers, EntityHelpers, FlowHelpers, TenantHelpers } from "./helpers";

// Test data fixtures
export const testData = {
  entities: {
    basic: {
      id: "test-entity-001",
      type: "node",
      name: "Test Entity",
      properties: { color: "blue", size: "medium" },
    },
    complex: {
      id: "test-entity-002",
      type: "flow",
      name: "Complex Flow Entity",
      properties: { nodes: 5, connections: 8, complexity: "high" },
    },
  },
  flows: {
    simple: {
      id: "test-flow-001",
      name: "Simple Flow",
      nodes: [
        { id: "start", type: "start", position: { x: 100, y: 100 } },
        { id: "process", type: "process", position: { x: 200, y: 100 } },
        { id: "end", type: "end", position: { x: 300, y: 100 } },
      ],
      connections: [
        { from: "start", to: "process" },
        { from: "process", to: "end" },
      ],
    },
    complex: {
      id: "test-flow-002",
      name: "Complex Flow",
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
    },
  },
  tenants: {
    tenantA: {
      id: "tenant-a",
      name: "Tenant A",
      config: { theme: "light", features: ["basic", "advanced"] },
    },
    tenantB: {
      id: "tenant-b",
      name: "Tenant B",
      config: { theme: "dark", features: ["basic"] },
    },
  },
  quotaScenarios: {
    basic: {
      tenantId: "tenant-quota-basic",
      name: "Basic Quota Scenario",
      quotas: {
        maxEntities: 100,
        maxWorkflowDefinitions: 50,
        maxConcurrentRuns: 10,
      },
    },
    restricted: {
      tenantId: "tenant-quota-restricted",
      name: "Restricted Quota Scenario",
      quotas: {
        maxEntities: 5,
        maxWorkflowDefinitions: 2,
        maxConcurrentRuns: 1,
      },
    },
    edgeCase: {
      tenantId: "tenant-quota-edge",
      name: "Edge Case Quota Scenario",
      quotas: {
        maxEntities: 1,
        maxWorkflowDefinitions: 1,
        maxConcurrentRuns: 1,
      },
    },
  },
};

// Extend the base test with our fixtures
export const test = base.extend<{
  runtimePage: Page;
  context: BrowserContext;
  testEntity: typeof testData.entities.basic;
  testFlow: typeof testData.flows.simple;
  tenantContext: { tenantId: string; config: typeof testData.tenants.tenantA.config };
}>({
  // Fixture for a page with DuckFlow runtime initialized
  runtimePage: async ({ page }: { page: Page }, use: (page: Page) => Promise<void>) => {
    // Navigate to the app
    await page.goto("/");

    // Wait for runtime to be ready (adjust selector based on your app)
    await page.waitForSelector('[data-testid="runtime-ready"]', { timeout: 10000 });

    // Use the page in the test
    await use(page);
  },

  // Enhanced context with additional utilities
  context: async (
    { context }: { context: BrowserContext },
    use: (context: BrowserContext) => Promise<void>
  ) => {
    // Add any context-level setup here
    await use(context);
  },

  // Fixture for a test entity
  // eslint-disable-next-line no-empty-pattern
  testEntity: async ({}, use) => {
    const entity = testData.entities.basic;
    await use(entity);
  },

  // Fixture for a test flow
  // eslint-disable-next-line no-empty-pattern
  testFlow: async ({}, use) => {
    const flow = testData.flows.simple;
    await use(flow);
  },

  // Fixture for tenant context
  // eslint-disable-next-line no-empty-pattern
  tenantContext: async ({}, use) => {
    const tenant = testData.tenants.tenantA;
    await use({ tenantId: tenant.id, config: tenant.config });
  },
});

// Re-export expect for convenience
export { expect } from "@playwright/test";

// Re-export helper classes for convenience in tests
// These are now modularized in the helpers directory
export {
  SelectorHelpers,
  EntityHelpers,
  FlowHelpers,
  TenantHelpers,
  RendererHelpers,
  type TestEntity,
  type TestFlow,
  type FlowNode,
  type TestTenant,
} from "./helpers";

/**
 * @deprecated Use SelectorHelpers, EntityHelpers, FlowHelpers, and TenantHelpers directly from ./helpers
 *
 * Legacy E2EHelpers wrapper for backwards compatibility.
 * This class has been refactored into modularized helpers for better maintainability.
 *
 * @example
 * // Old way (still works):
 * import { E2EHelpers } from 'test/e2e/fixtures';
 * await E2EHelpers.waitForRuntimeReady(page);
 *
 * // New way (recommended):
 * import { SelectorHelpers, EntityHelpers } from 'test/e2e/helpers';
 * await SelectorHelpers.isRuntimeReady(page);
 * await EntityHelpers.createTestEntity(page, { id: 'e1', name: 'Test' });
 */
export class E2EHelpers {
  /**
   * Wait for runtime to be ready
   * @deprecated Use SelectorHelpers.isRuntimeReady() instead
   */
  static async waitForRuntimeReady(page: Page): Promise<void> {
    await SelectorHelpers.waitForSelector(page, '[data-testid="runtime-ready"]', 10000);
  }

  /**
   * Create a test entity
   * @deprecated Use EntityHelpers.createTestEntity() instead
   */
  static async createTestEntity(
    page: Page,
    entityData: { id: string; type: string; name?: string }
  ): Promise<void> {
    await EntityHelpers.createTestEntity(page, {
      id: entityData.id,
      name: entityData.name || entityData.type,
      type: entityData.type,
    });
  }

  /**
   * Verify entity exists
   * @deprecated Use EntityHelpers.verifyEntityExists() instead
   */
  static async verifyEntityExists(page: Page, entityId: string): Promise<void> {
    const exists = await EntityHelpers.verifyEntityExists(page, entityId);
    if (!exists) {
      throw new Error(`Entity ${entityId} not found`);
    }
  }

  /**
   * Delete test entity
   * @deprecated Use EntityHelpers.deleteTestEntity() instead
   */
  static async deleteTestEntity(page: Page, entityId: string): Promise<void> {
    await EntityHelpers.deleteTestEntity(page, entityId);
  }

  /**
   * Create flow
   * @deprecated Use FlowHelpers.createFlow() instead
   */
  static async createFlow(
    page: Page,
    flowData: {
      id: string;
      name: string;
      nodes: Array<{ id: string; type: string; position: { x: number; y: number } }>;
      connections: Array<{ from: string; to: string; condition?: string }>;
    }
  ): Promise<void> {
    await FlowHelpers.createFlow(page, {
      id: flowData.id,
      name: flowData.name,
    });

    // Add nodes one by one
    for (const node of flowData.nodes) {
      await FlowHelpers.addNode(page, flowData.id, {
        id: node.id,
        type: node.type,
        x: node.position.x,
        y: node.position.y,
      });
    }
  }

  /**
   * Execute flow
   * @deprecated Use FlowHelpers.executeFlow() instead
   */
  static async executeFlow(page: Page, flowId: string): Promise<void> {
    await FlowHelpers.executeFlow(page, flowId);
  }

  /**
   * Verify flow execution
   * @deprecated Use FlowHelpers.verifyFlowExecution() instead
   */
  static async verifyFlowExecution(page: Page, flowId: string): Promise<void> {
    const completed = await FlowHelpers.verifyFlowExecution(page, flowId);
    if (!completed) {
      throw new Error(`Flow ${flowId} did not complete`);
    }
  }

  /**
   * Switch tenant
   * @deprecated Use TenantHelpers.switchTenant() instead
   */
  static async switchTenant(page: Page, tenantId: string): Promise<void> {
    await TenantHelpers.switchTenant(page, tenantId);
  }

  /**
   * Verify tenant isolation
   * @deprecated Use TenantHelpers.verifyTenantIsolation() instead
   */
  static async verifyTenantIsolation(page: Page, tenantId: string): Promise<void> {
    const currentTenant = await TenantHelpers.getCurrentTenant(page);
    if (!currentTenant || !currentTenant.includes(tenantId)) {
      throw new Error(`Tenant context mismatch. Expected ${tenantId}, current: ${currentTenant}`);
    }

    const available = await TenantHelpers.isTenantAvailable(page, tenantId);
    if (!available) {
      throw new Error(`Tenant ${tenantId} is not available`);
    }
  }

  /**
   * Create entity in tenant
   * @deprecated Use TenantHelpers.createEntityInTenant() instead
   */
  static async createEntityInTenant(
    page: Page,
    tenantId: string,
    entityData: { id: string; type: string; name?: string }
  ): Promise<void> {
    await TenantHelpers.createEntityInTenant(page, tenantId, {
      id: entityData.id,
      type: entityData.type,
      name: entityData.name || entityData.type,
    });
  }
}
