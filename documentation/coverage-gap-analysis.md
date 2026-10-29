# Coverage Gap Analysis

The Coverage Gap agent compares discovered website behavior with existing automated coverage, branch or pull-request changes, and production incident journeys.

## Run locally

```powershell
npm run test:coverage-gaps -- `
  --url "https://testautomationpractice.blogspot.com/" `
  --browser chromium `
  --max-pages 10 `
  --base origin/master `
  --head HEAD
```

Reports are written to:

- `test-results/coverage-gaps/coverage-gaps.json`
- `test-results/coverage-gaps/coverage-gaps.md`

The command never modifies a feature file by default.

## Production incidents or user journeys

Pass a JSON array, JSON object containing an `incidents` array, or JSON Lines file:

```json
[
  {
    "title": "Complete the contact form",
    "pageUrl": "https://example.test/contact",
    "priority": "critical",
    "steps": [
      "Given I navigate to \"https://example.test/contact\"",
      "Then the contact form should be displayed"
    ]
  }
]
```

```powershell
npm run test:coverage-gaps -- `
  --url "https://example.test/" `
  --incidents "path/to/incidents.json"
```

## Approved feature creation

Feature creation requires explicit approval. The following command creates at most ten concrete discovered or incident gaps in a dedicated generated file:

```powershell
npm run test:coverage-gaps -- `
  --url "https://testautomationpractice.blogspot.com/" `
  --approve `
  --max-approved 10
```

Approved output is written only to:

```text
features/coverage-gaps.generated.feature
```

Generic branch-change placeholders are reported but are not promoted to generated feature files. Review generated scenarios and implement missing reusable steps before running them.

## Periodic GitHub Actions workflow

`.github/workflows/coverage-gap.yml` runs weekly and supports manual dispatch.

- Scheduled runs generate reports only.
- Manual runs can enable `create_approved_tests`.
- When enabled, the workflow opens a pull request containing the generated feature file.
- The pull request must be reviewed; no generated test is automatically merged.
