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
cicd/                      CI/CD runners, quality gates, and tests
.github/agents/            Custom AI workflow agents
.github/workflows/         GitHub Actions workflows
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

# Generate review-only locator replacement candidates
npm run test:heal-locators -- --url https://testautomationpractice.blogspot.com/ --browser chromium --selector "#name" --description "Name input"

# Compare discovered, changed, existing, and incident coverage
npm run test:coverage-gaps -- --url https://testautomationpractice.blogspot.com/ --browser chromium --max-pages 10

# Run bounded exploratory browser testing
npm run test:exploratory -- --url https://testautomationpractice.blogspot.com/ --browser chromium --max-pages 10 --max-actions 20
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

## AI-Assisted Test Agents

The framework includes repository custom agents under [.github/agents/](.github/agents/) and deterministic local modules under `utilities/`. Agents use evidence and review output rather than silently changing the repository.

| Agent | Purpose | Local command | Reports or workflow |
|---|---|---|---|
| Test Discovery | Crawls a website, compares discovered controls with existing coverage, and prepares safe BDD candidates. | `npm run test:discover -- --url <url> --max-pages 10 --browser chromium` | [Agent](.github/agents/test-discovery.agent.md), `test-results/test-discovery/` |
| Test Impact | Maps git changes to impacted Cucumber scenarios, Playwright specs, risk, and browser matrix. | `npm run test:impact -- --base origin/master --head HEAD` | [Agent](.github/agents/test-impact.agent.md), [Pull request workflow](.github/workflows/test-impact.yml), `test-results/test-impact/` |
| Failure Diagnosis | Reviews traces, screenshots, videos, console logs, reports, and stack text to classify failures. | `npm run test:diagnose -- --input test-results --browser chromium` | [Agent](.github/agents/test-failure-diagnosis.agent.md), `test-results/failure-diagnosis/` |
| Self-Healing Locator | Compares a failing locator with the current DOM and proposes unique accessible, role, label, or test-ID replacements. Source changes require human review. | `npm run test:heal-locators -- --url <url> --browser chromium --selector "<selector>" --description "<element>"` | [Agent](.github/agents/self-healing-locator.agent.md), [Workflow](.github/workflows/self-healing-locator.yml), `test-results/locator-healing/` |
| Coverage Gap | Compares discovered pages, existing Gherkin and steps, branch changes, and production incidents, then ranks missing coverage. Creates tests only with explicit approval. | `npm run test:coverage-gaps -- --url <url> --browser chromium --max-pages 10 --base origin/master --head HEAD` | [Agent](.github/agents/coverage-gap.agent.md), [Documentation](documentation/coverage-gap-analysis.md), [Workflow](.github/workflows/coverage-gap.yml), `test-results/coverage-gaps/` |
| Exploratory Testing | Runs bounded browser sessions and detects broken links, console/JavaScript/API failures, navigation, malformed data, dead ends, overflow, and form defects. Destructive actions are blocked unless explicitly authorized. | `npm run test:exploratory -- --url <url> --browser chromium --max-pages 10 --max-actions 20` | [Agent](.github/agents/exploratory-testing.agent.md), [Documentation](documentation/exploratory-testing.md), [Workflow](.github/workflows/exploratory-testing.yml), `test-results/exploratory/` |

### Agent Safety

- Review discovery, impact, diagnosis, locator, coverage, and exploratory outputs before applying changes.
- Self-healing and coverage-gap agents require explicit approval before source changes.
- The explorer blocks payment, checkout, purchase, delete, remove, logout, unsubscribe, and close-account actions unless `--authorize-destructive` is supplied explicitly.
- Do not provide secrets, credentials, or destructive-action authorization unless it is intended and approved for the target environment.
- Use the appropriate GitHub workflow to upload evidence as artifacts, or run the local module for review.

## Documentation

- [CI and CD quality gates](cicd/quality-gates.md) - Unit, integration, and post-deployment quality gates.
- [GitHub Actions CI/CD](cicd/github-actions.md) - Workflow, browser matrix, reports, and artifacts.
- [Browser installation and parallel execution](documentation/browser-installation-and-parallel-execution.md) - Install Chromium, Firefox, and WebKit and configure worker-based parallel runs.
- [Test Discovery agent](.github/agents/test-discovery.agent.md) - Discover website coverage and implement reviewed missing BDD scenarios.
- [Test Impact agent](.github/agents/test-impact.agent.md) - Select impacted tests and browser matrices from changed files.
- [Test Failure Diagnosis agent](.github/agents/test-failure-diagnosis.agent.md) - Classify failures from traces, screenshots, videos, console output, reports, and stack evidence.
- [Self-healing locator agent](.github/agents/self-healing-locator.agent.md) - Review accessible, role, label, test-ID, and stable locator candidates without automatic code changes.
- [Coverage Gap agent](.github/agents/coverage-gap.agent.md) - Prioritize gaps across discovered pages, Gherkin, steps, branch changes, and production incidents; creates tests only with explicit approval.
- [Coverage Gap Analysis](documentation/coverage-gap-analysis.md) - Local and GitHub Actions usage, incident input format, approval behavior, and generated reports.
- [Exploratory Testing](documentation/exploratory-testing.md) - Bounded autonomous browser exploration, anomaly evidence, safety bounds, and GitHub Actions usage.
- [Playwright documentation](documentation/playwright.md) - Browser setup, configuration, Playwright commands, and the Page Object Model.
- [Cucumber BDD documentation](documentation/cucumber-bdd.md) - Feature files, step definitions, hooks, reporting, shared configuration, and adding scenarios.

## Example Scenario

```gherkin
Feature: Basic Playwright Practice

  Scenario: Open the Test Automation Practice website
    Given I navigate to "https://testautomationpractice.blogspot.com/"
    Then The page title should be "Automation Testing Practice"
```
