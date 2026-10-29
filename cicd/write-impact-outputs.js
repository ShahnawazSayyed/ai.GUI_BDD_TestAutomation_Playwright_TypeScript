const fs = require("node:fs");

const reportPath = process.argv[2] || "test-results/test-impact/impact.json";
const githubOutput = process.env.GITHUB_OUTPUT;

if (!githubOutput) {
  throw new Error("GITHUB_OUTPUT is required to publish impact-analysis outputs.");
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const browsers = Array.isArray(report.browsers) ? report.browsers : [];
const cucumberFiles = Array.isArray(report.recommendedCucumber) ? report.recommendedCucumber : [];
const playwrightFiles = Array.isArray(report.recommendedPlaywright) ? report.recommendedPlaywright : [];

const outputs = [
  "browsers=" + JSON.stringify(browsers),
  "cucumberFiles=" + cucumberFiles.join(";"),
  "playwrightFiles=" + playwrightFiles.join(";")
].join("\n") + "\n";

fs.appendFileSync(githubOutput, outputs);
