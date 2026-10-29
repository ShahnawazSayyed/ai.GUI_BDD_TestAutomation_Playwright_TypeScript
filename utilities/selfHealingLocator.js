const { chromium, firefox, webkit } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();

function parseArgs(argv) {
  const options = {
    url: process.env.DEPLOYMENT_URL || process.env.BASE_URL,
    browser: process.env.BROWSER || "chromium",
    selector: "",
    description: "",
    sourceFile: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--url" && argv[index + 1]) options.url = argv[++index];
    if (argv[index] === "--browser" && argv[index + 1]) options.browser = argv[++index];
    if (argv[index] === "--selector" && argv[index + 1]) options.selector = argv[++index];
    if (argv[index] === "--description" && argv[index + 1]) options.description = argv[++index];
    if (argv[index] === "--source-file" && argv[index + 1]) options.sourceFile = argv[++index];
  }

  if (!options.url) throw new Error("A URL is required. Use --url or set DEPLOYMENT_URL/BASE_URL.");
  if (!["chromium", "firefox", "webkit"].includes(options.browser)) {
    throw new Error("--browser must be chromium, firefox, or webkit.");
  }
  if (!options.selector && !options.description) {
    throw new Error("Provide --selector or --description for the intended element.");
  }
  return options;
}

function terms(value) {
  return [...new Set(
    (value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 2 && !["the", "and", "button", "input"].includes(word))
  )];
}

async function collectElements(page) {
  return page.locator(
    "button, a, input:not([type=hidden]), select, textarea, [role=button], [role=link], [role=checkbox], [role=radio], [role=textbox], [role=combobox]"
  ).evaluateAll((nodes) =>
    nodes.map((node, index) => {
      const tag = node.tagName.toLowerCase();
      const type = node.getAttribute("type") || "";
      const role = node.getAttribute("role") ||
        (tag === "a" ? "link" :
          tag === "button" ? "button" :
            tag === "textarea" ? "textbox" :
              tag === "select" ? "combobox" :
                type === "checkbox" ? "checkbox" :
                  type === "radio" ? "radio" :
                    type === "button" || type === "submit" ? "button" : "textbox");

      const labels = [...node.labels || []].map((label) => label.innerText?.trim()).filter(Boolean);
      const text = node.innerText?.trim() || "";
      const ariaLabel = node.getAttribute("aria-label")?.trim() || "";
      const title = node.getAttribute("title")?.trim() || "";
      const placeholder = node.getAttribute("placeholder")?.trim() || "";
      const testId = node.getAttribute("data-testid") ||
        node.getAttribute("data-test") ||
        node.getAttribute("data-cy") || "";
      const id = node.getAttribute("id") || "";
      const name = node.getAttribute("name") || "";

      return {
        index,
        tag,
        role,
        type,
        text: text.slice(0, 160),
        ariaLabel: ariaLabel.slice(0, 160),
        title: title.slice(0, 160),
        placeholder: placeholder.slice(0, 160),
        labels,
        testId,
        id,
        name
      };
    })
  );
}

function scoreElement(element, queryTerms, oldSelector) {
  const accessibleName = element.ariaLabel || element.text || element.labels[0] || element.placeholder || element.title || "";
  const metadata = [
    accessibleName,
    element.text,
    element.title,
    element.placeholder,
    ...element.labels,
    element.name,
    element.id,
    element.testId
  ].join(" ").toLowerCase();

  let score = 0;
  let matchCount = 0;
  for (const term of queryTerms) {
    if (metadata.includes(term)) {
      score += 4;
      matchCount += 1;
    }
  }
  if (element.testId) score += 8;
  if (element.ariaLabel || element.labels.length) score += 5;
  return { accessibleName, matchCount, score: Math.min(score, 30) };
}

async function uniqueCount(page, candidate) {
  if (candidate.kind === "test-id") {
    return page.getByTestId(candidate.value).count();
  }
  if (candidate.kind === "label") {
    return page.getByLabel(candidate.value, { exact: false }).count();
  }
  if (candidate.kind === "role") {
    return page.getByRole(candidate.role, { name: candidate.value, exact: false }).count();
  }
  if (candidate.kind === "text") {
    return page.getByText(candidate.value, { exact: false }).count();
  }
  if (candidate.kind === "css-id") {
    return page.locator(`#${candidate.value}`).count();
  }
  if (candidate.kind === "css-name") {
    return page.locator(`[name="${candidate.value}"]`).count();
  }
  if (candidate.kind === "placeholder") {
    return page.getByPlaceholder(candidate.value, { exact: false }).count();
  }
  return 0;
}

