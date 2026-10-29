const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();

function parseArgs(argv) {
  const options = {
    url: process.env.DEPLOYMENT_URL || process.env.BASE_URL,
    maxPages: 10,
    browser: process.env.BROWSER || "chromium",
    base: process.env.GITHUB_BASE_SHA || "origin/master",
    head: process.env.GITHUB_HEAD_SHA || "HEAD",
    incidents: "",
    approve: false,
    maxApproved: 10
  };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--url" && argv[index + 1]) options.url = argv[++index];
    if (argv[index] === "--max-pages" && argv[index + 1]) options.maxPages = Number(argv[++index]);
    if (argv[index] === "--browser" && argv[index + 1]) options.browser = argv[++index].toLowerCase();
    if (argv[index] === "--base" && argv[index + 1]) options.base = argv[++index];
    if (argv[index] === "--head" && argv[index + 1]) options.head = argv[++index];
    if (argv[index] === "--incidents" && argv[index + 1]) options.incidents = argv[++index];
    if (argv[index] === "--approve") options.approve = true;
    if (argv[index] === "--max-approved" && argv[index + 1]) options.maxApproved = Number(argv[++index]);
  }
  if (!Number.isInteger(options.maxPages) || options.maxPages < 1) {
    throw new Error("--max-pages must be a positive integer.");
  }
  if (!Number.isInteger(options.maxApproved) || options.maxApproved < 1) {
    throw new Error("--max-approved must be a positive integer.");
  }
  return options;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function listFiles(directory, extension) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(absolutePath, extension));
    else if (entry.name.endsWith(extension)) files.push(absolutePath);
  }
  return files;
}

function workspacePath(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function gitChangedFiles(base, head) {
  const result = spawnSync("git", ["diff", "--name-only", base, head], {
    cwd: root,
    encoding: "utf8"
  });
  if (result.status === 0) {
    return result.stdout.trim().split(/\r?\n/).filter(Boolean);
  }
  const fallback = spawnSync("git", ["diff", "--name-only", "HEAD~1", "HEAD"], {
    cwd: root,
    encoding: "utf8"
  });
  if (fallback.status !== 0) return [];
  return fallback.stdout.trim().split(/\r?\n/).filter(Boolean);
}

function loadDiscovery(options) {
  const discoveryPath = path.resolve(root, "test-results/test-discovery/discovery.json");
  if (options.url) {
    const result = spawnSync(process.execPath, [
      path.resolve(root, "utilities/testDiscovery.js"),
      "--url", options.url,
      "--max-pages", String(options.maxPages),
      "--browser", options.browser
    ], { cwd: root, encoding: "utf8", env: process.env });
    if (result.status !== 0) {
      console.error(result.stderr || result.stdout || "Website discovery failed.");
    }
  }
  if (!fs.existsSync(discoveryPath)) return { target: options.url || "", pages: [], candidates: [] };
  try {
    return JSON.parse(fs.readFileSync(discoveryPath, "utf8"));
  } catch {
    return { target: options.url || "", pages: [], candidates: [] };
  }
}

function loadIncidents(filePath) {
  if (!filePath) return [];
  const absolutePath = path.resolve(root, filePath);
  if (!fs.existsSync(absolutePath)) return [];
  try {
    const value = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
    if (Array.isArray(value)) return value;
    if (Array.isArray(value.incidents)) return value.incidents;
    if (value.classification) return [{ ...value, title: value.classification }];
    return [];
  } catch {
    return fs.readFileSync(absolutePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return { title: line, priority: "medium" }; }
      });
  }
}

function candidateCovered(candidate, coverageText) {
  const text = normalize(coverageText);
  const url = normalize(candidate.pageUrl || candidate.url || "");
  const name = normalize(candidate.name || candidate.title || candidate.journey || "");
  const steps = normalize((candidate.steps || []).join(" "));
  const labels = normalize(candidate.labels || candidate.reasons || "");

  if (url && text.includes(url)) return true;
  const terms = [...new Set(`${name} ${steps} ${labels}`.split(" ").filter((term) => term.length >= 5))];
  if (terms.length === 0) return false;
  const matched = terms.filter((term) => text.includes(term)).length;
  return matched / terms.length >= 0.55;
}

