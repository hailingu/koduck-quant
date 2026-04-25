/**
 * Tenant Helper Utilities for E2E Tests
 *
 * Provides multi-tenant operations using centralized selector constants.
 * All tenant operations use deterministic selectors from test/e2e/selectors.ts
 *
 * @module test/e2e/helpers/tenant-helpers
 */

import type { Page } from "@playwright/test";
import { TenantSelectors } from "../selectors";
import { SelectorHelpers } from "./selector-helpers";
import { EntityHelpers, type TestEntity } from "./entity-helpers";

/**
 * Tenant test data interface
 */
export interface TestTenant {
  id: string;
  name: string;
}

/**
 * Tenant helper utilities for multi-tenant operations
 */
export class TenantHelpers {
  /**
   * Switch to a different tenant
   *
   * @param page - Playwright page instance
   * @param tenantId - ID of the tenant to switch to
   * @throws Throws if tenant switch fails
   *
   * @example
   * await TenantHelpers.switchTenant(page, 'tenant-a');
   */
  static async switchTenant(page: Page, tenantId: string): Promise<void> {
    try {
      const selector = TenantSelectors.selector;
      const optionSelector = TenantSelectors.option(tenantId);
      const selectorHandle = await page.locator(selector).elementHandle();

      if (!selectorHandle) {
        throw new Error(`Tenant selector element not found for tenant switch (${tenantId}).`);
      }

      const tagName = await selectorHandle.evaluate((element) => element.tagName.toLowerCase());

      if (tagName === "select") {
        await page.selectOption(selector, tenantId);
      } else {
        await SelectorHelpers.clickWithRetry(page, selector, 2);
        await SelectorHelpers.clickWithRetry(page, optionSelector, 2);
      }

      await page.waitForTimeout(200);

      // Verify tenant selector shows the selected tenant
      const displayText = await SelectorHelpers.getText(page, TenantSelectors.currentTenantDisplay);
      if (!displayText || !displayText.includes(tenantId)) {
        throw new Error(`Tenant ${tenantId} was not selected after switch`);
      }
    } catch (error) {
      throw new Error(
        `Failed to switch to tenant "${tenantId}". ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get the current active tenant
   *
   * @param page - Playwright page instance
   * @returns ID of the currently active tenant or null
   *
   * @example
   * const currentTenant = await TenantHelpers.getCurrentTenant(page);
   */
  static async getCurrentTenant(page: Page): Promise<string | null> {
    try {
      const text = await SelectorHelpers.getText(page, TenantSelectors.currentTenantDisplay);
      return text?.trim() ?? null;
    } catch (error) {
      console.warn(
        `Failed to get current tenant: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * Verify tenant isolation - check that entity created in one tenant is not visible in another
   *
   * @param page - Playwright page instance
   * @param sourceTenantId - Tenant where entity exists
   * @param targetTenantId - Tenant to verify entity is not present
   * @param entityId - ID of the entity to check
   * @throws Throws if isolation is not maintained (entity visible in wrong tenant)
   *
   * @example
   * await TenantHelpers.verifyTenantIsolation(page, 'tenant-a', 'tenant-b', 'entity-1');
   */
  static async verifyTenantIsolation(
    page: Page,
    sourceTenantId: string,
    targetTenantId: string,
    entityId: string
  ): Promise<void> {
    try {
      // Verify entity exists in source tenant
      await this.switchTenant(page, sourceTenantId);
      const entitySelector = `[data-testid="entity-${entityId}"]`;
      const existsInSource = await SelectorHelpers.isVisible(page, entitySelector, 3000);

      if (!existsInSource) {
        throw new Error(`Entity ${entityId} not found in source tenant ${sourceTenantId}`);
      }

      // Switch to target tenant and verify entity doesn't exist
      await this.switchTenant(page, targetTenantId);
      const existsInTarget = await SelectorHelpers.isVisible(page, entitySelector, 3000);

      if (existsInTarget) {
        throw new Error(
          `Tenant isolation violation: Entity ${entityId} visible in tenant ${targetTenantId} but should only exist in ${sourceTenantId}`
        );
      }
    } catch (error) {
      throw new Error(
        `Tenant isolation verification failed. ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create an entity in a specific tenant
   *
   * @param page - Playwright page instance
   * @param tenantId - ID of the tenant
   * @param entity - Entity details to create within the tenant
   * @throws Throws if entity creation in tenant fails
   *
   * @example
   * await TenantHelpers.createEntityInTenant(page, 'tenant-a', {
   *   id: 'tenant-entity-1',
   *   type: 'node',
   *   name: 'Tenant Entity'
   * });
   */
  static async createEntityInTenant(
    page: Page,
    tenantId: string,
    entity: TestEntity
  ): Promise<void> {
    try {
      // Switch to tenant first
      await this.switchTenant(page, tenantId);

      // Delegate to shared entity helper to ensure consistent flow
      await EntityHelpers.createTestEntity(page, entity);
    } catch (error) {
      throw new Error(
        `Failed to create entity "${entity.name}" (id: ${entity.id}) in tenant "${tenantId}". ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * List available tenants
   *
   * @param page - Playwright page instance
   * @returns Array of tenant IDs
   *
   * @example
   * const tenants = await TenantHelpers.listTenants(page);
   */
  static async listTenants(page: Page): Promise<string[]> {
    try {
      const tenantOptions = await page.locator('[data-testid^="tenant-option-"]').count();
      const tenants: string[] = [];

      for (let i = 0; i < tenantOptions; i++) {
        const text = await page.locator('[data-testid^="tenant-option-"]').nth(i).textContent();
        if (text) {
          tenants.push(text.trim());
        }
      }

      return tenants;
    } catch (error) {
      console.warn(
        `Failed to list tenants: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * Verify a specific tenant is available
   *
   * @param page - Playwright page instance
   * @param tenantId - ID of the tenant to verify
   * @returns true if tenant is available
   *
   * @example
   * const available = await TenantHelpers.isTenantAvailable(page, 'tenant-a');
   */
  static async isTenantAvailable(page: Page, tenantId: string): Promise<boolean> {
    try {
      const tenantOption = TenantSelectors.option(tenantId);
      return await SelectorHelpers.isVisible(page, tenantOption, 2000);
    } catch {
      return false;
    }
  }
}
