import {
  After,
  Before,
  IWorldOptions,
  setDefaultTimeout,
  setWorldConstructor,
  Status,
  World
} from "@cucumber/cucumber";
import {
  Browser,
  BrowserContext,
  chromium,
  firefox,
  Page,
  webkit
} from "@playwright/test";
import { PageManager } from "./pageManager";

setDefaultTimeout(30_000);

export interface AutomationWorld extends World {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  pageManager?: PageManager;
}

export class AutomationWorldImpl extends World implements AutomationWorld {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  pageManager?: PageManager;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(AutomationWorldImpl);

Before(async function (this: AutomationWorld) {
  const browserName = process.env.BROWSER?.toLowerCase() ?? "chromium";
  const browserType = browserName === "firefox"
    ? firefox
    : browserName === "webkit"
      ? webkit
      : chromium;

  this.browser = await browserType.launch({
    headless: process.env.HEADLESS !== "false"
  });
  this.context = await this.browser.newContext({
    baseURL: process.env.BASE_URL
  });
  this.page = await this.context.newPage();
  this.pageManager = new PageManager(this.page);
});

After(async function (this: AutomationWorld, scenario) {
  if (scenario.result?.status === Status.FAILED && this.page) {
    const screenshot = await this.page.screenshot({ fullPage: true });
    await this.attach(screenshot, "image/png");
  }

  await this.context?.close();
  await this.browser?.close();
});