const { chromium, firefox, webkit } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();

function parseArgs(argv) {
  const options = {
    url: process.env.DEPLOYMENT_URL || process.env.BASE_URL,
    browser: process.env.BROWSER || "chromium",
    maxPages: 10,
    maxActions: 20,
    authorizeDestructive: false,
    timeoutMs: 45_000
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--url" && argv[index + 1]) options.url = argv[++index];
    if (argv[index] === "--browser" && argv[index + 1]) options.browser = argv[++index].toLowerCase();
    if (argv[index] === "--max-pages" && argv[index + 1]) options.maxPages = Number(argv[++index]);
    if (argv[index] === "--max-actions" && argv[index + 1]) options.maxActions = Number(argv[++index]);
    if (argv[index] === "--authorize-destructive") options.authorizeDestructive = true;
    if (argv[index] === "--timeout-ms" && argv[index + 1]) options.timeoutMs = Number(argv[++index]);
  }
  if (!options.url) throw new Error("A URL is required. Use --url or set DEPLOYMENT_URL/BASE_URL.");
  if (!["chromium", "firefox", "webkit"].includes(options.browser)) {
    throw new Error("--browser must be chromium, firefox, or webkit.");
  }
  for (const [name, value] of [["--max-pages", options.maxPages], ["--max-actions", options.maxActions], ["--timeout-ms", options.timeoutMs]]) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  }
  return options;
}

const destructivePattern = /\b(payment|pay now|checkout|purchase|buy now|delete|remove|destroy|logout|log out|sign out|cancel subscription|unsubscribe|close account)\b/i;

function isDestructive(element) {
  const metadata = [
    element.text,
    element.ariaLabel,
    element.title,
    element.name,
    element.id,
    element.href
  ].join(" ");
  return destructivePattern.test(metadata);
}

function safeSlug(value) {
  return String(value).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "page";
}

function addFinding(findings, category, severity, url, detail, evidence = {}) {
  findings.push({
    category,
    severity,
    url,
    detail,
    evidence,
    timestamp: new Date().toISOString()
  });
}

