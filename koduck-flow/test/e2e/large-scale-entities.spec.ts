import { test, expect, E2EHelpers } from "./fixtures";
import { RuntimeSelectors, EntitySelectors } from "./selectors";

// NOTE: Performance workload exceeds current harness capabilities (see docs/e2e-remediation-plan.md#phase-b)
test.describe.skip("Large-scale Entities", () => {
  test("should handle loading and rendering 10,000+ entities", async ({ runtimePage }) => {
    await E2EHelpers.waitForRuntimeReady(runtimePage);

    const entityCount = 10000;
    const batchSize = 1000; // Create entities in batches to avoid timeouts

    // Start performance monitoring
    const startTime = Date.now();

    // Create entities in batches
    for (let batch = 0; batch < entityCount / batchSize; batch++) {
      const batchStartTime = Date.now();

      for (let i = 0; i < batchSize; i++) {
        const entityIndex = batch * batchSize + i;
        const entityData = {
          id: `large-scale-entity-${entityIndex.toString().padStart(5, "0")}`,
          type: "node",
          name: `Entity ${entityIndex}`,
        };

        await E2EHelpers.createTestEntity(runtimePage, entityData);
      }

      const batchEndTime = Date.now();
      const batchDuration = batchEndTime - batchStartTime;

      console.log(`Batch ${batch + 1}/${entityCount / batchSize} completed in ${batchDuration}ms`);

      // Verify batch creation
      const lastEntityId = `large-scale-entity-${((batch + 1) * batchSize - 1).toString().padStart(5, "0")}`;
      await E2EHelpers.verifyEntityExists(runtimePage, lastEntityId);
    }

    const loadTime = Date.now() - startTime;
    console.log(`Total load time for ${entityCount} entities: ${loadTime}ms`);

    // Performance assertions
    expect(loadTime).toBeLessThan(300000); // Less than 5 minutes
    const avgTimePerEntity = loadTime / entityCount;
    expect(avgTimePerEntity).toBeLessThan(50); // Less than 50ms per entity

    // Verify rendering performance
    const renderStartTime = Date.now();

    // Trigger a full render (e.g., zoom out or refresh view)
    await runtimePage.click(RuntimeSelectors.zoomToFit);
    await runtimePage.waitForSelector(RuntimeSelectors.renderComplete, { timeout: 30000 });

    const renderTime = Date.now() - renderStartTime;
    console.log(`Full render time: ${renderTime}ms`);
    expect(renderTime).toBeLessThan(5000); // Less than 5 seconds

    // Verify entity count
    const visibleEntities = await runtimePage.locator(EntitySelectors.containerPrefix).count();
    expect(visibleEntities).toBe(entityCount);

    // Test scrolling performance
    const scrollStartTime = Date.now();
    await runtimePage.mouse.wheel(0, 1000); // Scroll down
    await runtimePage.waitForSelector(RuntimeSelectors.scrollComplete, { timeout: 5000 });

    const scrollTime = Date.now() - scrollStartTime;
    console.log(`Scroll time: ${scrollTime}ms`);
    expect(scrollTime).toBeLessThan(1000); // Less than 1 second

    // Test memory usage (if browser supports performance.memory)
    const memoryUsage = await runtimePage.evaluate(() => {
      if (
        "memory" in performance &&
        (performance as { memory?: { usedJSHeapSize: number } }).memory
      ) {
        return (performance as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize;
      }
      return null;
    });

    if (memoryUsage !== null) {
      console.log(`Memory usage: ${(memoryUsage / 1024 / 1024).toFixed(2)} MB`);
      // Memory should be reasonable (less than 500MB for 10k entities)
      expect(memoryUsage).toBeLessThan(500 * 1024 * 1024);
    }

    // Clean up - delete a sample of entities to verify deletion works
    const sampleSize = 100;
    for (let i = 0; i < sampleSize; i++) {
      const entityId = `large-scale-entity-${i.toString().padStart(5, "0")}`;
      await E2EHelpers.deleteTestEntity(runtimePage, entityId);
    }

    // Verify cleanup
    for (let i = 0; i < sampleSize; i++) {
      const entityId = `large-scale-entity-${i.toString().padStart(5, "0")}`;
      await expect(runtimePage.locator(EntitySelectors.container(entityId))).not.toBeVisible();
    }
  });

  test("should maintain performance with entity updates", async ({ runtimePage }) => {
    await E2EHelpers.waitForRuntimeReady(runtimePage);

    const entityCount = 5000;

    // Create entities
    for (let i = 0; i < entityCount; i++) {
      const entityData = {
        id: `perf-entity-${i.toString().padStart(4, "0")}`,
        type: "node",
        name: `Perf Entity ${i}`,
      };
      await E2EHelpers.createTestEntity(runtimePage, entityData);
    }

    // Measure update performance
    const updateStartTime = Date.now();

    // Update all entities
    for (let i = 0; i < entityCount; i++) {
      const entityId = `perf-entity-${i.toString().padStart(4, "0")}`;
      await runtimePage.click(EntitySelectors.editButton(entityId));
      await runtimePage.fill(EntitySelectors.nameInput, `Updated Entity ${i}`);
      await runtimePage.click(EntitySelectors.saveButton);
    }

    const updateTime = Date.now() - updateStartTime;
    console.log(`Update time for ${entityCount} entities: ${updateTime}ms`);

    expect(updateTime).toBeLessThan(200000); // Less than 3.33 minutes
    const avgUpdateTime = updateTime / entityCount;
    expect(avgUpdateTime).toBeLessThan(100); // Less than 100ms per update

    // Verify updates
    for (let i = 0; i < Math.min(100, entityCount); i++) {
      const entityId = `perf-entity-${i.toString().padStart(4, "0")}`;
      await expect(
        runtimePage.locator(`${EntitySelectors.container(entityId)} ${EntitySelectors.displayName}`)
      ).toHaveText(`Updated Entity ${i}`);
    }
  });

  test("should handle entity filtering and searching at scale", async ({ runtimePage }) => {
    await E2EHelpers.waitForRuntimeReady(runtimePage);

    const entityCount = 2000;

    // Create entities with different types
    const entityTypes = ["node", "flow", "connector"];

    for (let i = 0; i < entityCount; i++) {
      const entityType = entityTypes[i % entityTypes.length];
      const entityData = {
        id: `filter-entity-${i.toString().padStart(4, "0")}`,
        type: entityType,
        name: `${entityType} Entity ${i}`,
      };
      await E2EHelpers.createTestEntity(runtimePage, entityData);
    }

    // Test filtering by type
    const filterStartTime = Date.now();

    await runtimePage.click('[data-testid="filter-selector"]');
    await runtimePage.click('[data-testid="filter-type-node"]');
    await runtimePage.waitForSelector('[data-testid="filter-applied"]', { timeout: 5000 });

    const filterTime = Date.now() - filterStartTime;
    console.log(`Filter time: ${filterTime}ms`);
    expect(filterTime).toBeLessThan(2000); // Less than 2 seconds

    // Verify filtered results
    const visibleEntities = await runtimePage.locator('[data-testid^="entity-"]').count();
    const expectedNodeCount = Math.ceil(entityCount / entityTypes.length);
    expect(visibleEntities).toBe(expectedNodeCount);

    // Test search functionality
    const searchStartTime = Date.now();

    await runtimePage.fill('[data-testid="search-input"]', "node Entity 123");
    await runtimePage.click('[data-testid="search-btn"]');
    await runtimePage.waitForSelector('[data-testid="search-results"]', { timeout: 5000 });

    const searchTime = Date.now() - searchStartTime;
    console.log(`Search time: ${searchTime}ms`);
    expect(searchTime).toBeLessThan(1000); // Less than 1 second

    // Verify search results
    const searchResults = await runtimePage.locator('[data-testid="search-result-item"]').count();
    expect(searchResults).toBeGreaterThan(0);
  });
});
