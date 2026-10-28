# Browser Installation and Parallel Execution

This guide explains how to install Playwright browsers and run the framework in
one browser, parallel workers, or multiple browsers.

## Install Browser Dependencies

Install the npm dependencies first:

```powershell
npm install
```

Install one browser when only that browser is needed:

```powershell
npx playwright install chromium
npx playwright install firefox
npx playwright install webkit
```

Install all supported browsers:

```powershell
npx playwright install
```

On a new machine or CI environment, install the operating-system dependencies
for Playwright browsers when required:

```powershell
npx playwright install --with-deps chromium
npx playwright install --with-deps firefox
npx playwright install --with-deps webkit
```

The downloaded browser binaries are separate from the npm packages. Browser
installation must be repeated whenever Playwright is installed in a new
environment. After installing or updating Playwright, run one of the commands
above if the executable is not found.

## Cucumber Parallel Execution

Cucumber uses one Playwright browser process per scenario worker. The following
commands run scenarios with four parallel workers:

```powershell
npm run test:parallel
npm run test:parallel:headed
```

The equivalent direct Cucumber command is:

```powershell
npx cucumber-js --parallel 4
```

Use one browser by setting `BROWSER`:

```powershell
npm run test:chromium
npm run test:firefox
npm run test:webkit
```

Run the same Cucumber suite concurrently in Chromium, Firefox, and WebKit:

```powershell
npm run test:browsers
```

This command starts three separate Cucumber runs and gives each run four workers
by default. Set a shared worker count with:

```powershell
$env:CUCUMBER_WORKERS="2"
npm run test:browsers
```

Reports for the multi-browser Cucumber runs are written to:

```text
test-results/cucumber-report-chromium.html
test-results/cucumber-report-firefox.html
test-results/cucumber-report-webkit.html
```

## Playwright Parallel Execution

Native Playwright tests are already configured with fully parallel execution.
Worker count is controlled by the `WORKERS` environment variable:

```powershell
$env:WORKERS="4"
npm run test:ui:parallel
```

Without `WORKERS`, the framework uses Playwright's local worker default. In CI,
the default configured worker count is one.

You can also pass the worker count directly:

```powershell
npx playwright test --config=playwright/config/playwright.config.ts --workers=4
```

## Playwright Browser Selection

Run one browser project:

```powershell
npm run test:ui:chromium
npm run test:ui:firefox
npm run test:ui:webkit
```

Run all browser projects:

```powershell
npm run test:ui:all
```

The browser list can also be selected with the `BROWSERS` environment variable:

```powershell
$env:BROWSERS="chromium,firefox,webkit"
$env:WORKERS="4"
npm run test:ui:parallel
```

Accepted Playwright browser names are `chromium`, `firefox`, and `webkit`.
`chrome` is accepted as an alias for `chromium`.

## Parallelism with Multiple Browsers

To run two browser projects with two workers each:

```powershell
$env:BROWSERS="chromium,firefox"
$env:WORKERS="2"
npm run test:ui
```

For a full cross-browser run:

```powershell
$env:BROWSERS="chromium,firefox,webkit"
$env:WORKERS="4"
npm run test:ui
```

Test isolation is provided by Playwright: each worker receives a separate
browser context, and tests assigned to different workers or browser projects do
not share page state.

## Troubleshooting

If Playwright reports that an executable does not exist, install that browser:

```powershell
npx playwright install firefox
npx playwright install webkit
```

List discovered Playwright tests and browser projects:

```powershell
$env:BROWSERS="chromium,firefox,webkit"
npx playwright test --config=playwright/config/playwright.config.ts --list
```

Use PowerShell environment variables only for the current terminal session. Run
`Remove-Item Env:WORKERS`, `Remove-Item Env:BROWSERS`, or the equivalent
command if a later run should no longer use a temporary override.
