const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");

test("package scripts include CI browser runners", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "package.json"), "utf8")
  );

  assert.equal(typeof packageJson.scripts["test:ci:cucumber"], "string");
  assert.equal(typeof packageJson.scripts["test:ci:playwright"], "string");
  assert.equal(typeof packageJson.scripts["test:ci:quality-gates"], "string");
});

test("CI runner supports only configured browsers", () => {
  const runner = fs.readFileSync(
    path.join(projectRoot, "cicd/run-tests.js"),
    "utf8"
  );

  for (const browser of ["chromium", "firefox", "webkit"]) {
    assert.match(runner, new RegExp(browser));
  }
  assert.match(runner, /const workers = "1"/);
});

test("common browser configuration has valid shape", () => {
  const config = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "config/commonConfig.json"), "utf8")
  );

  assert.ok(config.BROWSER_PROPERTIES);
  assert.ok(config.EVIDENCE_PROPERTIES);
  assert.match(
    config.BROWSER_PROPERTIES.WINDOW_SIZE,
    /^\d+\s*,\s*\d+$/
  );
});

test("GitHub Actions workflow has cross-browser quality gates", () => {
  const workflow = fs.readFileSync(
    path.join(projectRoot, ".github/workflows/ci.yml"),
    "utf8"
  );

  assert.match(workflow, /node-version:\s*24/);
  assert.match(workflow, /test:ci:quality-gates/);
  assert.match(workflow, /browser:\s*\[chromium,\s*firefox,\s*webkit\]/);
});

test("CD workflow has a deployment URL fallback", () => {
  const workflow = fs.readFileSync(
    path.join(projectRoot, ".github/workflows/cd.yml"),
    "utf8"
  );

  assert.match(workflow, /DEPLOYMENT_URL/);
  assert.match(workflow, /DEFAULT_URL:\s*https:\/\/testautomationpractice\.blogspot\.com\//);
  assert.match(workflow, /test:ci:integration/);
});

test("test discovery agent and module are configured", () => {
  const agent = fs.readFileSync(
    path.join(projectRoot, ".github/agents/test-discovery.agent.md"),
    "utf8"
  );
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "package.json"), "utf8")
  );

  assert.match(agent, /^description:\s*"/m);
  assert.match(agent, /features\/\*\*\/\*\.feature/);
  assert.equal(typeof packageJson.scripts["test:discover"], "string");
  assert.ok(fs.existsSync(path.join(projectRoot, "utilities/testDiscovery.js")));
});

test("test impact agent and workflow are configured", () => {
  const agent = fs.readFileSync(
    path.join(projectRoot, ".github/agents/test-impact.agent.md"),
    "utf8"
  );
  const workflow = fs.readFileSync(
    path.join(projectRoot, ".github/workflows/test-impact.yml"),
    "utf8"
  );
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "package.json"), "utf8")
  );

  assert.match(agent, /description:\s*"/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /fromJSON\(needs\.analyze\.outputs\.browsers\)/);
  assert.match(workflow, /test-impact-report/);
  assert.equal(typeof packageJson.scripts["test:impact"], "string");
});

test("failure diagnosis agent and module are configured", () => {
  const agent = fs.readFileSync(
    path.join(projectRoot, ".github/agents/test-failure-diagnosis.agent.md"),
    "utf8"
  );
  const workflow = fs.readFileSync(
    path.join(projectRoot, ".github/workflows/ci.yml"),
    "utf8"
  );
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "package.json"), "utf8")
  );

  assert.match(agent, /Locator change/);
  assert.match(agent, /Application regression/);
  assert.match(workflow, /Diagnose .* failure evidence/);
  assert.equal(typeof packageJson.scripts["test:diagnose"], "string");
  assert.ok(fs.existsSync(path.join(projectRoot, "utilities/testFailureDiagnosis.js")));
});
