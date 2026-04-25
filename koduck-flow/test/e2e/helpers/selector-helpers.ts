/**
 * Selector Helper Utilities for E2E Tests
 *
 * Provides utilities for safely accessing and verifying test selectors.
 * All helpers use centralized selector constants from test/e2e/selectors.ts
 *
 * @module test/e2e/helpers/selector-helpers
 */

import type { Page, Locator } from "@playwright/test";
import { RuntimeSelectors } from "../selectors";

/**
 * Selector verification utilities for E2E tests
 */
export class SelectorHelpers {
  /**
   * Wait for a selector to be present in the DOM
   *
   * @param page - Playwright page instance
   * @param selector - CSS selector to wait for
   * @param timeout - Optional timeout in milliseconds (default: 10000)
   * @throws Throws if selector is not found within timeout
   *
   * @example
   * await SelectorHelpers.waitForSelector(page, '[data-testid="runtime-ready"]');
   */
  static async waitForSelector(
    page: Page,
    selector: string,
    timeout: number = 10000
  ): Promise<void> {
    try {
      await page.waitForSelector(selector, { timeout });
    } catch {
      throw new Error(
        `Failed to find selector "${selector}" within ${timeout}ms. ` +
          `This may indicate the component has not loaded or the selector is incorrect.`
      );
    }
  }

  /**
   * Get a locator for a selector with safe error handling
   *
   * @param page - Playwright page instance
   * @param selector - CSS selector string
   * @returns Playwright Locator instance
   *
   * @example
   * const element = SelectorHelpers.getLocator(page, '[data-testid="entity-name"]');
   * await element.click();
   */
  static getLocator(page: Page, selector: string): Locator {
    return page.locator(selector);
  }

  /**
   * Verify a selector exists and is visible
   *
   * @param page - Playwright page instance
   * @param selector - CSS selector to verify
   * @param timeout - Optional timeout in milliseconds (default: 5000)
   * @returns boolean indicating if selector is visible
   *
   * @example
   * const exists = await SelectorHelpers.isVisible(page, EntitySelectors.container('entity-123'));
   */
  static async isVisible(page: Page, selector: string, timeout: number = 5000): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Count elements matching a selector
   *
   * @param page - Playwright page instance
   * @param selector - CSS selector pattern
   * @returns Number of matching elements
   *
   * @example
   * const count = await SelectorHelpers.countElements(page, EntitySelectors.containerPrefix);
   */
  static async countElements(page: Page, selector: string): Promise<number> {
    return page.locator(selector).count();
  }

  /**
   * Get text content from a selector
   *
   * @param page - Playwright page instance
   * @param selector - CSS selector to extract text from
   * @returns Text content or null if element not found
   *
   * @example
   * const text = await SelectorHelpers.getText(page, '[data-testid="entity-name"]');
   */
  static async getText(page: Page, selector: string): Promise<string | null> {
    try {
      return await page.locator(selector).textContent();
    } catch {
      return null;
    }
  }

  /**
   * Click on a selector with retry logic
   *
   * @param page - Playwright page instance
   * @param selector - CSS selector to click
   * @param retries - Number of retry attempts (default: 3)
   * @throws Throws after all retries exhausted
   *
   * @example
   * await SelectorHelpers.clickWithRetry(page, EntitySelectors.saveButton, 2);
   */
  static async clickWithRetry(page: Page, selector: string, retries: number = 3): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await page.click(selector);
        return;
      } catch (error) {
        lastError = error as Error;
        if (attempt < retries) {
          await page.waitForTimeout(100 * attempt); // Exponential backoff
        }
      }
    }

    throw new Error(
      `Failed to click selector "${selector}" after ${retries} attempts. ` +
        `Last error: ${lastError?.message}`
    );
  }

  /**
   * Fill an input field with retry logic
   *
   * @param page - Playwright page instance
   * @param selector - CSS selector for input element
   * @param value - Value to fill
   * @param retries - Number of retry attempts (default: 3)
   * @throws Throws after all retries exhausted
   *
   * @example
   * await SelectorHelpers.fillWithRetry(page, EntitySelectors.nameInput, 'New Name');
   */
  static async fillWithRetry(
    page: Page,
    selector: string,
    value: string,
    retries: number = 3
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await page.fill(selector, value);
        return;
      } catch (error) {
        lastError = error as Error;
        if (attempt < retries) {
          await page.waitForTimeout(100 * attempt); // Exponential backoff
        }
      }
    }

    throw new Error(
      `Failed to fill selector "${selector}" with value "${value}" after ${retries} attempts. ` +
        `Last error: ${lastError?.message}`
    );
  }

  /**
   * Get runtime-ready signal to confirm harness is initialized
   *
   * @param page - Playwright page instance
   * @returns true if runtime-ready selector is visible
   *
   * @example
   * const isReady = await SelectorHelpers.isRuntimeReady(page);
   */
  static async isRuntimeReady(page: Page): Promise<boolean> {
    return this.isVisible(page, RuntimeSelectors.ready, 5000);
  }

  /**
   * Get render-complete signal for large dataset rendering
   *
   * @param page - Playwright page instance
   * @returns true if render-complete selector is visible
   *
   * @example
   * const renderFinished = await SelectorHelpers.isRenderComplete(page);
   */
  static async isRenderComplete(page: Page): Promise<boolean> {
    return this.isVisible(page, RuntimeSelectors.renderComplete, 30000);
  }

  /**
   * Get scroll-complete signal for virtual list operations
   *
   * @param page - Playwright page instance
   * @returns true if scroll-complete selector is visible
   *
   * @example
   * const scrollFinished = await SelectorHelpers.isScrollComplete(page);
   */
  static async isScrollComplete(page: Page): Promise<boolean> {
    return this.isVisible(page, RuntimeSelectors.scrollComplete, 5000);
  }
}
