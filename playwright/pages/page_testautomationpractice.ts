import { CommonPage } from "./commonPage";

export class TestAutomationPracticePage extends CommonPage {
  async navigateToPracticeSite(url = "https://testautomationpractice.blogspot.com/"): Promise<void> {
    await this.navigate(url);
  }

  async isTitleEqual(expectedTitle: string): Promise<boolean> {
    return (await this.getTitle()) === expectedTitle;
  }

  async waitForTitle(expectedTitle: string, timeout = 30_000): Promise<void> {
    await super.waitForTitle(expectedTitle, timeout);
  }
}

export default TestAutomationPracticePage;