/**
 * FlowDemo-specific E2E helpers
 *
 * Provides high-level abstractions for FlowDemo interactions:
 * - Node creation, selection, and deletion
 * - Node dragging and positioning
 * - Connection creation between nodes
 * - Canvas pan and zoom operations
 * - Undo/redo history management
 * - Visual feedback verification
 *
 * @see test/e2e/flow-demo.spec.ts for usage examples
 */

import { Page, Locator, expect } from "@playwright/test";
import { FlowDemoSelectors } from "../selectors";

export class FlowDemoHelpers {
  constructor(private page: Page) {}

  /**
   * Create a new node by clicking the add node button
   * @returns A locator to the newly created node
   */
  async createNode(): Promise<Locator> {
    const addButton = this.page.locator(FlowDemoSelectors.addNodeButton);
    const countBefore = await this.page.locator(FlowDemoSelectors.canvasNodeContainer).count();

    await addButton.click();
    await this.page.waitForTimeout(150);

    const countAfter = await this.page.locator(FlowDemoSelectors.canvasNodeContainer).count();
    expect(countAfter).toBeGreaterThan(countBefore);

    // Return the last created node
    return this.page.locator(FlowDemoSelectors.canvasNodeContainer).last();
  }

  /**
   * Create multiple nodes
   * @param count Number of nodes to create
   * @returns Array of node locators
   */
  async createMultipleNodes(count: number): Promise<Locator[]> {
    const nodes: Locator[] = [];
    for (let i = 0; i < count; i++) {
      const node = await this.createNode();
      nodes.push(node);
    }
    return nodes;
  }

  /**
   * Select a node by clicking on it
   * @param node The node locator to select
   */
  async selectNode(node: Locator): Promise<void> {
    await node.click();
    await this.page.waitForTimeout(100);
  }

  /**
   * Select multiple nodes using Shift+click
   * @param nodes Array of node locators to select
   */
  async selectMultipleNodes(nodes: Locator[]): Promise<void> {
    if (nodes.length === 0) return;

    // Click first node normally
    await nodes[0].click();
    await this.page.waitForTimeout(100);

    // Shift+click remaining nodes
    for (let i = 1; i < nodes.length; i++) {
      await nodes[i].click({ modifiers: ["Shift"] });
      await this.page.waitForTimeout(100);
    }
  }

  /**
   * Delete the currently selected node(s)
   */
  async deleteSelectedNode(): Promise<void> {
    await this.page.keyboard.press("Delete");
    await this.page.waitForTimeout(200);
  }

  /**
   * Verify a node is selected by checking for selection state
   * @param node The node locator to verify
   */
  async verifyNodeIsSelected(node: Locator): Promise<boolean> {
    const selectedState = await node.evaluate((el) => el.dataset.selected);
    const hasSelectedClass = await node.evaluate(
      (el) => el.classList.contains("selected") || el.classList.contains("is-selected")
    );

    return selectedState === "true" || hasSelectedClass;
  }

  /**
   * Get current node count
   * @returns Number of nodes on canvas
   */
  async getNodeCount(): Promise<number> {
    return this.page.locator(FlowDemoSelectors.canvasNodeContainer).count();
  }

  /**
   * Drag a node to a new position
   * @param node The node locator to drag
   * @param deltaX Pixels to move right
   * @param deltaY Pixels to move down
   */
  async dragNode(node: Locator, deltaX: number, deltaY: number): Promise<void> {
    const box = await node.boundingBox();
    if (!box) throw new Error("Node bounding box not found");

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.waitForTimeout(50);
    await this.page.mouse.move(startX + deltaX, startY + deltaY);
    await this.page.mouse.up();
    await this.page.waitForTimeout(200);
  }

  /**
   * Create a connection between two nodes
   * @param sourceNode The source node locator
   * @param targetNode The target node locator
   */
  async createConnection(sourceNode: Locator, targetNode: Locator): Promise<void> {
    const sourceBox = await sourceNode.boundingBox();
    const targetBox = await targetNode.boundingBox();

    if (!sourceBox || !targetBox) {
      throw new Error("Source or target node bounding box not found");
    }

    const sourceX = sourceBox.x + sourceBox.width / 2;
    const sourceY = sourceBox.y + sourceBox.height / 2;
    const targetX = targetBox.x + targetBox.width / 2;
    const targetY = targetBox.y + targetBox.height / 2;

    // Drag from source to target
    await this.page.mouse.move(sourceX, sourceY);
    await this.page.mouse.down();
    await this.page.waitForTimeout(50);
    await this.page.mouse.move(targetX, targetY);
    await this.page.mouse.up();
    await this.page.waitForTimeout(200);
  }

