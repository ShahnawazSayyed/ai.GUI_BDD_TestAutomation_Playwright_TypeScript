import { CommonPage } from "./commonPage";

export class TestAutomationPracticePage extends CommonPage {
  async navigateToPracticeSite(url = "https://testautomationpractice.blogspot.com/"): Promise<void> {
    await this.navigate(url);
  }

  async isTitleEqual(expectedTitle: string): Promise<boolean> {
    return (await this.getTitle()) === expectedTitle;
  }
}

export default TestAutomationPracticePage;