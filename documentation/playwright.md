# Playwright UI Automation

## Overview

This project uses Playwright Test with TypeScript for browser automation. Playwright supports Chromium, Firefox, and WebKit through the browser API.

## Configuration

The Playwright configuration is located at `playwright/config/playwright.config.ts`.

Key settings include:

- Default browser project: Chromium
- Timeout: 30 seconds
- Assertion timeout: 5 seconds
- Headless mode enabled by default
- CI retries and worker limits
- Screenshots, videos, and traces retained after failures
- Optional `BASE_URL` base URL and `HEADLESS` environment setting

## Browser Installation

Install the required Chromium browser after dependency installation:

```powershell
npx playwright install chromium
```

Install all supported browsers when needed:

```powershell
npx playwright install
```

## Commands

Run the Playwright configuration test discovery:

```powershell
npm run test:ui
```

Run a focused Playwright test:

```powershell
npx playwright test --config=playwright/config/playwright.config.ts
```

Run headed mode:

```powershell
npx playwright test --config=playwright/config/playwright.config.ts --headed
```

## Page Object Model

Page objects are stored in `playwright/pages/`:

- `commonPage.ts` contains reusable page actions and locators.
- `page_testautomationpractice.ts` contains actions and assertions for the practice website.

The `PageManager` in `playwright/support/pageManager.ts` creates and exposes page objects so step definitions use one shared Playwright `Page` instance.

## Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `BASE_URL` | Sets the Playwright base URL | Not set |
| `HEADLESS` | Set to `false` to run a browser visibly | `true` |
| `BROWSER` | Selects `chromium`, `firefox`, or `webkit` for Cucumber hooks | `chromium` |

Example:

```powershell
$env:HEADLESS="false"
$env:BROWSER="chromium"
npm test
```