  /**
   * Get current connection count
   * @returns Number of connections on canvas
   */
  async getConnectionCount(): Promise<number> {
    return this.page.locator(FlowDemoSelectors.connectionElement).count();
  }

  /**
   * Undo the last operation
   */
  async undo(): Promise<void> {
    const isMac = process.platform === "darwin";
    await this.page.keyboard.press(isMac ? "Meta+Z" : "Control+Z");
    await this.page.waitForTimeout(200);
  }

  /**
   * Redo the last undone operation
   */
  async redo(): Promise<void> {
    const isMac = process.platform === "darwin";
    await this.page.keyboard.press(isMac ? "Meta+Shift+Z" : "Control+Shift+Z");
    await this.page.waitForTimeout(200);
  }

  /**
   * Pan the canvas view
   * @param deltaX Pixels to pan right
   * @param deltaY Pixels to pan down
   */
  async panCanvas(deltaX: number, deltaY: number): Promise<void> {
    const canvas = this.page.locator("canvas").first();
    const box = await canvas.boundingBox();

    if (!box) throw new Error("Canvas bounding box not found");

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    // Middle-mouse drag (or space+drag) to pan
    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down({ button: "middle" });
    await this.page.waitForTimeout(50);
    await this.page.mouse.move(startX + deltaX, startY + deltaY);
    await this.page.mouse.up({ button: "middle" });
    await this.page.waitForTimeout(200);
  }

  /**
   * Zoom canvas with mouse wheel
   * @param direction 1 for zoom in, -1 for zoom out
   * @param amount Number of scroll increments
   */
  async zoomCanvas(direction: number, amount: number = 3): Promise<void> {
    const canvas = this.page.locator("canvas").first();
    const box = await canvas.boundingBox();

    if (!box) throw new Error("Canvas bounding box not found");

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    await this.page.mouse.move(centerX, centerY);
    await this.page.mouse.wheel(0, -direction * amount);
    await this.page.waitForTimeout(200);
  }

  /**
   * Verify node count display is correct
   * @param expectedCount Expected number of nodes
   */
  async verifyNodeCountDisplay(expectedCount: number): Promise<void> {
    const display = this.page.locator(FlowDemoSelectors.nodeCountIndicator);
    const isVisible = await display.isVisible().catch(() => false);

    if (isVisible) {
      const text = await display.textContent();
      expect(text).toContain(expectedCount.toString());
    }
  }

  /**
   * Verify connection count display is correct
   * @param expectedCount Expected number of connections
   */
  async verifyConnectionCountDisplay(expectedCount: number): Promise<void> {
    const display = this.page.locator(FlowDemoSelectors.connectionCountIndicator);
    const isVisible = await display.isVisible().catch(() => false);

    if (isVisible) {
      const text = await display.textContent();
      expect(text).toContain(expectedCount.toString());
    }
  }

  /**
   * Get all nodes on the canvas
   * @returns Array of node locators
   */
  async getAllNodes(): Promise<Locator[]> {
    return this.page.locator(FlowDemoSelectors.canvasNodeContainer).all();
  }

  /**
   * Get all connections on the canvas
   * @returns Array of connection locators
   */
  async getAllConnections(): Promise<Locator[]> {
    return this.page.locator(FlowDemoSelectors.connectionElement).all();
  }

  /**
   * Wait for canvas to be ready
   * @param timeout Milliseconds to wait
   */
  async waitForCanvasReady(timeout: number = 5000): Promise<void> {
    const canvas = this.page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout });
  }

  /**
   * Verify node can be interacted with
   * @param node The node locator to verify
   */
  async verifyNodeIsInteractive(node: Locator): Promise<boolean> {
    const isVisible = await node.isVisible().catch(() => false);
    const isEnabled = await node.isEnabled().catch(() => false);
    return isVisible && isEnabled;
  }
}

/**
 * Create a new FlowDemoHelpers instance
 * @param page The Playwright Page object
 * @returns FlowDemoHelpers instance
 */
export function createFlowDemoHelpers(page: Page): FlowDemoHelpers {
  return new FlowDemoHelpers(page);
}

export default FlowDemoHelpers;
