import { test, expect, RendererHelpers, E2EHelpers } from "./fixtures";

test.describe("Renderer Switching", () => {
  test.beforeEach(async ({ runtimePage }) => {
    await E2EHelpers.waitForRuntimeReady(runtimePage);
  });

  test("should switch between React, Canvas, and WebGPU renderers", async ({ runtimePage }) => {
    const testEntity = {
      id: "renderer-test-entity",
      type: "node",
      name: "Renderer Test Entity",
    };

    await E2EHelpers.createTestEntity(runtimePage, testEntity);
    await E2EHelpers.verifyEntityExists(runtimePage, testEntity.id);

    await RendererHelpers.waitForRendererReady(runtimePage, "react");
    await expect(runtimePage.locator(`[data-testid="entity-${testEntity.id}"]`)).toHaveAttribute(
      "data-renderer",
      "react"
    );

    await RendererHelpers.switchRenderer(runtimePage, "canvas");
    await expect(runtimePage.locator(`[data-testid="entity-${testEntity.id}"]`)).toHaveAttribute(
      "data-renderer",
      "canvas"
    );

    const webgpuSupported = await RendererHelpers.isRendererSupported(runtimePage, "webgpu");

    if (webgpuSupported) {
      await RendererHelpers.switchRenderer(runtimePage, "webgpu");
      await expect(runtimePage.locator(`[data-testid="entity-${testEntity.id}"]`)).toHaveAttribute(
        "data-renderer",
        "webgpu"
      );
    } else {
      await RendererHelpers.openMenu(runtimePage);
      await expect(runtimePage.locator('[data-testid="renderer-webgpu"]')).toBeDisabled();
      await RendererHelpers.closeMenu(runtimePage);
    }

    await RendererHelpers.switchRenderer(runtimePage, "react");
    await expect(runtimePage.locator(`[data-testid="entity-${testEntity.id}"]`)).toHaveAttribute(
      "data-renderer",
      "react"
    );

    await E2EHelpers.deleteTestEntity(runtimePage, testEntity.id);
  });

  test("should maintain entity state during renderer switches", async ({ runtimePage }) => {
    const testEntity = {
      id: "state-test-entity",
      type: "node",
      name: "State Test Entity",
    };

    await E2EHelpers.createTestEntity(runtimePage, testEntity);

    await runtimePage.click(`[data-testid="edit-entity-${testEntity.id}"]`);
    await runtimePage.fill('[data-testid="entity-name-input"]', "Modified Name");
    await runtimePage.click('[data-testid="save-entity"]');

    const supportedRenderers: ("react" | "canvas" | "webgpu")[] = ["react", "canvas"];
    if (await RendererHelpers.isRendererSupported(runtimePage, "webgpu")) {
      supportedRenderers.push("webgpu");
    }

    for (const renderer of supportedRenderers) {
      await RendererHelpers.switchRenderer(runtimePage, renderer);
      await expect(runtimePage.locator(`[data-testid="entity-${testEntity.id}"]`)).toContainText(
        "Modified Name"
      );

      const entityData = await RendererHelpers.getRenderedEntityData(runtimePage);
      const entityView = entityData.find((entry) => entry.id === `entity-${testEntity.id}`);
      expect(entityView?.renderer).toBe(renderer);
      expect(entityView?.displayName?.startsWith("Modified Name")).toBeTruthy();
    }

    await E2EHelpers.deleteTestEntity(runtimePage, testEntity.id);
  });

  test("should handle renderer switching during flow execution", async ({
    runtimePage,
    testFlow,
  }) => {
    await E2EHelpers.createFlow(runtimePage, testFlow);

    await runtimePage.click(`[data-testid="execute-flow-${testFlow.id}"]`);

    await RendererHelpers.switchRenderer(runtimePage, "canvas");

    await runtimePage.waitForSelector('[data-testid="execution-complete"]', {
      timeout: 30000,
    });

    await E2EHelpers.verifyFlowExecution(runtimePage, testFlow.id);
  });
});
