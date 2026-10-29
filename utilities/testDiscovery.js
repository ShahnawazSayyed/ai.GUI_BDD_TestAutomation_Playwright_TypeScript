const { chromium, firefox, webkit } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  const options = {
    url: process.env.DEPLOYMENT_URL || process.env.BASE_URL,
    maxPages: 10,
    browser: process.env.BROWSER || "chromium"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--url" && argv[index + 1]) {
      options.url = argv[index + 1];
      index += 1;
    } else if (argument === "--max-pages" && argv[index + 1]) {
      options.maxPages = Number(argv[index + 1]);
      index += 1;
    } else if (argument === "--browser" && argv[index + 1]) {
      options.browser = argv[index + 1].toLowerCase();
      index += 1;
    }
  }

  if (!options.url) {
    throw new Error("A URL is required. Use --url or set DEPLOYMENT_URL/BASE_URL.");
  }
  if (!Number.isInteger(options.maxPages) || options.maxPages < 1) {
    throw new Error("--max-pages must be a positive integer.");
  }
  if (!["chromium", "firefox", "webkit"].includes(options.browser)) {
    throw new Error("--browser must be chromium, firefox, or webkit.");
  }

  return options;
}

function safeSlug(value) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "page";
}

async function collectPage(page) {
  const title = await page.title();
  const url = page.url();
  const elements = await page.locator(
    "a, button, input:not([type=hidden]), select, textarea, [role=button]"
  ).evaluateAll((nodes) =>
    nodes.slice(0, 250).map((node, index) => {
      const element = node;
      const text = element.innerText?.trim() || "";
      const ariaLabel = element.getAttribute("aria-label")?.trim() || "";
      const placeholder = element.getAttribute("placeholder")?.trim() || "";
      const name = element.getAttribute("name")?.trim() || "";
      const tag = element.tagName.toLowerCase();
      const type = element.getAttribute("type") || "";
      const role = element.getAttribute("role") ||
        (tag === "a" ? "link" :
          tag === "button" ? "button" :
            tag === "input" && ["checkbox", "radio"].includes(type) ? type :
              tag === "input" ? "textbox" :
                tag === "select" ? "combobox" :
                  tag === "textarea" ? "textbox" : tag);

      return {
        index,
        tag,
        role,
        type,
        text: text.slice(0, 160),
        ariaLabel: ariaLabel.slice(0, 160),
        placeholder: placeholder.slice(0, 160),
        name: name.slice(0, 160),
        href: element.getAttribute("href") || ""
      };
    })
  );

  const headings = await page.locator("h1, h2").evaluateAll((nodes) =>
    nodes.slice(0, 30).map((node) => node.innerText?.trim()).filter(Boolean)
  );

  return { url, title, headings, elements };
}

function buildCandidates(pages) {
  const scenarios = [];

  for (const discoveredPage of pages) {
    if (!discoveredPage.title || discoveredPage.error) continue;
    const slug = safeSlug(discoveredPage.title || new URL(discoveredPage.url).pathname);
    const links = discoveredPage.elements.filter((element) => element.role === "link" && element.text);
    const controls = discoveredPage.elements.filter((element) =>
      ["button", "textbox", "checkbox", "radio", "combobox", "select", "textarea"].includes(element.role) ||
      ["button", "input", "select", "textarea"].includes(element.tag)
    );

    scenarios.push({
      name: `Open ${discoveredPage.title || slug} page`,
      type: "smoke",
      pageUrl: discoveredPage.url,
      title: discoveredPage.title,
      steps: [
        `Given I navigate to "${discoveredPage.url}"`,
        `Then The page title should be "${discoveredPage.title.replace(/"/g, '\\"')}"`
      ]
    });

    for (const heading of discoveredPage.headings.slice(0, 3)) {
      scenarios.push({
        name: `Display heading "${heading}"`,
        type: "content",
        pageUrl: discoveredPage.url,
        steps: [
          `Given I navigate to "${discoveredPage.url}"`,
          `Then I should see "${heading.replace(/"/g, '\\"')}"`
        ]
      });
    }

    for (const link of links.slice(0, 5)) {
      scenarios.push({
        name: `Expose navigation link "${link.text}"`,
        type: "navigation",
        pageUrl: discoveredPage.url,
        steps: [
          `Given I navigate to "${discoveredPage.url}"`,
          `Then I should see link "${link.text.replace(/"/g, '\\"')}"`
        ]
      });
    }

    if (controls.length > 0) {
      const controlLabels = controls.slice(0, 8).map((control) =>
        control.ariaLabel || control.text || control.placeholder || control.name
      ).filter(Boolean);

      if (controlLabels.length > 0) {
        scenarios.push({
          name: `Display controls on ${discoveredPage.title || slug}`,
          type: "controls",
          pageUrl: discoveredPage.url,
          steps: [
            `Given I navigate to "${discoveredPage.url}"`,
            ...controlLabels.map((label) => `Then I should see "${label.replace(/"/g, '\\"')}"`)
          ]
        });
      }
    }
  }

  return scenarios;
}

function writeFeatureDraft(candidates) {
  const features = ["Feature: Automatically discovered website coverage", ""];

  for (const candidate of candidates) {
    features.push(`  Scenario: ${candidate.name}`);
    for (const step of candidate.steps) {
      features.push(`    ${step}`);
    }
    features.push("");
  }

  return `${features.join("\n").trim()}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const browserType = { chromium, firefox, webkit }[options.browser];
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const startUrl = new URL(options.url);
  const queue = [startUrl.toString()];
  const visited = new Set();
  const pages = [];

  try {
    while (queue.length > 0 && visited.size < options.maxPages) {
      const currentUrl = queue.shift();
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);

      try {
        await page.goto(currentUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
        const discoveredPage = await collectPage(page);
        pages.push(discoveredPage);

        const links = await page.locator("a[href]").evaluateAll((nodes, origin) =>
          nodes.map((node) => node.href).filter((href) => {
            try {
              return new URL(href).origin === origin;
            } catch {
              return false;
            }
          }),
        startUrl.origin);

        for (const link of links) {
          if (!visited.has(link) && !queue.includes(link)) queue.push(link);
        }
      } catch (error) {
        pages.push({
          url: currentUrl,
          title: "",
          headings: [],
          elements: [],
          error: error.message
        });
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const candidates = buildCandidates(pages);
  const outputDirectory = path.resolve(process.cwd(), "test-results/test-discovery");
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(outputDirectory, "discovery.json"),
    JSON.stringify({ target: startUrl.toString(), browser: options.browser, pages, candidates }, null, 2)
  );
  fs.writeFileSync(
    path.join(outputDirectory, "candidates.feature"),
    writeFeatureDraft(candidates)
  );

  console.log(`Discovered ${pages.length} page(s), ${candidates.length} candidate scenario(s).`);
  console.log(`Output: ${path.join(outputDirectory, "discovery.json")}`);
  console.log(`Draft: ${path.join(outputDirectory, "candidates.feature")}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
