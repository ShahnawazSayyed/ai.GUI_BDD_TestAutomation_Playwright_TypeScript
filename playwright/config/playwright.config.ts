import { defineConfig, devices } from "@playwright/test";
import { commonConfig } from "../../utilities/commonConfig";

const browser = commonConfig.BROWSER_PROPERTIES;
const evidence = commonConfig.EVIDENCE_PROPERTIES;
const [width, height] = browser.WINDOW_SIZE.split(",").map((value) => Number(value.trim()));
const configuredBrowsers = process.env.BROWSERS ?? browser.BROWSER;
const browsers = [...new Set(configuredBrowsers
  .toLowerCase()
  .split(",")
  .map((name) => name.trim())
  .map((name) => name === "chrome" ? "chromium" : name)
  .filter((name) => ["chromium", "firefox", "webkit"].includes(name)))];

const workers = process.env.WORKERS
  ? Number(process.env.WORKERS)
  : process.env.CI ? 1 : undefined;

if (process.env.WORKERS !== undefined && (!Number.isInteger(workers) || (workers ?? 0) < 1)) {
  throw new Error("WORKERS must be a positive integer");
}

if (browsers.length === 0) {
  throw new Error("BROWSERS must contain chromium, firefox, and/or webkit");
}

const projects = browsers.map((name) => ({
  name,
  use: {
    ...devices[name === "chromium" ? "Desktop Chrome" : name === "firefox" ? "Desktop Firefox" : "Desktop Safari"]
  }
}));

export default defineConfig({
  testDir: "../tests",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.BASE_URL,
    headless: browser.HEADLESS,
    viewport: { width, height },
    launchOptions: {
      slowMo: browser.SLOW_MOTION
    },
    trace: "retain-on-failure",
    screenshot: evidence.SCREENSHOT_ON_FAILURE ? "only-on-failure" : "off",
    video: evidence.VIDEO_RECORDING ? "retain-on-failure" : "off"
  },
  projects
});
