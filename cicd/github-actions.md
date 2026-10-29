# GitHub Actions CI/CD

The GitHub Actions entry workflow is [ci.yml](../.github/workflows/ci.yml).
Reusable test orchestration for CI is implemented by
[run-tests.js](run-tests.js).

## Jobs

- `validate`: installs npm dependencies and runs TypeScript type-checking.
- `cucumber`: runs the Cucumber suite in Chromium, Firefox, and WebKit matrix jobs.
- `playwright`: runs native Playwright tests in Chromium, Firefox, and WebKit matrix jobs.

Each browser is tested in a separate GitHub-hosted Ubuntu runner. Matrix jobs
do not share browser state or test results.

## Triggers

The workflow runs on:

- Pushes to `main` or `master`
- Pull requests targeting `main` or `master`
- Manual runs through the GitHub Actions **Run workflow** button

## CI behavior

GitHub Actions uses Node.js 24 because that version satisfies the Node runtime
requirement of Cucumber 13. Local runs should use Node.js 22, 24, or 26+.

Browser runs use headless mode and two parallel workers. Playwright retries and
failure handling are enabled by the existing configuration when `CI=true`.

If a browser matrix job fails, the workflow keeps running the remaining browser
jobs. Reports, screenshots, videos, Playwright traces, and Playwright HTML
reports are uploaded as artifacts.

## Local CI runner

Run the same runner wrapper locally:

```powershell
npm run test:ci:cucumber -- chromium
npm run test:ci:playwright -- firefox
```

Override the worker count with the `WORKERS` environment variable:

```powershell
$env:WORKERS="4"
npm run test:ci:playwright -- webkit
```
