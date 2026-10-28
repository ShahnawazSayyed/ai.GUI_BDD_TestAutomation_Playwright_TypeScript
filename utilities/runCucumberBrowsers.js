const { spawn } = require("node:child_process");
const path = require("node:path");

const browsers = ["chromium", "firefox", "webkit"];
const workers = process.env.CUCUMBER_WORKERS || "4";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const runs = browsers.map((browser) => {
  const report = path.join("test-results", `cucumber-report-${browser}.html`);
  const args = [
    "cucumber-js",
    "--parallel",
    workers,
    "--format",
    "progress",
    "--format",
    `html:${report}`
  ];

  return new Promise((resolve) => {
    const child = spawn(npx, args, {
      env: { ...process.env, BROWSER: browser },
      stdio: "inherit",
      shell: false
    });
    child.on("error", (error) => {
      console.error(`${browser}: failed to start: ${error.message}`);
      resolve(1);
    });
    child.on("exit", (code) => {
      if (code !== 0) {
        console.error(`${browser}: Cucumber exited with code ${code}`);
      }
      resolve(code ?? 1);
    });
  });
});

Promise.all(runs).then((exitCodes) => {
  process.exitCode = exitCodes.some((code) => code !== 0) ? 1 : 0;
});
