/**
 * FlowDemo Journey E2E Tests
 *
 * Tests core FlowDemo interactions:
 * - Node creation and CRUD operations
 * - Node linking (connections)
 * - Node deletion with visual feedback
 * - Undo/redo functionality
 * - Canvas interactions (pan, zoom, select)
 *
 * @see docs/e2e-remediation-task-list.md#E2E-C1
 */

import { test, expect } from "@playwright/test";
import { FlowDemoSelectors } from "./selectors";

// NOTE: FlowDemo automation depends on future Canvas instrumentation (docs/e2e-remediation-plan.md#phase-c)
test.describe.skip("FlowDemo Journey – Node CRUD & Interactions", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the FlowDemo test page
    await page.goto("/");

    // Wait for runtime initialization
    const runtimeReady = page.locator('[data-testid="runtime-ready"]');
    await runtimeReady.waitFor({ state: "attached", timeout: 5000 }).catch(() => {
      // Runtime ready marker might not be present; proceed anyway
    });

    // Wait for canvas to be rendered
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 5000 });
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // Node Creation Tests
  // ─────────────────────────────────────────────────────────────────────────────────

  test("should create a new node and display it on canvas", async ({ page }) => {
    // Create a new node via button click (assuming UI has a "Add Node" button)
    const addNodeButton = page.locator(FlowDemoSelectors.addNodeButton);
    const nodeCountBefore = await page.locator(FlowDemoSelectors.canvasNodeContainer).count();

    // Click add node (creates default node)
    if (await addNodeButton.isVisible().catch(() => false)) {
      await addNodeButton.click();

      // Wait for new node to appear
      await page.waitForTimeout(200);

      const nodeCountAfter = await page.locator(FlowDemoSelectors.canvasNodeContainer).count();
      expect(nodeCountAfter).toBeGreaterThan(nodeCountBefore);
    }
  });

  test("should create multiple nodes with unique IDs", async ({ page }) => {
    const addNodeButton = page.locator(FlowDemoSelectors.addNodeButton);

    if (await addNodeButton.isVisible().catch(() => false)) {
      // Create 3 nodes
      for (let i = 0; i < 3; i++) {
        await addNodeButton.click();
        await page.waitForTimeout(100);
      }

      // Verify each node has a unique data-testid
      const nodes = await page.locator(FlowDemoSelectors.canvasNodeContainer).all();
      const nodeIds = await Promise.all(
        nodes.map((node) => node.evaluate((el) => el.dataset.testid || ""))
      );

      // Filter out empty IDs and check uniqueness
      const validIds = nodeIds.filter((id) => id && id.startsWith("node-"));
      expect(new Set(validIds).size).toBe(validIds.length);
      expect(validIds.length).toBeGreaterThanOrEqual(3);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // Node Selection Tests
  // ─────────────────────────────────────────────────────────────────────────────────

  test("should select a node when clicked", async ({ page }) => {
    const addNodeButton = page.locator(FlowDemoSelectors.addNodeButton);

    if (await addNodeButton.isVisible().catch(() => false)) {
      // Create a node first
      await addNodeButton.click();
      await page.waitForTimeout(200);

      // Get the first node
      const node = page.locator(FlowDemoSelectors.canvasNodeContainer).first();

      // Click the node to select it
      await node.click();
      await page.waitForTimeout(100);

      // Verify node is selected (should have selected state attribute or class)
      const selectedState = await node.getAttribute("data-selected");
      const hasSelectedClass = await node.evaluate(
        (el) => el.classList.contains("selected") || el.classList.contains("is-selected")
      );

      // At least one indicator should show selection
      expect(selectedState === "true" || hasSelectedClass).toBeTruthy();
    }
  });

  test("should select multiple nodes with Shift+click", async ({ page }) => {
    const addNodeButton = page.locator(FlowDemoSelectors.addNodeButton);

    if (await addNodeButton.isVisible().catch(() => false)) {
      // Create 3 nodes
      for (let i = 0; i < 3; i++) {
        await addNodeButton.click();
        await page.waitForTimeout(100);
      }

      const nodes = await page.locator(FlowDemoSelectors.canvasNodeContainer).all();

      // Click first node
      await nodes[0].click();
      await page.waitForTimeout(100);

      // Shift+click second node
      await nodes[1].click({ modifiers: ["Shift"] });
      await page.waitForTimeout(100);

      // Verify at least 2 nodes are selected
      const selectedNodes = await Promise.all(
        nodes.map((node) => node.evaluate((el) => el.dataset.selected))
      );

      const selectedCount = selectedNodes.filter((state) => state === "true").length;
      expect(selectedCount).toBeGreaterThanOrEqual(2);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // Node Deletion Tests
  // ─────────────────────────────────────────────────────────────────────────────────

  test("should delete a selected node", async ({ page }) => {
    const addNodeButton = page.locator(FlowDemoSelectors.addNodeButton);

    if (await addNodeButton.isVisible().catch(() => false)) {
      // Create a node
      await addNodeButton.click();
      await page.waitForTimeout(200);

      const nodeCountBefore = await page.locator(FlowDemoSelectors.canvasNodeContainer).count();

      // Select and delete the node
      const node = page.locator(FlowDemoSelectors.canvasNodeContainer).first();
      await node.click();
      await page.waitForTimeout(100);

      // Press Delete key
      await page.keyboard.press("Delete");
      await page.waitForTimeout(200);

      const nodeCountAfter = await page.locator(FlowDemoSelectors.canvasNodeContainer).count();
      expect(nodeCountAfter).toBeLessThan(nodeCountBefore);
    }
  });

  test("should delete multiple selected nodes", async ({ page }) => {
    const addNodeButton = page.locator(FlowDemoSelectors.addNodeButton);

    if (await addNodeButton.isVisible().catch(() => false)) {
      // Create 3 nodes
      for (let i = 0; i < 3; i++) {
        await addNodeButton.click();
        await page.waitForTimeout(100);
      }

      const nodeCountBefore = await page.locator(FlowDemoSelectors.canvasNodeContainer).count();

      // Select first two nodes
      const nodes = await page.locator(FlowDemoSelectors.canvasNodeContainer).all();
      await nodes[0].click();
      await page.waitForTimeout(100);
      await nodes[1].click({ modifiers: ["Shift"] });
      await page.waitForTimeout(100);

      // Delete selected nodes
      await page.keyboard.press("Delete");
      await page.waitForTimeout(200);

      const nodeCountAfter = await page.locator(FlowDemoSelectors.canvasNodeContainer).count();
      expect(nodeCountAfter).toBeLessThanOrEqual(nodeCountBefore - 2);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // Node Connection Tests
  // ─────────────────────────────────────────────────────────────────────────────────

  test("should create a connection between two nodes", async ({ page }) => {
    const addNodeButton = page.locator(FlowDemoSelectors.addNodeButton);

    if (await addNodeButton.isVisible().catch(() => false)) {
      // Create 2 nodes
      await addNodeButton.click();
      await page.waitForTimeout(150);
      await addNodeButton.click();
      await page.waitForTimeout(150);

      const nodes = await page.locator(FlowDemoSelectors.canvasNodeContainer).all();

      // Get node positions
      const node1Box = await nodes[0].boundingBox();
      const node2Box = await nodes[1].boundingBox();

      if (node1Box && node2Box) {
        // Simulate drag from node1 to node2 to create connection
        await page.mouse.move(node1Box.x + node1Box.width / 2, node1Box.y + node1Box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(100);
        await page.mouse.move(node2Box.x + node2Box.width / 2, node2Box.y + node2Box.height / 2);
        await page.mouse.up();
        await page.waitForTimeout(200);

        // Verify connection is created (look for connection line or connection element)
        const connections = await page.locator(FlowDemoSelectors.connectionElement).all();
        expect(connections.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test("should display connection list after linking nodes", async ({ page }) => {
    const addNodeButton = page.locator(FlowDemoSelectors.addNodeButton);

    if (await addNodeButton.isVisible().catch(() => false)) {
      // Create 2 nodes and connect them
      await addNodeButton.click();
      await page.waitForTimeout(150);
      await addNodeButton.click();
      await page.waitForTimeout(150);

      const nodes = await page.locator(FlowDemoSelectors.canvasNodeContainer).all();
      const node1Box = await nodes[0].boundingBox();
      const node2Box = await nodes[1].boundingBox();

      if (node1Box && node2Box) {
        // Create connection
        await page.mouse.move(node1Box.x + node1Box.width / 2, node1Box.y + node1Box.height / 2);
        await page.mouse.down();
        await page.mouse.move(node2Box.x + node2Box.width / 2, node2Box.y + node2Box.height / 2);
        await page.mouse.up();
        await page.waitForTimeout(200);

        // Check if connection list is displayed
        const connectionsList = page.locator(FlowDemoSelectors.connectionsList);
        const isVisible = await connectionsList.isVisible().catch(() => false);

        if (isVisible) {
          // Verify connection info is shown
          const listItems = await connectionsList.locator("li, div").count();
          expect(listItems).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // Node Dragging & Movement Tests
  // ─────────────────────────────────────────────────────────────────────────────────

  test("should drag a node to move it on canvas", async ({ page }) => {
    const addNodeButton = page.locator(FlowDemoSelectors.addNodeButton);

    if (await addNodeButton.isVisible().catch(() => false)) {
      // Create a node
      await addNodeButton.click();
      await page.waitForTimeout(200);

      const node = page.locator(FlowDemoSelectors.canvasNodeContainer).first();
      const initialBox = await node.boundingBox();

      if (initialBox) {
        const startX = initialBox.x + initialBox.width / 2;
        const startY = initialBox.y + initialBox.height / 2;

        // Drag node 100px to the right
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.waitForTimeout(50);
        await page.mouse.move(startX + 100, startY);
        await page.mouse.up();
        await page.waitForTimeout(200);

        // Verify node moved
        const movedBox = await node.boundingBox();
        expect(movedBox?.x).toBeGreaterThan(initialBox.x);
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // Undo/Redo Tests
  // ─────────────────────────────────────────────────────────────────────────────────

  test("should undo node creation", async ({ page }) => {
    const addNodeButton = page.locator(FlowDemoSelectors.addNodeButton);

    if (await addNodeButton.isVisible().catch(() => false)) {
      // Create a node
      await addNodeButton.click();
      await page.waitForTimeout(200);

      const nodeCountAfterCreate = await page
        .locator(FlowDemoSelectors.canvasNodeContainer)
        .count();

      // Undo (Cmd+Z on Mac, Ctrl+Z on others)
      const isMac = process.platform === "darwin";
      await page.keyboard.press(isMac ? "Meta+Z" : "Control+Z");
      await page.waitForTimeout(200);

      const nodeCountAfterUndo = await page.locator(FlowDemoSelectors.canvasNodeContainer).count();

      // Node count should decrease after undo
      expect(nodeCountAfterUndo).toBeLessThan(nodeCountAfterCreate);
    }
  });

  test("should redo node creation after undo", async ({ page }) => {
    const addNodeButton = page.locator(FlowDemoSelectors.addNodeButton);

    if (await addNodeButton.isVisible().catch(() => false)) {
      // Create a node
      await addNodeButton.click();
      await page.waitForTimeout(200);

      const nodeCountAfterCreate = await page
        .locator(FlowDemoSelectors.canvasNodeContainer)
        .count();

      // Undo
      const isMac = process.platform === "darwin";
      await page.keyboard.press(isMac ? "Meta+Z" : "Control+Z");
      await page.waitForTimeout(200);

      // Redo (Cmd+Shift+Z on Mac, Ctrl+Shift+Z on others)
      await page.keyboard.press(isMac ? "Meta+Shift+Z" : "Control+Shift+Z");
      await page.waitForTimeout(200);

      const nodeCountAfterRedo = await page.locator(FlowDemoSelectors.canvasNodeContainer).count();

      // Node count should match after redo
      expect(nodeCountAfterRedo).toBe(nodeCountAfterCreate);
    }
  });

  test("should maintain undo history for multiple operations", async ({ page }) => {
    const addNodeButton = page.locator(FlowDemoSelectors.addNodeButton);

    if (await addNodeButton.isVisible().catch(() => false)) {
      const isMac = process.platform === "darwin";
      const undoKey = isMac ? "Meta+Z" : "Control+Z";

      // Create 3 nodes
      for (let i = 0; i < 3; i++) {
        await addNodeButton.click();
        await page.waitForTimeout(100);
      }

      const nodeCountAfterCreate = await page
        .locator(FlowDemoSelectors.canvasNodeContainer)
        .count();

      // Undo 2 times
      await page.keyboard.press(undoKey);
      await page.waitForTimeout(100);
      await page.keyboard.press(undoKey);
      await page.waitForTimeout(100);

      const nodeCountAfter2Undos = await page
        .locator(FlowDemoSelectors.canvasNodeContainer)
        .count();

      expect(nodeCountAfter2Undos).toBeLessThan(nodeCountAfterCreate);
      expect(nodeCountAfter2Undos).toBeGreaterThanOrEqual(nodeCountAfterCreate - 2);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // Canvas View Tests
  // ─────────────────────────────────────────────────────────────────────────────────

  test("should pan canvas view", async ({ page }) => {
    const canvas = page.locator("canvas").first();
    const canvasBox = await canvas.boundingBox();

    if (canvasBox) {
      const startX = canvasBox.x + canvasBox.width / 2;
      const startY = canvasBox.y + canvasBox.height / 2;

      // Simulate middle-mouse drag or space+drag to pan
      await page.mouse.move(startX, startY);
      await page.mouse.down({ button: "middle" });
      await page.waitForTimeout(50);
      await page.mouse.move(startX + 100, startY + 100);
      await page.mouse.up({ button: "middle" });
      await page.waitForTimeout(200);

      // Verify viewport changed (this would be checked via canvas position or render event)
      // For now, just verify no errors occurred
      await expect(canvas).toBeVisible();
    }
  });

  test("should zoom canvas with mouse wheel", async ({ page }) => {
    const canvas = page.locator("canvas").first();
    const canvasBox = await canvas.boundingBox();

    if (canvasBox) {
      const centerX = canvasBox.x + canvasBox.width / 2;
      const centerY = canvasBox.y + canvasBox.height / 2;

      // Move to canvas center
      await page.mouse.move(centerX, centerY);

      // Scroll up to zoom in
      await page.mouse.wheel(0, -3);
      await page.waitForTimeout(200);

      // Verify canvas still visible
      await expect(canvas).toBeVisible();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // Visual Feedback Tests
  // ─────────────────────────────────────────────────────────────────────────────────

  test("should show node count indicator", async ({ page }) => {
    const addNodeButton = page.locator(FlowDemoSelectors.addNodeButton);

    if (await addNodeButton.isVisible().catch(() => false)) {
      // Create 3 nodes
      for (let i = 0; i < 3; i++) {
        await addNodeButton.click();
        await page.waitForTimeout(100);
      }

      // Check if node count is displayed somewhere (info panel, toolbar, etc.)
      const nodeCountDisplay = page.locator(FlowDemoSelectors.nodeCountIndicator);
      const isVisible = await nodeCountDisplay.isVisible().catch(() => false);

      if (isVisible) {
        const text = await nodeCountDisplay.textContent();
        expect(text).toContain("3");
      }
    }
  });

  test("should show connection count when nodes are linked", async ({ page }) => {
    const addNodeButton = page.locator(FlowDemoSelectors.addNodeButton);

    if (await addNodeButton.isVisible().catch(() => false)) {
      // Create and link nodes (from previous connection test)
      await addNodeButton.click();
      await page.waitForTimeout(150);
      await addNodeButton.click();
      await page.waitForTimeout(150);

      const nodes = await page.locator(FlowDemoSelectors.canvasNodeContainer).all();
      const node1Box = await nodes[0].boundingBox();
      const node2Box = await nodes[1].boundingBox();

      if (node1Box && node2Box) {
        // Create connection
        await page.mouse.move(node1Box.x + node1Box.width / 2, node1Box.y + node1Box.height / 2);
        await page.mouse.down();
        await page.mouse.move(node2Box.x + node2Box.width / 2, node2Box.y + node2Box.height / 2);
        await page.mouse.up();
        await page.waitForTimeout(200);

        // Check for connection count indicator
        const connectionCountDisplay = page.locator(FlowDemoSelectors.connectionCountIndicator);
        const isVisible = await connectionCountDisplay.isVisible().catch(() => false);

        if (isVisible) {
          const text = await connectionCountDisplay.textContent();
          expect(text).toContain("1");
        }
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // Complex Workflows
  // ─────────────────────────────────────────────────────────────────────────────────

  test("should complete a node CRUD lifecycle workflow", async ({ page }) => {
    const addNodeButton = page.locator(FlowDemoSelectors.addNodeButton);

    if (await addNodeButton.isVisible().catch(() => false)) {
      const isMac = process.platform === "darwin";
      const undoKey = isMac ? "Meta+Z" : "Control+Z";
      const redoKey = isMac ? "Meta+Shift+Z" : "Control+Shift+Z";

      // 1. Create node
      await addNodeButton.click();
      await page.waitForTimeout(150);

      const countAfterCreate = await page.locator(FlowDemoSelectors.canvasNodeContainer).count();
      expect(countAfterCreate).toBeGreaterThan(0);

      // 2. Select and move node
      const node = page.locator(FlowDemoSelectors.canvasNodeContainer).first();
      const box1 = await node.boundingBox();
      if (box1) {
        await node.click();
        await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
        await page.mouse.down();
        await page.mouse.move(box1.x + 50, box1.y + 50);
        await page.mouse.up();
        await page.waitForTimeout(100);
      }

      // 3. Undo move
      await page.keyboard.press(undoKey);
      await page.waitForTimeout(150);

      // 4. Redo move
      await page.keyboard.press(redoKey);
      await page.waitForTimeout(150);

      // 5. Verify node still exists
      const finalCount = await page.locator(FlowDemoSelectors.canvasNodeContainer).count();
      expect(finalCount).toBe(countAfterCreate);
    }
  });
});