function locatorExpression(candidate) {
  const quote = (value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  if (candidate.kind === "test-id") return `page.getByTestId("${quote(candidate.value)}")`;
  if (candidate.kind === "label") return `page.getByLabel("${quote(candidate.value)}")`;
  if (candidate.kind === "role") return `page.getByRole("${candidate.role}", { name: "${quote(candidate.value)}" })`;
  if (candidate.kind === "text") return `page.getByText("${quote(candidate.value)}", { exact: true })`;
  if (candidate.kind === "css-id") return `page.locator("#${quote(candidate.value)}")`;
  if (candidate.kind === "css-name") return `page.locator('[name="${quote(candidate.value)}"]')`;
  if (candidate.kind === "placeholder") return `page.getByPlaceholder("${quote(candidate.value)}")`;
  return candidate.value;
}

function sourcePreview(sourceFile, oldSelector, rankedCandidates) {
  if (!sourceFile || rankedCandidates.length === 0) return [];
  const absolutePath = path.resolve(root, sourceFile);
  if (!fs.existsSync(absolutePath)) return [];

  const source = fs.readFileSync(absolutePath, "utf8");
  const selectorValues = [];
  if (oldSelector) selectorValues.push(oldSelector);

  return rankedCandidates
    .filter((candidate) => candidate.count === 1)
    .slice(0, 5)
    .map((candidate) => {
      const matchedLine = source
        .split(/\r?\n/)
        .find((line) => selectorValues.some((value) => line.includes(value)));
      return {
        sourceFile: path.relative(root, absolutePath).split(path.sep).join("/"),
        matchedLine: matchedLine?.trim() || null,
        recommendation: candidate.locator,
        patch: matchedLine
          ? `- ${matchedLine.trim()}\n+ ${matchedLine.trim().replace(oldSelector, candidate.locator)}`
          : null
      };
    });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const browserType = { chromium, firefox, webkit }[options.browser];
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const candidates = [];

  try {
    await page.goto(options.url, { waitUntil: "domcontentloaded", timeout: 45_000 });

    const elements = await collectElements(page);
    const queryTerms = terms(options.description || options.selector);

    for (const element of elements) {
      const { accessibleName, matchCount, score } = scoreElement(element, queryTerms, options.selector);
      if (queryTerms.length > 0 && matchCount === 0) continue;

      const elementCandidates = [];
      if (element.testId) {
        elementCandidates.push({ kind: "test-id", value: element.testId, score: 30 });
      }
      if (element.ariaLabel || element.labels.length || accessibleName) {
        const name = element.ariaLabel || element.labels[0] || accessibleName;
        if (name) elementCandidates.push({
          kind: element.labels.length ? "label" : "role",
          role: element.role,
          value: name,
          score: element.labels.length ? 28 : 27
        });
      }
      if (element.text) {
        elementCandidates.push({ kind: "text", value: element.text, score: 20 });
      }
      if (element.id) {
        elementCandidates.push({ kind: "css-id", value: element.id, score: 16 });
      }
      if (element.name) {
        elementCandidates.push({ kind: "css-name", value: element.name, score: 14 });
      }
      if (element.placeholder) {
        elementCandidates.push({ kind: "placeholder", value: element.placeholder, score: 22 });
      }

      for (const candidate of elementCandidates) {
        candidate.score = Math.min(30, candidate.score + score);
        candidate.count = await uniqueCount(page, candidate);
        candidate.element = {
          tag: element.tag,
          role: element.role,
          text: element.text,
          ariaLabel: element.ariaLabel,
          testId: element.testId
        };
        candidate.locator = locatorExpression(candidate);
        candidates.push(candidate);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  candidates.sort((left, right) => {
    const uniqueDifference = Number(right.count === 1) - Number(left.count === 1);
    return uniqueDifference || right.score - left.score || left.locator.localeCompare(right.locator);
  });

  const ranked = candidates.filter((candidate) => candidate.count > 0).slice(0, 20);
  const patchPreviews = sourcePreview(options.sourceFile, options.selector, ranked);
  const report = {
    generatedAt: new Date().toISOString(),
    browser: options.browser,
    url: options.url,
    oldSelector: options.selector,
    description: options.description,
    sourceFile: options.sourceFile,
    reviewRequired: true,
    patchPreviews,
    candidates: ranked
  };

  const markdown = [
    "# Self-Healing Locator Review",
    "",
    `- **Old selector:** \`${options.selector || "Not provided"}\``,
    `- **Description:** ${options.description || "Not provided"}`,
    `- **Browser:** ${options.browser}`,
    `- **Source file:** ${options.sourceFile || "Not provided"}`,
    "",
    "## Candidate locators",
    ""
  ];
  if (ranked.length === 0) {
    markdown.push("No unique reviewed candidate was found.");
  } else {
    for (const [index, candidate] of ranked.entries()) {
      markdown.push(
        `${index + 1}. \`${candidate.locator}\``,
        `   - Confidence: ${candidate.score}/30`,
        `   - Matches: ${candidate.count}`,
        `   - Type: ${candidate.kind}`,
        ""
      );
    }
  }
  markdown.push(
    "## Review policy",
    "",
    "No source file has been modified. Apply a candidate only after reviewing the target page and approving the semantic match."
  );
  if (patchPreviews.length) {
    markdown.push("", "## Patch previews", "");
    for (const preview of patchPreviews) {
      markdown.push(
        `### ${preview.sourceFile}`,
        "",
        "```diff",
        preview.patch || "No exact source line matched.",
        "```",
        ""
      );
    }
  }

  const outputDirectory = path.resolve(root, "test-results/locator-healing");
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, "candidates.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outputDirectory, "candidates.md"), `${markdown.join("\n")}\n`);
  console.log(markdown.join("\n"));
  console.log(`\nReview artifacts: test-results/locator-healing/`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
