import { test, expect } from "./fixtures";

test.describe("Smoke Tests", () => {
  test("should load the application successfully", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");

    // Verify the page loads (basic check)
    await expect(page.locator("body")).toBeVisible();

    // Duck Flow surfaces legitimate "Error" text in telemetry cards, so rely on runtime-ready signal instead
    await expect(page.locator('[data-testid="runtime-ready"]')).toBeVisible();

    // Check that no fatal overlay is present (placeholder selector until dedicated error banner exists)
    const overlayMatches = await page.locator('[data-testid="error-overlay"]').count();
    const fatalTextMatches = await page.getByText("Unhandled Application Error").count();
    expect(overlayMatches + fatalTextMatches).toBe(0);
  });

  test("should have basic HTML structure", async ({ page }) => {
    await page.goto("/");

    // Check for basic HTML elements (use count instead of visibility for head)
    await expect(page.locator("html")).toHaveCount(1);
    await expect(page.locator("head")).toHaveCount(1);
    await expect(page.locator("body")).toHaveCount(1);

    // Verify no console errors during load
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Wait a bit for potential errors
    await page.waitForTimeout(2000);

    // Filter out expected warnings (like React dev warnings)
    const criticalErrors = errors.filter(
      (error) =>
        !error.includes("Warning:") &&
        !error.includes("ReactDOMTestUtils") &&
        !error.includes("act()")
    );

    // Assert no critical console errors occurred
    expect(criticalErrors).toHaveLength(0);
  });

  test("should handle basic navigation", async ({ page }) => {
    await page.goto("/");

    // Try to interact with the page (if elements exist)
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Check if page is responsive to basic interactions
    await page.keyboard.press("Tab"); // Try tab navigation

    // Page should still be loaded
    await expect(page.locator("body")).toBeVisible();
  });
});
