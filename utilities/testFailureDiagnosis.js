const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const evidenceRoots = [
  path.join(root, "test-results"),
  path.join(root, "playwright-report")
];
const classifications = [
  "Locator change",
  "Application regression",
  "Timing issue",
  "Environment problem",
  "Third-party service failure",
  "Flaky test",
  "Infrastructure problem"
];

function parseArgs(argv) {
  const options = { input: "test-results", browser: process.env.BROWSER || "unknown" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--input" && argv[index + 1]) options.input = argv[++index];
    if (argv[index] === "--browser" && argv[index + 1]) options.browser = argv[++index];
  }
  return options;
}

function listFiles(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) listFiles(absolutePath, files);
    else files.push(absolutePath);
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function classify(text, evidenceFiles) {
  const haystack = `${text}\n${evidenceFiles.join("\n")}`.toLowerCase();
  const matches = [];

  const add = (classification, confidence, reasons, proposedFix) => {
    matches.push({ classification, confidence, reasons: [...new Set(reasons)], proposedFix });
  };

  if (/locator|strict mode violation|element.*not found|no element|resolved to \d+ elements|waitforselector|not visible|no node found/.test(haystack)) {
    add("Locator change", 8, ["Missing, changed, or ambiguous element locator detected."], "Use a stable role/label/test-id locator and update the page object or step.");
  }
  if (/timed out|timeout|waiting for|getby.*timeout|tohavetitle|navigation timeout|loadstate/.test(haystack)) {
    add("Timing issue", 7, ["Timeout or delayed readiness detected."], "Replace fixed delays with Playwright expectations and wait for the specific state or element.");
  }
  if (/certificate|err[_-]?name|net::err|dns|connection refused|failed to launch|executable doesn't exist|install.*browser|target closed|page closed/.test(haystack)) {
    add("Environment problem", 8, ["Browser, network, certificate, or executable environment evidence detected."], "Verify browser installation, proxy/TLS settings, network access, and host resources.");
  }
  if (/api|fetch|502|503|504|third-party|cors|certificate|net::err_failed/.test(haystack)) {
    add("Third-party service failure", 7, ["Network/API/third-party dependency evidence detected."], "Verify dependency health, response status, retries, and service credentials; do not change application locators first.");
  }
  if (/expected:|received:|assert|expect\(.*\)|to be|tohave/.test(haystack)) {
    add("Application regression", 7, ["Assertion mismatch indicates application behavior changed."], "Compare the failure screenshot/trace with expected behavior and review the application diff before changing the test.");
  }
  if (/504 gateway|intermittent|flaky|retry|passed on retry|sometimes/.test(haystack)) {
    add("Flaky test", 7, ["Intermittency or retry evidence detected."], "Use event-based expectations, isolate state, and rerun the test before introducing retries.");
  }
  if (/enoent|out of memory|killed|resource temporarily unavailable|disk space|runner|github actions|spawn|browser process/.test(haystack)) {
    add("Infrastructure problem", 8, ["Runner process, resource, or infrastructure evidence detected."], "Check runner logs, disk/memory limits, browser process lifecycle, and dependency installation.");
  }

  matches.sort((left, right) => right.confidence - left.confidence);
  if (matches.length === 0) {
    return {
      classification: "Environment problem",
      confidence: 3,
      reasons: ["No specific failure signature was found in the available evidence."],
      proposedFix: "Inspect the trace, screenshot, video, and stack manually; collect a JSON/text failure report."
    };
  }
  return matches[0];
}

function unique(values) {
  return [...new Set(values)];
}

const options = parseArgs(process.argv.slice(2));
const inputDirectory = path.resolve(root, options.input);
const evidenceFiles = evidenceRoots.flatMap((directory) =>
  directory === inputDirectory ? [] : listFiles(directory)
);
evidenceFiles.push(...listFiles(inputDirectory));

const textExtensions = new Set([".log", ".txt", ".json", ".html", ".md", ".xml", ".trace"]);
const textualEvidence = evidenceFiles
  .filter((file) => textExtensions.has(path.extname(file).toLowerCase()))
  .map((file) => {
    try {
      return { file: relative(file), content: fs.readFileSync(file, "utf8").slice(0, 500_000) };
    } catch {
      return { file: relative(file), content: "" };
    }
  });

const text = textualEvidence.map((item) => `${item.file}\n${item.content}`).join("\n");
const evidence = {
  traces: evidenceFiles.filter((file) => /\.zip$/i.test(file) || /trace/i.test(file)).map(relative),
  screenshots: evidenceFiles.filter((file) => /\.(png|jpg|jpeg)$/i.test(file)).map(relative),
  videos: evidenceFiles.filter((file) => /\.(webm|mp4)$/i.test(file)).map(relative),
  consoleLogs: evidenceFiles.filter((file) => /console|\.log$/i.test(file)).map(relative),
  reports: evidenceFiles.filter((file) => /\.(html|json|xml)$/i.test(file)).map(relative),
  stacks: textualEvidence.filter((item) =>
    /error|exception|stack|\n\s*at\s/i.test(item.content)
  ).map((item) => item.file)
};

const diagnosis = classify(text, evidenceFiles.map(relative));
const failureIndicators = [
  ...textualEvidence
    .filter((item) => /failed|failure|error|timeout|expect/i.test(item.content))
    .slice(0, 30)
    .map((item) => item.file)
];

const report = {
  generatedAt: new Date().toISOString(),
  browser: options.browser,
  classification: diagnosis.classification,
  confidence: diagnosis.confidence / 10,
  reasons: diagnosis.reasons,
  proposedFix: diagnosis.proposedFix,
  failureIndicators: unique(failureIndicators),
  evidence,
  allowedClassifications: classifications
};

function markdown() {
  const evidenceSection = (title, files) => [
    `### ${title}`,
    "",
    files.length ? files.map((file) => `- \`${file}\``).join("\n") : "- None available",
    ""
  ];
  return [
    "# Test Failure Diagnosis",
    "",
    `- **Generated:** ${report.generatedAt}`,
    `- **Browser:** ${report.browser}`,
    `- **Classification:** ${report.classification}`,
    `- **Confidence:** ${diagnosis.confidence}/10`,
    "",
    "## Reasons",
    "",
    ...report.reasons.map((reason) => `- ${reason}`),
    "",
    "## Proposed smallest fix",
    "",
    report.proposedFix,
    "",
    ...evidenceSection("Traces", evidence.traces),
    ...evidenceSection("Screenshots", evidence.screenshots),
    ...evidenceSection("Videos", evidence.videos),
    ...evidenceSection("Console logs", evidence.consoleLogs),
    ...evidenceSection("Reports", evidence.reports),
    ...evidenceSection("Stack evidence", evidence.stacks),
    "## Guardrail",
    "",
    "Review the proposed fix against the trace and code diff. This report provides an evidence-based hypothesis, not an automatic application fix."
  ].join("\n");
}

const outputDirectory = path.resolve(root, "test-results/failure-diagnosis");
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, "diagnosis.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outputDirectory, "diagnosis.md"), markdown());
console.log(markdown());
