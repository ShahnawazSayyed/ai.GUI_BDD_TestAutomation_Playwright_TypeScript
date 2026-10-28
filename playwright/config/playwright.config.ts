import { defineConfig, devices } from "@playwright/test";
import { commonConfig } from "../../utilities/commonConfig";

const browser = commonConfig.BROWSER_PROPERTIES;
const evidence = commonConfig.EVIDENCE_PROPERTIES;
const [width, height] = browser.WINDOW_SIZE.split(",").map((value) => Number(value.trim()));

export default defineConfig({
  testDir: "..",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.BASE_URL,
    headless: browser.HEADLESS,
    viewport: { width, height },
    trace: "retain-on-failure",
    screenshot: evidence.SCREENSHOT_ON_FAILURE ? "only-on-failure" : "off",
    video: evidence.VIDEO_RECORDING ? "retain-on-failure" : "off"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