async function collectPage(page) {
  return page.evaluate(() => {
    const width = window.innerWidth || document.documentElement.clientWidth;
    const scrollWidth = Math.max(document.body?.scrollWidth || 0, document.documentElement?.scrollWidth || 0);
    const elements = [...document.querySelectorAll(
      "a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=link]"
    )].slice(0, 250).map((element, index) => {
      const rect = element.getBoundingClientRect();
      return {
        index,
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute("type") || "",
        text: (element.innerText || element.value || "").trim().slice(0, 160),
        ariaLabel: element.getAttribute("aria-label")?.trim() || "",
        title: element.getAttribute("title")?.trim() || "",
        name: element.getAttribute("name")?.trim() || "",
        id: element.getAttribute("id")?.trim() || "",
        href: element.getAttribute("href") || "",
        disabled: element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true",
        required: element.hasAttribute("required"),
        visible: rect.width > 0 && rect.height > 0,
        role: element.getAttribute("role") ||
          (element.tagName.toLowerCase() === "button" ? "button" :
            element.tagName.toLowerCase() === "a" ? "link" :
              element.tagName.toLowerCase() === "select" ? "combobox" : "control")
      };
    });

    const text = document.body?.innerText?.replace(/\s+/g, " ").trim() || "";
    const emptyTables = [...document.querySelectorAll("table")].filter((table) =>
      table.querySelectorAll("tbody tr, tr").length === 0 ||
      (table.textContent || "").trim().length === 0
    ).length;
    const brokenImages = [...document.querySelectorAll("img")].filter((image) =>
      !image.complete || image.naturalWidth === 0
    ).map((image) => image.getAttribute("src") || "");

    return {
      title: document.title,
      textLength: text.length,
      overflowPx: Math.max(0, scrollWidth - width),
      elements,
      emptyTables,
      brokenImages,
      inputs: [...document.querySelectorAll("input:not([type=hidden]), textarea, select")].map((element) => ({
        name: element.getAttribute("name") || "",
        type: element.getAttribute("type") || "",
        required: element.hasAttribute("required"),
        ariaLabel: element.getAttribute("aria-label") || "",
        placeholder: element.getAttribute("placeholder") || ""
      }))
    };
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const start = new URL(options.url);
  const browserType = { chromium, firefox, webkit }[options.browser];
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.setDefaultTimeout(Math.min(options.timeoutMs, 30_000));

  const findings = [];
  const visited = new Set();
  const queue = [start.toString()];
  const linkSources = new Map();
  const visitedScreenshots = [];
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  let actions = 0;
  let blockedDestructiveActions = 0;

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push({
      url: page.url(),
      text: message.text()
    });
  });
  page.on("pageerror", (error) => {
    pageErrors.push({ url: page.url(), text: error.message });
  });
  page.on("requestfailed", (request) => {
    const resource = request.resourceType();
    if (["xhr", "fetch", "document", "script"].includes(resource)) {
      failedRequests.push({
        url: request.url(),
        resource,
        error: request.failure()?.errorText || "Request failed"
      });
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && ["xhr", "fetch", "document"].includes(response.request().resourceType())) {
      failedRequests.push({
        url: response.url(),
        resource: response.request().resourceType(),
        status: response.status()
      });
    }
  });
  page.on("dialog", async (dialog) => {
    addFinding(findings, "Unexpected dialog", "medium", page.url(), dialog.message(), { type: dialog.type() });
    await dialog.dismiss();
  });

  try {
    while (queue.length > 0 && visited.size < options.maxPages) {
      const currentUrl = queue.shift();
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);
      let pageData;

      try {
        const response = await page.goto(currentUrl, { waitUntil: "domcontentloaded", timeout: options.timeoutMs });
        pageData = await collectPage(page);

        if (response && response.status() >= 400) {
          addFinding(
            findings,
            linkSources.has(currentUrl) ? "Broken link" : "Broken page response",
            "high",
            currentUrl,
            `HTTP ${response.status()} returned.`,
            { status: response.status(), sourceUrl: linkSources.get(currentUrl) || null }
          );
        }
        if (pageData.textLength === 0) {
          addFinding(findings, "Empty page", "medium", currentUrl, "The page has no visible body text.");
        }
        if (pageData.emptyTables > 0) {
          addFinding(findings, "Malformed or empty data", "medium", currentUrl, `${pageData.emptyTables} empty table(s) found.`);
        }
        if (pageData.brokenImages.length > 0) {
          addFinding(findings, "Malformed or empty data", "medium", currentUrl, "One or more images failed to load.", { images: pageData.brokenImages.slice(0, 20) });
        }
        if (pageData.overflowPx > 1) {
          addFinding(findings, "Layout overflow", "medium", currentUrl, `Horizontal overflow measured at ${pageData.overflowPx}px.`);
        }
        if (pageData.inputs.some((input) => input.required && !input.name && !input.ariaLabel && !input.placeholder)) {
          addFinding(findings, "Form validation defect", "medium", currentUrl, "A required form control has no accessible name, name, or placeholder.");
        }

        const screenshotDirectory = path.resolve(root, "test-results/exploratory/screenshots");
        fs.mkdirSync(screenshotDirectory, { recursive: true });
        const screenshot = path.join(screenshotDirectory, `${visited.size}-${safeSlug(pageData.title || new URL(currentUrl).pathname)}.png`);
        await page.screenshot({ path: screenshot, fullPage: true });
        visitedScreenshots.push(path.relative(root, screenshot).split(path.sep).join("/"));

        for (const element of pageData.elements) {
          if (!element.href || element.role !== "link" || element.disabled) continue;
          try {
            const target = new URL(element.href, currentUrl);
            if (target.origin !== start.origin || visited.has(target.toString())) continue;
            if (isDestructive(element) && !options.authorizeDestructive) {
              blockedDestructiveActions += 1;
              continue;
            }
            linkSources.set(target.toString(), currentUrl);
            queue.push(target.toString());
          } catch {
            // Ignore malformed or non-URL links.
          }
        }

        const forms = await page.locator("form").count();
        if (forms > 0 && pageData.inputs.length > 0) {
          const noSubmit = await page.locator("form button[type=submit], form input[type=submit]").count() === 0;
          if (noSubmit) {
            addFinding(findings, "Dead-end workflow", "medium", currentUrl, "A form has controls but no visible submit action.");
          }
        }

        if (actions < options.maxActions) {
          for (const element of pageData.elements) {
            if (actions >= options.maxActions) break;
            if (!element.visible || element.disabled || element.tag !== "button" && element.role !== "button") continue;
            const metadata = `${element.text} ${element.ariaLabel} ${element.title}`;
            if (destructivePattern.test(metadata) && !options.authorizeDestructive) {
              blockedDestructiveActions += 1;
              continue;
            }
            if (/submit|save|apply|search|continue|next|show|open/i.test(metadata)) {
              actions += 1;
              try {
                await page.getByRole("button", { name: new RegExp(metadata.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })
                  .first()
                  .click({ timeout: 3_000 });
                await page.waitForLoadState("domcontentloaded", { timeout: 3_000 }).catch(() => {});
                const before = currentUrl;
                const after = page.url();
                if (before !== after && !visited.has(after) && queue.length < options.maxPages) queue.push(after);
                if (after !== before) {
                  addFinding(findings, "Unexpected navigation", "low", before, "A safe action navigated to a new URL.", { from: before, to: after });
                }
              } catch (error) {
                addFinding(findings, "Dead-end workflow", "low", currentUrl, "A safe-looking button could not be activated.", { error: error.message });
              }
            }
          }
        }
      } catch (error) {
        addFinding(findings, "Environment or navigation failure", "high", currentUrl, error.message);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  for (const entry of consoleErrors) {
    addFinding(findings, "Console error", "medium", entry.url, entry.text);
  }
  for (const entry of pageErrors) {
    addFinding(findings, "JavaScript error", "high", entry.url, entry.text);
  }
  const uniqueRequests = new Map();
  for (const entry of failedRequests) {
    const key = `${entry.url}|${entry.status || entry.error || ""}`;
    uniqueRequests.set(key, entry);
  }
  for (const entry of uniqueRequests.values()) {
    addFinding(findings, "Failed API or resource request", "high", entry.url, entry.status ? `HTTP ${entry.status}` : entry.error, entry);
  }

  const linkFindings = findings.filter((finding) => finding.category === "Broken page response" || finding.category === "Broken link");
  for (const finding of linkFindings) {
    if (!finding.detail) continue;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    target: start.toString(),
    browser: options.browser,
    bounds: {
      maxPages: options.maxPages,
      maxActions: options.maxActions,
      destructiveActionsAuthorized: options.authorizeDestructive
    },
    totals: {
      pagesVisited: visited.size,
      actionsAttempted: actions,
      blockedDestructiveActions,
      findings: findings.length
    },
    blockedActions: blockedDestructiveActions > 0
      ? [`Stopped before ${blockedDestructiveActions} destructive action(s).`]
      : [],
    screenshots: visitedScreenshots,
    findings
  };

  const categories = [...new Set(findings.map((finding) => finding.category))];
  const lines = [
    "# Exploratory Testing Report",
    "",
    `- **Generated:** ${report.generatedAt}`,
    `- **Target:** ${report.target}`,
    `- **Browser:** ${report.browser}`,
    `- **Pages visited:** ${visited.size}/${options.maxPages}`,
    `- **Actions attempted:** ${actions}/${options.maxActions}`,
    `- **Blocked destructive actions:** ${blockedDestructiveActions}`,
    "",
    "## Findings",
    ""
  ];
  if (findings.length === 0) {
    lines.push("No anomalies were detected within the configured bounds.");
  } else {
    for (const finding of findings.sort((left, right) => String(left.category).localeCompare(String(right.category)))) {
      lines.push(`### ${finding.category}`, "", `- Severity: **${finding.severity}**`, `- URL: ${finding.url}`, `- Detail: ${finding.detail}`, "");
    }
  }
  lines.push(
    "## Stop conditions",
    "",
    "- Payment, checkout, purchase, buy, delete, remove, logout, unsubscribe, and close-account controls are blocked by default.",
    "- Destructive actions require `--authorize-destructive` and explicit human authorization.",
    "- No authentication secrets are collected or persisted.",
    "",
    `## Detected categories`,
    "",
    ...(categories.length ? categories.map((category) => `- ${category}`) : ["- None"])
  );

  const outputDirectory = path.resolve(root, "test-results/exploratory");
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, "exploratory.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outputDirectory, "exploratory.md"), `${lines.join("\n")}\n`);
  console.log(lines.join("\n"));
  console.log(`\nReport: test-results/exploratory/exploratory.md`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
