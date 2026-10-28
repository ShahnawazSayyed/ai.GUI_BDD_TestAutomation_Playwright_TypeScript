import * as fs from "node:fs";
import * as path from "node:path";

export interface BrowserProperties {
  BROWSER: "chrome" | "chromium" | "firefox" | "webkit";
  HEADLESS: boolean;
  WINDOW_SIZE: string;
  IMPLICIT_WAIT: number;
  PAGE_LOAD_TIMEOUT: number;
}

export interface EvidenceProperties {
  SCREENSHOT_ON_FAILURE: boolean;
  SCREENSHOT_ON_SUCCESS: boolean;
  SCREENSHOT_PATH: string;
  VIDEO_RECORDING: boolean;
  VIDEO_PATH: string;
}

export interface CommonConfig {
  BROWSER_PROPERTIES: BrowserProperties;
  EVIDENCE_PROPERTIES: EvidenceProperties;
}

const configPath = path.resolve(process.cwd(), "config/commonConfig.json");

export function loadCommonConfig(): CommonConfig {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as CommonConfig;

  if (!config.BROWSER_PROPERTIES || !config.EVIDENCE_PROPERTIES) {
    throw new Error(`Invalid common configuration: ${configPath}`);
  }

  const viewport = config.BROWSER_PROPERTIES.WINDOW_SIZE
    .split(",")
    .map((value) => Number(value.trim()));

  if (viewport.length !== 2 || viewport.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new Error("WINDOW_SIZE must use the format \"1920,1080\"");
  }

  if (process.env.BROWSER) {
    config.BROWSER_PROPERTIES.BROWSER = process.env.BROWSER.toLowerCase() as BrowserProperties["BROWSER"];
  }

  if (process.env.HEADLESS !== undefined) {
    config.BROWSER_PROPERTIES.HEADLESS = process.env.HEADLESS.toLowerCase() !== "false";
  }

  return config;
}

export const commonConfig = loadCommonConfig();
