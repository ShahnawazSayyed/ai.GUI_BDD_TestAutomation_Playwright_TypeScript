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
import { commonConfig } from "../../utilities/commonConfig";
import * as fs from "node:fs";
import * as path from "node:path";

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
  const browserProperties = commonConfig.BROWSER_PROPERTIES;
  const evidenceProperties = commonConfig.EVIDENCE_PROPERTIES;
  const browserName = process.env.BROWSER?.toLowerCase() ?? browserProperties.BROWSER;
  const browserType = browserName === "firefox"
    ? firefox
    : browserName === "webkit"
      ? webkit
      : chromium;

  this.browser = await browserType.launch({
    headless: browserProperties.HEADLESS,
    slowMo: browserProperties.SLOW_MOTION
  });
  const [width, height] = browserProperties.WINDOW_SIZE
    .split(",")
    .map((value) => Number(value.trim()));
  this.context = await this.browser.newContext({
    baseURL: process.env.BASE_URL,
    viewport: { width, height },
    recordVideo: evidenceProperties.VIDEO_RECORDING
      ? { dir: path.resolve(process.cwd(), evidenceProperties.VIDEO_PATH) }
      : undefined
  });
  this.page = await this.context.newPage();
  this.page.setDefaultTimeout(browserProperties.IMPLICIT_WAIT * 1000);
  this.page.setDefaultNavigationTimeout(browserProperties.PAGE_LOAD_TIMEOUT * 1000);
  this.pageManager = new PageManager(this.page);
});

After(async function (this: AutomationWorld, scenario) {
  const evidenceProperties = commonConfig.EVIDENCE_PROPERTIES;
  const failed = scenario.result?.status === Status.FAILED;
  const shouldCapture = this.page && (
    (failed && evidenceProperties.SCREENSHOT_ON_FAILURE) ||
    (!failed && evidenceProperties.SCREENSHOT_ON_SUCCESS)
  );

  if (shouldCapture) {
    fs.mkdirSync(path.resolve(process.cwd(), evidenceProperties.SCREENSHOT_PATH), { recursive: true });
    const safeName = scenario.pickle.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    const screenshotPath = path.resolve(
      process.cwd(),
      evidenceProperties.SCREENSHOT_PATH,
      `${safeName || "scenario"}-${Date.now()}.png`
    );
    await this.page!.screenshot({ path: screenshotPath, fullPage: true });
    await this.attach(fs.readFileSync(screenshotPath), "image/png");
  }

  const video = evidenceProperties.VIDEO_RECORDING ? this.page?.video() : undefined;
  await this.context?.close();

  if (video) {
    const videoPath = await video.path();
    if (fs.existsSync(videoPath)) {
      await this.attach(fs.readFileSync(videoPath), "video/webm");
    }
  }

  await this.browser?.close();
});