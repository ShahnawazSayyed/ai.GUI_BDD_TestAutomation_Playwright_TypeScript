# Cucumber BDD Testing

## Overview

Cucumber connects plain-language Gherkin scenarios with Playwright browser automation. Feature files describe behavior, while step definitions execute the browser actions through page objects.

## Project Structure

```text
features/                  Gherkin feature and scenario files
playwright/support/        Cucumber hooks and PageManager
playwright/steps/          Step definitions
playwright/pages/          Page Object Model classes
playwright/config/         Playwright configuration
cucumber.cjs               Cucumber runtime configuration
```

## Feature Files

Feature files live in `features/` and use the `.feature` extension.

```gherkin
Feature: Basic Playwright Practice

  Scenario: Open the Test Automation Practice website
    Given I navigate to "https://testautomationpractice.blogspot.com/"
    Then The page title should be "Automation Testing Practice"
```

## Step Definitions

Step definitions are stored in `playwright/steps/` and must match feature expressions such as `Given`, `When`, and `Then`.

Example:

```typescript
Given("I navigate to {string}", async function (url: string) {
  await this.pageManager
    .getTestAutomationPracticePage()
    .navigateToPracticeSite(url);
});
```

## Hooks

`playwright/support/hook.ts` manages the Cucumber World and Playwright lifecycle:

- Launches the selected browser before each scenario.
- Creates a browser context and page.
- Initializes the PageManager.
- Captures a screenshot when a scenario fails.
- Closes the context and browser after each scenario.

## Configuration

`cucumber.cjs` configures:

- TypeScript loading through `ts-node/register`
- Support files under `playwright/support/**/*.ts`
- Step definitions under `playwright/steps/**/*.ts`
- Feature discovery under `features/**/*.feature`
- Progress and HTML report formatting

Reports are written to `test-results/cucumber-report.html` by default.

## Common Configuration

Browser and evidence settings are loaded from `config/commonConfig.json`:

```json
{
  "BROWSER_PROPERTIES": {
    "BROWSER": "chrome",
    "HEADLESS": false,
    "WINDOW_SIZE": "1920,1080",
    "IMPLICIT_WAIT": 10,
    "PAGE_LOAD_TIMEOUT": 30
  },
  "EVIDENCE_PROPERTIES": {
    "SCREENSHOT_ON_FAILURE": true,
    "SCREENSHOT_ON_SUCCESS": false,
    "SCREENSHOT_PATH": "./test-results/screenshots",
    "VIDEO_RECORDING": true,
    "VIDEO_PATH": "./test-results/videos"
  }
}
```

## Commands

Run all Cucumber scenarios:

```powershell
npm test
```

Run in headed mode:

```powershell
npm run test:headed
```

Generate an HTML report:

```powershell
npm run test:report
```

Type-check framework TypeScript:

```powershell
npm run typecheck
```

## Adding a New Scenario

1. Add a scenario or feature in `features/`.
2. Add matching step definitions in `playwright/steps/`.
3. Add reusable locators and actions to the appropriate page object.
4. Register the page in `PageManager` if a new page object is created.
5. Run `npm run typecheck` and `npm test`.