function findReusableStep(candidate, stepText) {
  const neededSteps = candidate.steps || [];
  const reusable = [];
  const missing = [];

  for (const step of neededSteps) {
    const normalizedStep = normalize(step);
    const hasStep = Object.keys(stepText).some((file) =>
      normalize(stepText[file]).includes(normalizedStep.split(" ").slice(-2).join(" "))
    );
    if (hasStep || normalizedStep.startsWith("given i navigate") || normalizedStep.startsWith("then the page title")) {
      reusable.push(step);
    } else {
      missing.push(step);
    }
  }
  return { reusable, missing };
}

function priorityScore(source, priority) {
  const sourceScore = source === "Production incident" ? 45 : source === "Branch or PR change" ? 35 : 20;
  const priorityScoreMap = { critical: 40, high: 30, medium: 20, low: 10 };
  return Math.min(100, sourceScore + (priorityScoreMap[priority] || 20));
}

function buildReport(options) {
  const featureFiles = listFiles(path.resolve(root, "features"), ".feature");
  const stepFiles = listFiles(path.resolve(root, "playwright/steps"), ".ts")
    .concat(listFiles(path.resolve(root, "playwright/tests"), ".ts"));
  const featureText = featureFiles.map((file) => `${workspacePath(file)}\n${fs.readFileSync(file, "utf8")}`).join("\n");
  const stepText = Object.fromEntries(stepFiles.map((file) => [
    workspacePath(file),
    fs.readFileSync(file, "utf8")
  ]));

  const discovery = loadDiscovery(options);
  const changedFiles = gitChangedFiles(options.base, options.head);
  const incidents = loadIncidents(options.incidents);
  const candidates = [];

  for (const candidate of discovery.candidates || []) {
    const existingCoverage = `${featureText}\n${Object.values(stepText).join("\n")}`;
    candidates.push({
      source: "Discovered website",
      name: candidate.name,
      type: candidate.type || "discovered",
      pageUrl: candidate.pageUrl || "",
      priority: candidate.type === "smoke" ? "high" : candidate.type === "controls" ? "medium" : "low",
      steps: candidate.steps || [],
      reason: "Discovered control or journey is not explicitly represented by existing Gherkin or step definitions.",
      covered: candidateCovered(candidate, existingCoverage)
    });
  }

  for (const file of changedFiles) {
    if (!/playwright\/(pages|steps|support|tests)\//.test(file) && !/^features\//.test(file)) continue;
    if (candidateCovered({ name: file, pageUrl: "" }, featureText)) continue;
    candidates.push({
      source: "Branch or PR change",
      name: `Validate changed coverage for ${file}`,
      type: "change-impact",
      pageUrl: "",
      priority: /^playwright\/support|^playwright\/pages/.test(file) ? "high" : "medium",
      steps: ["Given I navigate to the affected application area", "Then the changed behavior should match the approved requirement"],
      reason: "The changed application or test area has no matching feature scenario.",
      covered: false
    });
  }

  for (const incident of incidents) {
    const candidate = {
      source: "Production incident",
      name: incident.title || incident.name || incident.journey || "Production user journey",
      type: incident.type || "incident",
      pageUrl: incident.pageUrl || incident.url || "",
      priority: String(incident.priority || incident.severity || "high").toLowerCase(),
      labels: incident.labels || incident.reason || incident.description || "",
      steps: incident.steps || [
        `Given I navigate to "${incident.pageUrl || incident.url || options.url || ""}"`,
        `Then the user journey "${incident.title || incident.name || "affected journey"}" should complete safely`
      ],
      reason: "A production incident or recorded user journey has no explicit regression scenario.",
      covered: false
    };
    candidate.covered = candidateCovered(candidate, `${featureText}\n${Object.values(stepText).join("\n")}`);
    candidates.push(candidate);
  }

  const gaps = candidates
    .filter((candidate) => !candidate.covered)
    .map((candidate) => {
      const implementation = findReusableStep(candidate, stepText);
      return {
        ...candidate,
        score: priorityScore(candidate.source, candidate.priority),
        reusableSteps: implementation.reusable,
        missingSteps: implementation.missing
      };
    })
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

  const approved = options.approve
    ? gaps
        .filter((candidate) =>
          candidate.type !== "change-impact" &&
          candidate.missingSteps.length === 0 &&
          ["critical", "high", "medium"].includes(candidate.priority)
        )
        .slice(0, options.maxApproved)
    : [];

  return {
    generatedAt: new Date().toISOString(),
    target: discovery.target || options.url || "",
    browser: options.browser,
    approvalRequired: true,
    approvedRequested: options.approve,
    discoveredPages: (discovery.pages || []).length,
    discoveredControls: (discovery.pages || []).reduce((count, page) => count + (page.elements || []).length, 0),
    existingFeatures: featureFiles.map(workspacePath),
    existingStepDefinitions: stepFiles.map(workspacePath),
    changedFiles,
    incidentsAnalyzed: incidents.length,
    gaps,
    approved,
    totals: {
      discoveredCandidates: (discovery.candidates || []).length,
      branchCandidates: gaps.filter((gap) => gap.source === "Branch or PR change").length,
      incidentCandidates: gaps.filter((gap) => gap.source === "Production incident").length
    }
  };
}

function writeApprovedFeature(approved) {
  if (approved.length === 0) return "";
  const outputDirectory = path.resolve(root, "features");
  fs.mkdirSync(outputDirectory, { recursive: true });
  const outputFile = path.join(outputDirectory, "coverage-gaps.generated.feature");
  const lines = ["Feature: Approved coverage gaps", ""];
  for (const gap of approved) {
    lines.push(`  Scenario: ${gap.name.replace(/\s+/g, " ").trim()}`);
    const steps = gap.steps.length > 0
      ? gap.steps
      : [
          `Given I navigate to "${gap.pageUrl || ""}"`,
          "Then the approved behavior should be verified"
        ];
    for (const step of steps) lines.push(`    ${step}`);
    lines.push("");
  }
  fs.writeFileSync(outputFile, `${lines.join("\n").trim()}\n`);
  return workspacePath(outputFile);
}

function markdown(report, approvedFeature) {
  const lines = [
    "# Coverage Gap Analysis",
    "",
    `- **Generated:** ${report.generatedAt}`,
    `- **Target:** ${report.target || "Not provided"}`,
    `- **Discovered pages:** ${report.discoveredPages}`,
    `- **Discovered controls:** ${report.discoveredControls}`,
    `- **Changed files analyzed:** ${report.changedFiles.length}`,
    `- **Production incidents analyzed:** ${report.incidentsAnalyzed}`,
    `- **Gaps found:** ${report.gaps.length}`,
    "",
    "## Prioritized gaps",
    ""
  ];
  if (report.gaps.length === 0) {
    lines.push("No missing coverage gaps were identified.");
  } else {
    for (const gap of report.gaps) {
      lines.push(
        `### ${gap.name}`,
        "",
        `- Priority: **${gap.priority}**`,
        `- Score: **${gap.score}/100**`,
        `- Source: ${gap.source}`,
        `- Reason: ${gap.reason}`,
        `- Reusable steps: ${gap.reusableSteps.length || "None detected"}`,
        `- Missing steps: ${gap.missingSteps.length || "None detected"}`,
        ""
      );
    }
  }
  lines.push(
    "## Approved test creation",
    "",
    approvedFeature
      ? `Created: \`${approvedFeature}\``
      : report.approvedRequested
        ? "Approval was requested, but no gap had a complete reusable-step implementation and was safe to create."
        : "No feature file created. Approval was not granted."
  );
  return `${lines.join("\n")}\n`;
}

const options = parseArgs(process.argv.slice(2));
const report = buildReport(options);
const approvedFeature = writeApprovedFeature(report.approved);
const outputDirectory = path.resolve(root, "test-results/coverage-gaps");
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, "coverage-gaps.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outputDirectory, "coverage-gaps.md"), markdown(report, approvedFeature));
console.log(markdown(report, approvedFeature));
console.log(`\nReport: test-results/coverage-gaps/coverage-gaps.md`);
