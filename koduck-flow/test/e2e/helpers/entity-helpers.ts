/**
 * Entity Helper Utilities for E2E Tests
 *
 * Provides CRUD operations for test entities using centralized selector constants.
 * All entity operations use deterministic selectors from test/e2e/selectors.ts
 *
 * @module test/e2e/helpers/entity-helpers
 */

import type { Page } from "@playwright/test";
import { EntitySelectors } from "../selectors";
import { SelectorHelpers } from "./selector-helpers";

/**
 * Entity test data interface
 */
export interface TestEntity {
  id: string;
  name: string;
  type: string;
  description?: string;
}

/**
 * Entity helper utilities for CRUD operations
 */
export class EntityHelpers {
  /**
   * Create a new test entity
   *
   * @param page - Playwright page instance
   * @param entity - Entity data to create
   * @throws Throws if entity creation fails
   *
   * @example
   * await EntityHelpers.createTestEntity(page, {
   *   id: 'entity-1',
   *   name: 'Test Entity'
   * });
   */
  static async createTestEntity(page: Page, entity: TestEntity): Promise<void> {
    try {
      // Wait for create form to be visible and click create button
      await SelectorHelpers.waitForSelector(page, EntitySelectors.createButton, 5000);
      await SelectorHelpers.clickWithRetry(page, EntitySelectors.createButton, 2);

      // Populate entity type and id – both required before name
      await SelectorHelpers.fillWithRetry(page, EntitySelectors.typeInput, entity.type, 2);
      await SelectorHelpers.fillWithRetry(page, EntitySelectors.idInput, entity.id, 2);

      // Fill in the entity name using the create form input
      await SelectorHelpers.fillWithRetry(page, EntitySelectors.nameInputCreate, entity.name, 2);

      // Submit the form
      await SelectorHelpers.clickWithRetry(page, EntitySelectors.confirmCreateButton, 2);

      // Verify entity was created by checking if it appears in the list
      await SelectorHelpers.waitForSelector(page, EntitySelectors.container(entity.id), 10000);
    } catch (error) {
      throw new Error(
        `Failed to create entity "${entity.name}" (id: ${entity.id}). ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Verify that an entity exists and is visible
   *
   * @param page - Playwright page instance
   * @param entityId - ID of the entity to verify
   * @returns true if entity is visible, false otherwise
   *
   * @example
   * const exists = await EntityHelpers.verifyEntityExists(page, 'entity-1');
   */
  static async verifyEntityExists(page: Page, entityId: string): Promise<boolean> {
    try {
      return await SelectorHelpers.isVisible(page, EntitySelectors.container(entityId), 5000);
    } catch {
      return false;
    }
  }

  /**
   * Get the display name of an entity
   *
   * @param page - Playwright page instance
   * @param entityId - ID of the entity
   * @returns Display name text or null if not found
   *
   * @example
   * const name = await EntityHelpers.getEntityName(page, 'entity-1');
   */
  static async getEntityName(page: Page, entityId: string): Promise<string | null> {
    try {
      const selector = `${EntitySelectors.container(entityId)} ${EntitySelectors.displayName}`;
      return await SelectorHelpers.getText(page, selector);
    } catch (error) {
      console.warn(
        `Failed to get entity name for ${entityId}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * Click the edit button for an entity
   *
   * @param page - Playwright page instance
   * @param entityId - ID of the entity to edit
   * @throws Throws if edit button cannot be clicked
   *
   * @example
   * await EntityHelpers.editEntity(page, 'entity-1');
   */
  static async editEntity(page: Page, entityId: string): Promise<void> {
    try {
      await SelectorHelpers.clickWithRetry(page, EntitySelectors.editButton(entityId), 2);
    } catch (error) {
      throw new Error(
        `Failed to edit entity with id "${entityId}". ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Save changes to an entity
   *
   * @param page - Playwright page instance
   * @throws Throws if save operation fails
   *
   * @example
   * await EntityHelpers.saveEntity(page);
   */
  static async saveEntity(page: Page): Promise<void> {
    try {
      await SelectorHelpers.clickWithRetry(page, EntitySelectors.saveButton, 2);
      // Wait for save operation to complete
      await page.waitForTimeout(500);
    } catch (error) {
      throw new Error(
        `Failed to save entity. ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Delete a test entity
   *
   * @param page - Playwright page instance
   * @param entityId - ID of the entity to delete
   * @throws Throws if deletion fails
   *
   * @example
   * await EntityHelpers.deleteTestEntity(page, 'entity-1');
   */
  static async deleteTestEntity(page: Page, entityId: string): Promise<void> {
    try {
      // Click delete button
      await SelectorHelpers.clickWithRetry(page, EntitySelectors.deleteButton(entityId), 2);

      // Confirm deletion
      await SelectorHelpers.clickWithRetry(page, EntitySelectors.confirmDeleteButton, 2);

      // Verify entity is removed
      const exists = await SelectorHelpers.isVisible(
        page,
        EntitySelectors.container(entityId),
        3000
      );

      if (exists) {
        throw new Error(`Entity ${entityId} still visible after deletion`);
      }
    } catch (error) {
      throw new Error(
        `Failed to delete entity with id "${entityId}". ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Update entity name by editing and saving
   *
   * @param page - Playwright page instance
   * @param entityId - ID of the entity to update
   * @param newName - New name for the entity
   * @throws Throws if update fails
   *
   * @example
   * await EntityHelpers.updateEntityName(page, 'entity-1', 'Updated Name');
   */
  static async updateEntityName(page: Page, entityId: string, newName: string): Promise<void> {
    try {
      await this.editEntity(page, entityId);
      await SelectorHelpers.fillWithRetry(page, EntitySelectors.nameInput, newName, 2);
      await this.saveEntity(page);
    } catch (error) {
      throw new Error(
        `Failed to update entity name for id "${entityId}" to "${newName}". ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Count total visible entities
   *
   * @param page - Playwright page instance
   * @returns Number of visible entities
   *
   * @example
   * const count = await EntityHelpers.countEntities(page);
   */
  static async countEntities(page: Page): Promise<number> {
    try {
      // Count all entity containers using data-testid pattern
      return await page.locator('[data-testid^="entity-"]').count();
    } catch (error) {
      console.warn(
        `Failed to count entities: ${error instanceof Error ? error.message : String(error)}`
      );
      return 0;
    }
  }
}
