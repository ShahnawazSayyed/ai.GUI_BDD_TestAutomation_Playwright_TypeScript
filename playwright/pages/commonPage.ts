import { expect, Locator, Page } from "@playwright/test";

export class CommonPage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigate(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: "domcontentloaded" });
  }

  async getTitle(): Promise<string> {
    return this.page.title();
  }

  async waitForTitle(expectedTitle: string, timeout = 45_000): Promise<void> {
    await expect(this.page).toHaveTitle(expectedTitle, { timeout });
  }

  protected getLocator(selector: string): Locator {
    return this.page.locator(selector);
  }
}

export default CommonPage;