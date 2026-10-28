import { expect, test } from "@playwright/test";

test.describe("Test Automation Practice", () => {
  test("opens the practice website and verifies the page title", async ({ page }) => {
    await page.goto("https://testautomationpractice.blogspot.com/", {
      waitUntil: "domcontentloaded"
    });

    await expect(page).toHaveTitle("Automation Testing Practice");
  });
});
