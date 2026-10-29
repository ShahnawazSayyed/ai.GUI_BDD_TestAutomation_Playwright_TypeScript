import { Given, Then } from "@cucumber/cucumber";
import { AutomationWorld } from "../support/hook";

Given("I navigate to {string}", async function (this: AutomationWorld, url: string) {
  if (!this.pageManager) {
    throw new Error("Playwright page manager was not initialized");
  }
  await this.pageManager.getTestAutomationPracticePage().navigateToPracticeSite(url);
});

Then("The page title should be {string}", async function (this: AutomationWorld, expectedTitle: string) {
  if (!this.pageManager) {
    throw new Error("Playwright page manager was not initialized");
  }
  await this.pageManager.getTestAutomationPracticePage().waitForTitle(expectedTitle);
});