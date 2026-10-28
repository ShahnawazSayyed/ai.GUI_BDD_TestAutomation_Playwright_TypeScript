# Playwright and Cucumber BDD Test Automation

This project is a TypeScript UI test automation framework that combines:

- Playwright for browser automation
- Cucumber for BDD-style Gherkin scenarios
- TypeScript for page objects and step implementations
- A Page Object Model for reusable and maintainable UI actions

## Prerequisites

- Node.js 18 or later
- npm

## Setup

Install project dependencies:

```powershell
npm install
```

Install the Playwright Chromium browser:

```powershell
npx playwright install chromium
```

Install all supported Playwright browsers when required:

```powershell
npx playwright install
```

## Project Structure

```text
features/                  Gherkin feature files
config/                    Shared JSON configuration
playwright/
  config/                  Playwright configuration
  pages/                   Page Object Model classes
  steps/                   Cucumber step definitions
  support/                 Hooks and PageManager
documentation/             Detailed framework documentation
utilities/                 Shared framework utilities
```

## Running Tests

```powershell
# Run all Cucumber BDD scenarios
npm test

# Run in headed mode
npm run test:headed

# Generate the Cucumber HTML report
npm run test:report

# Type-check the TypeScript framework
npm run typecheck

# Run the Playwright Test configuration
npm run test:ui
```

The Cucumber HTML report is generated at `test-results/cucumber-report.html`. Evidence such as screenshots and videos is controlled by `config/commonConfig.json`.

## Configuration

Framework browser and evidence settings are maintained in `config/commonConfig.json`, including:

- Browser selection
- Headless mode
- Browser window size
- Implicit wait
- Page load timeout
- Screenshot settings
- Video recording settings

Environment variables `BROWSER`, `HEADLESS`, and `BASE_URL` can override supported configuration and environment values.

## Documentation

- [Playwright documentation](documentation/playwright.md) - Browser setup, configuration, Playwright commands, and the Page Object Model.
- [Cucumber BDD documentation](documentation/cucumber-bdd.md) - Feature files, step definitions, hooks, reporting, shared configuration, and adding scenarios.

## Example Scenario

```gherkin
Feature: Basic Playwright Practice

  Scenario: Open the Test Automation Practice website
    Given I navigate to "https://testautomationpractice.blogspot.com/"
    Then The page title should be "Automation Testing Practice"
```
