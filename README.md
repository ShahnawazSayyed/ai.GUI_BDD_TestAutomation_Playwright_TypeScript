# Playwright and Cucumber BDD Test Automation

This project is a TypeScript UI test automation framework that combines:

- Playwright for browser automation
- Cucumber for BDD-style Gherkin scenarios
- TypeScript for page objects and step implementations
- A Page Object Model for reusable and maintainable UI actions

## Prerequisites

- Node.js 22, 24, or 26 or later (Cucumber 13 requirement)
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

For complete setup and execution examples, see
[Browser Installation and Parallel Execution](documentation/browser-installation-and-parallel-execution.md).

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

# Run Cucumber scenarios with 4 parallel workers
npm run test:parallel

# Run Playwright tests in parallel (4 workers)
$env:WORKERS="4"; npm run test:ui:parallel

# Run Playwright tests across Chromium, Firefox, and WebKit
npm run test:ui:all

# Run the same Cucumber suite in one browser
npm run test:chromium
npm run test:firefox
npm run test:webkit

# Run the Cucumber suite concurrently in Chromium, Firefox, and WebKit
npm run test:browsers

# Discover website coverage candidates and generate a BDD draft
npm run test:discover -- --url https://testautomationpractice.blogspot.com/ --max-pages 5

# Analyze tests impacted by a git range
npm run test:impact -- --base main --head HEAD

# Diagnose failure evidence from Playwright or Cucumber artifacts
npm run test:diagnose -- --input test-results --browser chromium
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

- [CI and CD quality gates](cicd/quality-gates.md) - Unit, integration, and post-deployment quality gates.
- [GitHub Actions CI/CD](cicd/github-actions.md) - Workflow, browser matrix, reports, and artifacts.
- [Browser installation and parallel execution](documentation/browser-installation-and-parallel-execution.md) - Install Chromium, Firefox, and WebKit and configure worker-based parallel runs.
- [Self-healing locator agent](.github/agents/self-healing-locator.agent.md) - Review accessible, role, label, test-ID, and stable locator candidates without automatic code changes.
- [Playwright documentation](documentation/playwright.md) - Browser setup, configuration, Playwright commands, and the Page Object Model.
- [Cucumber BDD documentation](documentation/cucumber-bdd.md) - Feature files, step definitions, hooks, reporting, shared configuration, and adding scenarios.

## Example Scenario

```gherkin
Feature: Basic Playwright Practice

  Scenario: Open the Test Automation Practice website
    Given I navigate to "https://testautomationpractice.blogspot.com/"
    Then The page title should be "Automation Testing Practice"
```
