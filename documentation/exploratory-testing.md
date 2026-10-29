# Exploratory Testing

The Exploratory Testing agent runs a bounded Playwright browser session and reports anomalies without modifying application or test source files.

## Local run

```powershell
npm run test:exploratory -- `
  --url "https://testautomationpractice.blogspot.com/" `
  --browser chromium `
  --max-pages 10 `
  --max-actions 20
```

Reports are written to:

- `test-results/exploratory/exploratory.json`
- `test-results/exploratory/exploratory.md`
- `test-results/exploratory/screenshots/`

## What it checks

- Broken or failed page responses
- JavaScript and console errors
- Failed API, fetch, and resource requests
- Unexpected navigation and dialogs
- Empty pages, empty tables, and failed images
- Horizontal layout overflow
- Potential dead-end workflows
- Form controls missing accessible names or validation context

## Safety bounds

The explorer is intentionally bounded by `--max-pages` and `--max-actions`.

Payment, checkout, purchase, buy, delete, remove, logout, unsubscribe, and close-account controls are blocked by default. Add `--authorize-destructive` only after explicit authorization.

The runner also:

- Keeps navigation scoped to the original origin.
- Dismisses unexpected dialogs.
- Does not enter credentials or secrets.
- Does not submit forms without explicit implementation.
- Reports blocked destructive controls instead of activating them.

## GitHub Actions

`.github/workflows/exploratory-testing.yml` runs weekly or manually. Manual runs accept:

- Target URL
- Browser
- Page limit
- Action limit
- Explicit destructive-action authorization
