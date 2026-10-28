import { Page } from "@playwright/test";
import { CommonPage } from "../pages/commonPage";
import { TestAutomationPracticePage } from "../pages/page_testautomationpractice";

export class PageManager {
  private readonly pages = new Map<string, CommonPage>();
  readonly testAutomationPractice: TestAutomationPracticePage;
  readonly common: CommonPage;

  constructor(private readonly page: Page) {
    this.common = new CommonPage(page);
    this.testAutomationPractice = new TestAutomationPracticePage(page);
    this.pages.set("common", this.common);
    this.pages.set("testAutomationPractice", this.testAutomationPractice);
  }

  getPage<T extends CommonPage>(name: string): T {
    const page = this.pages.get(name);
    if (!page) {
      throw new Error(`Unknown page: ${name}`);
    }
    return page as T;
  }

  getCommonPage(): CommonPage {
    return this.common;
  }

  getTestAutomationPracticePage(): TestAutomationPracticePage {
    return this.testAutomationPractice;
  }
}

export default PageManager;