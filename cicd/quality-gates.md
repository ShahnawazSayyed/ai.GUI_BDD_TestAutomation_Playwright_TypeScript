# CI and CD Quality Gates

## CI quality gates

CI runs unit and integration checks before browser matrix jobs:

```powershell
npm run test:ci:quality-gates
```

Unit checks use Node's built-in test runner:

```powershell
npm run test:ci:unit
```

The integration check performs an HTTP response check against a deployment or
test target:

```powershell
$env:BASE_URL="https://testautomationpractice.blogspot.com/"
$env:EXPECTED_TITLE="Automation Testing Practice"
npm run test:ci:integration
```

## CD quality gate

`cd.yml` runs after successful `Cross-Browser CI` workflow runs on `main`, and
also supports manual dispatch.

Configure the deployed environment URL with a repository variable named
`DEPLOYMENT_URL`. Optional repository variables:

- `EXPECTED_TEXT`: required text in the deployed response body
- `EXPECTED_TITLE`: exact HTML title

The manual workflow requires a deployment URL and accepts an environment name.
The same integration gate script checks the final HTTP status, response body,
and optional title or text expectations.

## Unit and integration locations

- Unit: `cicd/tests/unit-quality-gates.test.js`
- Integration: `cicd/tests/integration-quality-gates.js`
- CI/CD runner support: `cicd/run-tests.js`
