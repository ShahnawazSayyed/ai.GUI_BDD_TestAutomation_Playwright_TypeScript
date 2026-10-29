const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  const options = { base: process.env.GITHUB_BASE_SHA || "origin/master", head: "HEAD" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--base" && argv[index + 1]) options.base = argv[++index];
    if (argv[index] === "--head" && argv[index + 1]) options.head = argv[++index];
  }
  return options;
}

function listFiles(directory, extension) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(filePath, extension));
    else if (entry.name.endsWith(extension)) {
      result.push(path.relative(process.cwd(), filePath));
    }
  }
  return result;
}

function toWorkspacePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function gitDiff(base, head) {
  const result = spawnSync("git", ["diff", "--name-only", base, head], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    const fallback = spawnSync("git", ["diff", "--name-only", "HEAD~1", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8"
    });
    if (fallback.status !== 0) {
      throw new Error(result.stderr || fallback.stderr || "Unable to calculate changed files");
    }
    return fallback.stdout.trim().split(/\r?\n/).filter(Boolean);
  }
  return result.stdout.trim().split(/\r?\n/).filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function markdownReport(report) {
  const lines = [
    "## Test Impact Analysis",
    "",
    `**Risk:** ${report.risk}`,
    "",
    "### Changed areas",
    "",
    ...report.changedAreas.map((area) => `- ${area}`),
    "",
    "### Recommended browser matrix",
    "",
    ...report.browsers.map((browser) => `- ${browser}`),
    "",
    "### Priority tests",
    "",
    ...report.priorityTests.length ? report.priorityTests.map((test) => `- ${test}`) : ["- None"],
    "",
    "### Recommended Cucumber scenarios",
    "",
    ...report.recommendedCucumber.length ? report.recommendedCucumber.map((file) => `- \`${file}\``) : ["- None"],
    "",
    "### Recommended Playwright tests",
    "",
    ...report.recommendedPlaywright.length ? report.recommendedPlaywright.map((file) => `- \`${file}\``) : ["- None"],
    "",
    "### Skipped tests",
    "",
    ...report.skippedTests.length ? report.skippedTests.map((test) => `- ${test}`) : ["- None"],
    "",
    "### Reason",
    "",
    report.reason
  ];
  return `${lines.join("\n")}\n`;
}

function analyze(changedFiles) {
  const features = listFiles(path.resolve("features"), ".feature").map(toWorkspacePath);
  const playwrightTests = listFiles(path.resolve("playwright/tests"), ".spec.ts").map(toWorkspacePath);
  const recommendedCucumber = new Set();
  const recommendedPlaywright = new Set();
  const changedAreas = new Set();
  let risk = "low";
  let reason = "Focused test selection based on the changed files.";

  const isHighRisk =
    changedFiles.some((file) =>
      /(^|\/)(package\.json|package-lock\.json|cucumber\.cjs|playwright\.config\.ts|\.github\/workflows\/|cicd\/)/.test(file)
    );
  const isShared =
    changedFiles.some((file) =>
      /(^|\/)(playwright\/support\/|playwright\/config\/|utilities\/|config\/)/.test(file)
    );

  for (const file of changedFiles) {
    if (file.startsWith("features/")) {
      changedAreas.add("BDD features");
      if (features.includes(file)) recommendedCucumber.add(file);
      risk = "medium";
    } else if (file.startsWith("playwright/steps/")) {
      changedAreas.add("Cucumber step definitions");
      features.forEach((feature) => recommendedCucumber.add(feature));
      risk = "medium";
    } else if (file.startsWith("playwright/pages/")) {
      changedAreas.add("Page objects");
      features.forEach((feature) => recommendedCucumber.add(feature));
      playwrightTests.forEach((test) => recommendedPlaywright.add(test));
      risk = "medium";
    } else if (file.startsWith("playwright/tests/")) {
      changedAreas.add("Native Playwright tests");
      recommendedPlaywright.add(file);
      risk = "medium";
    } else if (file.startsWith("playwright/support/") || file.startsWith("playwright/config/")) {
      changedAreas.add("Playwright infrastructure");
      features.forEach((feature) => recommendedCucumber.add(feature));
      playwrightTests.forEach((test) => recommendedPlaywright.add(test));
      risk = "high";
    } else if (file.startsWith("cicd/") || file.startsWith(".github/workflows/")) {
      changedAreas.add("CI/CD quality gates");
      risk = "high";
    } else {
      changedAreas.add(file.includes("/") ? file.split("/")[0] : "Repository");
    }
  }

  if (isHighRisk || isShared || changedFiles.length === 0) {
    features.forEach((feature) => recommendedCucumber.add(feature));
    playwrightTests.forEach((test) => recommendedPlaywright.add(test));
    risk = "high";
    reason = isShared
      ? "Shared framework infrastructure changed; the full browser matrix is recommended."
      : "High-risk or unknown changes require the full browser matrix.";
  }

  const browsers = risk === "low"
    ? ["chromium"]
    : ["chromium", "firefox", "webkit"];
  const priorityTests = [
    ...[...recommendedCucumber].map((file) => `Cucumber: ${file}`),
    ...[...recommendedPlaywright].map((file) => `Playwright: ${file}`)
  ];

  const allTests = [
    ...features.map((file) => `Cucumber: ${file}`),
    ...playwrightTests.map((file) => `Playwright: ${file}`)
  ];
  const selected = new Set(priorityTests);
  const skippedTests = allTests.filter((test) => !selected.has(test));

  return {
    changedFiles,
    changedAreas: [...changedAreas],
    recommendedCucumber: [...recommendedCucumber],
    recommendedPlaywright: [...recommendedPlaywright],
    browsers,
    priorityTests,
    skippedTests,
    risk,
    reason
  };
}

const options = parseArgs(process.argv.slice(2));
const changedFiles = gitDiff(options.base, options.head);
const report = analyze(changedFiles);
const outputDirectory = path.resolve("test-results/test-impact");
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, "impact.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outputDirectory, "impact-report.md"), markdownReport(report));
console.log(markdownReport(report));
