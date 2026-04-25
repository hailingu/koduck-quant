/**
 * Renderer Helper Utilities for E2E Tests
 *
 * Provides renderer switching operations with deterministic selectors.
 * @module test/e2e/helpers/renderer-helpers
 */

import type { Page } from "@playwright/test";
import { RendererSelectors } from "../selectors";
import { SelectorHelpers } from "./selector-helpers";

export type RendererTarget = "react" | "canvas" | "webgpu";

export interface RendererSwitchOptions {
  timeout?: number;
  expectUnsupported?: boolean;
}

export class RendererHelpers {
  static async openMenu(page: Page): Promise<void> {
    const toggle = page.locator(RendererSelectors.selector);
    const isExpanded = await toggle.getAttribute("aria-expanded");
    if (isExpanded !== "true") {
      await SelectorHelpers.clickWithRetry(page, RendererSelectors.selector, 2);
    }
    await page.waitForSelector(RendererSelectors.optionsPanel, {
      state: "visible",
      timeout: 2000,
    });
  }

  static async closeMenu(page: Page): Promise<void> {
    const toggle = page.locator(RendererSelectors.selector);
    const isExpanded = await toggle.getAttribute("aria-expanded");
    if (isExpanded === "true") {
      await SelectorHelpers.clickWithRetry(page, RendererSelectors.selector, 2);
      await page.waitForSelector(RendererSelectors.optionsPanel, {
        state: "hidden",
        timeout: 2000,
      });
    }
  }

  static async isRendererSupported(page: Page, renderer: RendererTarget): Promise<boolean> {
    const toggle = page.locator(RendererSelectors.selector);
    const wasExpanded = (await toggle.getAttribute("aria-expanded")) === "true";

    await RendererHelpers.openMenu(page);

    const button = page.locator(`[data-testid="renderer-${renderer}"]`);
    const disabled = await button.getAttribute("disabled");
    const supportedAttr = await button.getAttribute("data-supported");
    const isSupported = disabled === null && supportedAttr !== "false";

    if (!wasExpanded) {
      await RendererHelpers.closeMenu(page);
    }

    return isSupported;
  }

  static async switchRenderer(
    page: Page,
    renderer: RendererTarget,
    options: RendererSwitchOptions = {}
  ): Promise<void> {
    const { timeout = 5000, expectUnsupported = false } = options;

    await RendererHelpers.openMenu(page);

    const buttonSelector = `[data-testid="renderer-${renderer}"]`;
    const isDisabled = await page.locator(buttonSelector).getAttribute("disabled");

    if (expectUnsupported) {
      if (isDisabled === null) {
        throw new Error(`Renderer ${renderer} expected to be unsupported but button is enabled.`);
      }
      await RendererHelpers.closeMenu(page);
      return;
    }

    if (isDisabled !== null) {
      throw new Error(`Renderer ${renderer} is disabled but test expected support.`);
    }

    await SelectorHelpers.clickWithRetry(page, buttonSelector, 2);

    await page.waitForSelector(RendererSelectors.optionsPanel, {
      state: "hidden",
      timeout: 2000,
    });

    await RendererHelpers.waitForRendererReady(page, renderer, timeout);
  }

  static async waitForRendererReady(
    page: Page,
    renderer: RendererTarget,
    timeout = 5000
  ): Promise<void> {
    const statusLocator = page.locator(RendererSelectors.status);
    await statusLocator.waitFor({ state: "visible", timeout });
    await page.waitForFunction(
      ({ selector, target }) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) {
          return false;
        }
        const { active, state } = element.dataset as { active?: string; state?: string };
        return active === target && state === "ready";
      },
      { selector: RendererSelectors.status, target: renderer },
      { timeout }
    );
    await page.waitForSelector(RendererSelectors.active(renderer), {
      timeout,
      state: "visible",
    });
  }

  static async getRenderedEntityData(page: Page): Promise<
    {
      id: string;
      renderer: string | null;
      displayName: string | null;
    }[]
  > {
    const cards = page.locator('[data-testid^="entity-"][data-renderer]');
    const count = await cards.count();
    const entities: {
      id: string;
      renderer: string | null;
      displayName: string | null;
    }[] = [];

    for (let index = 0; index < count; index += 1) {
      const card = cards.nth(index);
      const idAttr = await card.getAttribute("data-testid");
      const rendererAttr = await card.getAttribute("data-renderer");
      const display = await card
        .locator('[data-testid="entity-display-name"], [data-testid="entity-name"]')
        .first()
        .textContent();
      entities.push({
        id: idAttr ?? `unknown-${index}`,
        renderer: rendererAttr,
        displayName: display?.trim() ?? null,
      });
    }

    return entities;
  }
}
