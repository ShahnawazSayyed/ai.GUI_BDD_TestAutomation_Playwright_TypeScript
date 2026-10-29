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

setDefaultTimeout(60_000);

export interface AutomationWorld extends World {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  pageManager?: PageManager;
  consoleErrors?: string[];
}

export class AutomationWorldImpl extends World implements AutomationWorld {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  pageManager?: PageManager;
  consoleErrors?: string[];

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
  this.consoleErrors = [];
  await this.context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: true
  });
  this.page = await this.context.newPage();
  this.page.on("console", (message) => {
    if (message.type() === "error") {
      this.consoleErrors?.push(message.text());
    }
  });
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

  if (this.consoleErrors?.length && failed) {
    const logsDirectory = path.resolve(process.cwd(), "test-results/console");
    fs.mkdirSync(logsDirectory, { recursive: true });
    const consolePath = path.join(
      logsDirectory,
      `${scenario.pickle.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "scenario"}.log`
    );
    fs.writeFileSync(consolePath, this.consoleErrors.join("\n"));
  }

  const video = evidenceProperties.VIDEO_RECORDING ? this.page?.video() : undefined;
  if (failed) {
    const tracesDirectory = path.resolve(process.cwd(), "test-results/traces");
    fs.mkdirSync(tracesDirectory, { recursive: true });
    const tracePath = path.join(
      tracesDirectory,
      `${scenario.pickle.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "scenario"}.zip`
    );
    await this.context?.tracing.stop({ path: tracePath });
  } else {
    await this.context?.tracing.stop();
  }
  await this.context?.close();

  if (video) {
    const videoPath = await video.path();
    if (fs.existsSync(videoPath)) {
      await this.attach(fs.readFileSync(videoPath), "video/webm");
    }
  }

  await this.browser?.close();
});