import { test, expect, E2EHelpers } from "./fixtures";
import { EntitySelectors } from "./selectors";

test.describe("Entity Lifecycle (E2E-001)", () => {
  test("should create a new entity successfully", async ({ runtimePage, testEntity }) => {
    // Create entity
    await E2EHelpers.createTestEntity(runtimePage, testEntity);

    // Verify entity exists
    await E2EHelpers.verifyEntityExists(runtimePage, testEntity.id);

    // Verify entity properties
    const entityElement = runtimePage.locator(EntitySelectors.container(testEntity.id));
    await expect(entityElement).toContainText(testEntity.name || testEntity.id);
  });

  test("should update an existing entity", async ({ runtimePage, testEntity }) => {
    // Create entity first
    await E2EHelpers.createTestEntity(runtimePage, testEntity);

    // Update entity
    await runtimePage.click(EntitySelectors.editButton(testEntity.id));
    const newName = "Updated Entity Name";
    await runtimePage.fill(EntitySelectors.nameInput, newName);
    await runtimePage.click(EntitySelectors.saveButton);

    // Verify update
    const entityElement = runtimePage.locator(EntitySelectors.container(testEntity.id));
    await expect(entityElement).toContainText(newName);
  });

  test("should delete an entity successfully", async ({ runtimePage, testEntity }) => {
    // Create entity first
    await E2EHelpers.createTestEntity(runtimePage, testEntity);

    // Verify it exists
    await E2EHelpers.verifyEntityExists(runtimePage, testEntity.id);

    // Delete entity
    await E2EHelpers.deleteTestEntity(runtimePage, testEntity.id);

    // Verify it's gone
    const entityElement = runtimePage.locator(EntitySelectors.container(testEntity.id));
    await expect(entityElement).not.toBeVisible();
  });

  test("should handle entity lifecycle with complex data", async ({ runtimePage }) => {
    const complexEntity = {
      id: "complex-entity-001",
      type: "flow",
      name: "Complex Flow Entity",
    };

    // Create
    await E2EHelpers.createTestEntity(runtimePage, complexEntity);
    await E2EHelpers.verifyEntityExists(runtimePage, complexEntity.id);

    // Update
    await runtimePage.click(EntitySelectors.editButton(complexEntity.id));
    await runtimePage.fill(EntitySelectors.nameInput, "Updated Complex Entity");
    await runtimePage.click(EntitySelectors.saveButton);

    // Verify update
    const entityElement = runtimePage.locator(EntitySelectors.container(complexEntity.id));
    await expect(entityElement).toContainText("Updated Complex Entity");

    // Delete
    await E2EHelpers.deleteTestEntity(runtimePage, complexEntity.id);
    await expect(entityElement).not.toBeVisible();
  });
});
