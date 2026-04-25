/**
 * Flow Helper Utilities for E2E Tests
 *
 * Provides flow operations using centralized selector constants.
 * All flow operations use deterministic selectors from test/e2e/selectors.ts
 *
 * @module test/e2e/helpers/flow-helpers
 */

import type { Page } from "@playwright/test";
import { FlowSelectors } from "../selectors";
import { SelectorHelpers } from "./selector-helpers";

/**
 * Flow test data interface
 */
export interface TestFlow {
  id: string;
  name: string;
}

/**
 * Flow node test data interface
 */
export interface FlowNode {
  id: string;
  type: string;
  x: number;
  y: number;
}

interface ExecutionTelemetryEvent {
  type: "started" | "completed" | "failed";
  flowId: string;
  timestamp: number;
  nodesExecuted?: number;
  durationMs?: number;
  errorDetails?: string;
}

export interface ExecutionTelemetry {
  status: "completed" | "failed";
  durationMs?: number;
  errorDetails?: string;
  event?: ExecutionTelemetryEvent | null;
}

declare global {
  interface Window {
    __flowExecutionEvents?: ExecutionTelemetryEvent[];
  }
}

/**
 * Flow helper utilities for flow management operations
 */
export class FlowHelpers {
  /**
   * Create a new test flow
   *
   * @param page - Playwright page instance
   * @param flow - Flow data to create
   * @throws Throws if flow creation fails
   *
   * @example
   * await FlowHelpers.createFlow(page, {
   *   id: 'flow-1',
   *   name: 'Test Flow'
   * });
   */
  static async createFlow(page: Page, flow: TestFlow): Promise<void> {
    try {
      // Click create flow button
      await SelectorHelpers.clickWithRetry(page, FlowSelectors.createButton, 2);

      // Fill in flow ID
      await SelectorHelpers.fillWithRetry(page, FlowSelectors.idInput, flow.id, 2);

      // Fill in flow name
      await SelectorHelpers.fillWithRetry(page, FlowSelectors.nameInput, flow.name, 2);

      // Wait for save button and click it
      await SelectorHelpers.clickWithRetry(page, FlowSelectors.saveButton, 2);

      // Verify flow was created
      await SelectorHelpers.waitForSelector(page, FlowSelectors.container(flow.id), 10000);
    } catch (error) {
      throw new Error(
        `Failed to create flow "${flow.name}" (id: ${flow.id}). ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute a flow
   *
   * @param page - Playwright page instance
   * @param flowId - ID of the flow to execute
   * @throws Throws if flow execution fails
   *
   * @example
   * await FlowHelpers.executeFlow(page, 'flow-1');
   */
  static async executeFlow(page: Page, flowId: string): Promise<ExecutionTelemetry> {
    try {
      // Ensure flow exists
      await SelectorHelpers.waitForSelector(page, FlowSelectors.container(flowId), 5000);

      // Trigger execution via control button
      await SelectorHelpers.clickWithRetry(page, FlowSelectors.executeButton(flowId), 2);

      // Wait for execution to emit telemetry
      return await FlowHelpers.waitForExecutionResult(page);
    } catch (error) {
      throw new Error(
        `Failed to execute flow with id "${flowId}". ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Verify flow execution completed
   *
   * @param page - Playwright page instance
   * @param flowId - ID of the flow to verify
   * @returns true if flow shows completion state
   *
   * @example
   * const completed = await FlowHelpers.verifyFlowExecution(page, 'flow-1');
   */
  static async verifyFlowExecution(page: Page, flowId: string): Promise<boolean> {
    const telemetry = await FlowHelpers.waitForExecutionResult(page);

    if (telemetry.status !== "completed") {
      return false;
    }

    if (telemetry.event && telemetry.event.flowId !== flowId) {
      throw new Error(
        `Execution telemetry flowId mismatch. Expected ${flowId}, received ${telemetry.event.flowId}`
      );
    }

    return true;
  }

  static async waitForExecutionResult(
    page: Page,
    options: { timeout?: number } = {}
  ): Promise<ExecutionTelemetry> {
    const { timeout = 15000 } = options;

    await SelectorHelpers.waitForSelector(page, FlowSelectors.executionComplete, timeout);

    const statusAttr = await page
      .locator(FlowSelectors.executionComplete)
      .getAttribute("data-status");
    const status = statusAttr === "failed" ? "failed" : "completed";

    const executionTimeText = await SelectorHelpers.getText(page, FlowSelectors.executionTime);
    let durationMs = FlowHelpers.parseDuration(executionTimeText ?? undefined);
    let errorDetails: string | undefined;

    if (status === "failed") {
      const errorText = await SelectorHelpers.getText(page, FlowSelectors.executionErrorDetails);
      errorDetails = errorText?.trim() || undefined;
    }

    const resultJson = await SelectorHelpers.getText(page, FlowSelectors.executionResultPanel);
    if (resultJson) {
      try {
        const parsed = JSON.parse(resultJson) as {
          status?: string;
          durationMs?: number;
          errorDetails?: string;
        };
        if (typeof parsed.durationMs === "number" && typeof durationMs !== "number") {
          durationMs = parsed.durationMs;
        }
        if (!errorDetails && typeof parsed.errorDetails === "string") {
          errorDetails = parsed.errorDetails;
        }
      } catch {
        // Ignore JSON parse errors in UI dump
      }
    }

    const event = await page.evaluate(() => {
      const runtime = globalThis as typeof globalThis & {
        __flowExecutionEvents?: ExecutionTelemetryEvent[];
      };
      const events = runtime.__flowExecutionEvents ?? [];
      return events.at(-1) ?? null;
    });

    return {
      status,
      durationMs,
      errorDetails,
      event,
    };
  }

  static async expectExecutionError(
    page: Page,
    flowId: string,
    expectedDetail?: string,
    options: { timeout?: number } = {}
  ): Promise<ExecutionTelemetry> {
    const telemetry = await FlowHelpers.waitForExecutionResult(page, options);

    if (telemetry.status !== "failed") {
      throw new Error(`Expected flow ${flowId} to fail, but status was ${telemetry.status}.`);
    }

    if (expectedDetail && !telemetry.errorDetails?.includes(expectedDetail)) {
      throw new Error(
        `Expected error details to contain "${expectedDetail}" but received "${telemetry.errorDetails ?? ""}".`
      );
    }

    if (telemetry.event && telemetry.event.flowId !== flowId) {
      throw new Error(
        `Execution telemetry flowId mismatch. Expected ${flowId}, received ${telemetry.event.flowId}`
      );
    }

    return telemetry;
  }

  static async getExecutionTimeline(page: Page): Promise<ExecutionTelemetryEvent[]> {
    return page.evaluate(() => {
      const runtime = globalThis as typeof globalThis & {
        __flowExecutionEvents?: ExecutionTelemetryEvent[];
      };
      const events = runtime.__flowExecutionEvents ?? [];
      return events.map((event) => ({ ...event }));
    });
  }

  private static parseDuration(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }
    const match = value.match(/(-?\d+(?:\.\d+)?)\s*ms/i);
    if (!match) {
      return undefined;
    }
    const parsed = Number.parseFloat(match[1]);
    return Number.isNaN(parsed) ? undefined : Math.round(parsed);
  }

  /**
   * Add a node to a flow
   *
   * @param page - Playwright page instance
   * @param flowId - ID of the flow
   * @param node - Node data
   * @throws Throws if node addition fails
   *
   * @example
   * await FlowHelpers.addNode(page, 'flow-1', {
   *   id: 'node-1',
   *   type: 'start',
   *   x: 100,
   *   y: 100
   * });
   */
  static async addNode(page: Page, flowId: string, node: FlowNode): Promise<void> {
    try {
      // Click add node button
      await SelectorHelpers.clickWithRetry(page, FlowSelectors.addNodeButton, 2);

      // Fill node details
      await SelectorHelpers.fillWithRetry(page, FlowSelectors.nodeIdInput, node.id, 2);
      await SelectorHelpers.fillWithRetry(page, FlowSelectors.nodeTypeInput, node.type, 2);
      await SelectorHelpers.fillWithRetry(page, FlowSelectors.nodeXInput, String(node.x), 2);
      await SelectorHelpers.fillWithRetry(page, FlowSelectors.nodeYInput, String(node.y), 2);

      // Confirm node creation
      await SelectorHelpers.clickWithRetry(page, FlowSelectors.confirmNodeButton, 2);

      // Verify node was added
      await SelectorHelpers.waitForSelector(page, FlowSelectors.nodeButton(node.id), 5000);
    } catch (error) {
      throw new Error(
        `Failed to add node "${node.id}" to flow "${flowId}". ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Reset a flow to initial state
   *
   * @param page - Playwright page instance
   * @param flowId - ID of the flow to reset
   * @throws Throws if reset fails
   *
   * @example
   * await FlowHelpers.resetFlow(page, 'flow-1');
   */
  static async resetFlow(page: Page, flowId: string): Promise<void> {
    try {
      // Click reset button
      await SelectorHelpers.clickWithRetry(page, FlowSelectors.resetButton, 2);

      // Wait for reset to complete
      await page.waitForTimeout(500);
    } catch (error) {
      throw new Error(
        `Failed to reset flow with id "${flowId}". ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Delete a flow
   *
   * @param page - Playwright page instance
   * @param flowId - ID of the flow to delete
   * @throws Throws if deletion fails
   *
   * @example
   * await FlowHelpers.deleteFlow(page, 'flow-1');
   */
  static async deleteFlow(page: Page, flowId: string): Promise<void> {
    try {
      // Verify flow exists
      const selector = FlowSelectors.container(flowId);
      await SelectorHelpers.waitForSelector(page, selector, 5000);

      // Right-click to open context menu or find delete button
      await page.click(selector, { button: "right" });

      // Wait for context menu to appear
      await page.waitForTimeout(300);

      // Click delete option (may vary based on implementation)
      const deleteOption = '[data-testid="flow-delete"]';
      if (await SelectorHelpers.isVisible(page, deleteOption, 2000)) {
        await SelectorHelpers.clickWithRetry(page, deleteOption, 2);
      } else {
        throw new Error("Delete option not found in context menu");
      }

      // Verify flow is removed
      const exists = await SelectorHelpers.isVisible(page, selector, 3000);
      if (exists) {
        throw new Error(`Flow ${flowId} still visible after deletion`);
      }
    } catch (error) {
      throw new Error(
        `Failed to delete flow with id "${flowId}". ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get flow container locator
   *
   * @param page - Playwright page instance
   * @param flowId - ID of the flow
   * @returns Playwright Locator for the flow container
   *
   * @example
   * const flowLocator = FlowHelpers.getFlowLocator(page, 'flow-1');
   */
  static getFlowLocator(page: Page, flowId: string) {
    return page.locator(FlowSelectors.container(flowId));
  }

  /**
   * Count total flows
   *
   * @param page - Playwright page instance
   * @returns Number of visible flows
   *
   * @example
   * const count = await FlowHelpers.countFlows(page);
   */
  static async countFlows(page: Page): Promise<number> {
    try {
      return await page.locator('[data-testid^="flow-"]').count();
    } catch (error) {
      console.warn(
        `Failed to count flows: ${error instanceof Error ? error.message : String(error)}`
      );
      return 0;
    }
  }
}
