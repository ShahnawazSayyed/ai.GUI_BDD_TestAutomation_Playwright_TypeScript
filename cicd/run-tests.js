const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const runner = process.argv[2];
const browser = (process.argv[3] || process.env.BROWSER || "chromium").toLowerCase();
const workers = process.env.WORKERS || "2";
const acceptedBrowsers = ["chromium", "firefox", "webkit"];

if (!["cucumber", "playwright"].includes(runner)) {
  console.error("Usage: node cicd/run-tests.js <cucumber|playwright> <browser>");
  process.exit(1);
}

if (!acceptedBrowsers.includes(browser)) {
  console.error(`Unsupported browser "${browser}". Use chromium, firefox, or webkit.`);
  process.exit(1);
}

fs.mkdirSync(path.resolve(process.cwd(), "test-results"), { recursive: true });

const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const args = runner === "cucumber"
  ? [
      "cucumber-js",
      "--parallel",
      workers,
      "--format",
      "progress",
      "--format",
      `html:test-results/cucumber-report-${browser}.html`
    ]
  : [
      "playwright",
      "test",
      "--config=playwright/config/playwright.config.ts",
      `--project=${browser}`,
      "--workers",
      workers
    ];

const result = spawnSync(executable, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    BROWSER: browser,
    BROWSERS: browser,
    HEADLESS: process.env.HEADLESS || "true",
    CI: "true"
  },
  shell: process.platform === "win32"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
