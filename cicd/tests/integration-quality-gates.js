const { URL } = require("node:url");

const deploymentUrl = process.env.DEPLOYMENT_URL ||
  process.env.BASE_URL ||
  "https://testautomationpractice.blogspot.com/";
if (!deploymentUrl) {
  console.error("DEPLOYMENT_URL or BASE_URL is required for the integration gate.");
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(deploymentUrl);
} catch {
  console.error(`Invalid deployment URL: ${deploymentUrl}`);
  process.exit(1);
}

if (!["http:", "https:"].includes(parsedUrl.protocol)) {
  console.error("DEPLOYMENT_URL must use http or https.");
  process.exit(1);
}

async function runIntegrationGate() {
  const timeout = Number(process.env.INTEGRATION_TIMEOUT_MS || "30000");
  const response = await fetch(parsedUrl.toString(), {
    signal: AbortSignal.timeout(timeout),
    headers: { "user-agent": "github-actions-integration-quality-gate" }
  });

  if (!response.ok) {
    throw new Error(`Integration endpoint returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();
  const expectedText = process.env.EXPECTED_TEXT;
  const expectedTitle = process.env.EXPECTED_TITLE;

  if (expectedText && !body.includes(expectedText)) {
    throw new Error(`Integration response does not contain "${expectedText}"`);
  }

  if (expectedTitle) {
    const titleMatch = body.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (!titleMatch || titleMatch[1].trim() !== expectedTitle) {
      throw new Error(`Expected page title "${expectedTitle}"`);
    }
  }

  console.log(
    `Integration gate passed: ${parsedUrl.toString()} returned HTTP ${response.status}` +
    (contentType ? ` (${contentType})` : "")
  );
}

runIntegrationGate().catch((error) => {
  console.error(`Integration quality gate failed: ${error.message}`);
  process.exit(1);
});
