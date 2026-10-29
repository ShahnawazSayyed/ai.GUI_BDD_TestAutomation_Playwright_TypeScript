module.exports = {
  default: {
    requireModule: ["ts-node/register"],
    require: [
      "playwright/support/**/*.ts",
      "playwright/steps/**/*.ts"
    ],
    paths: ["features/**/*.feature"],
    format: ["progress", "html:test-results/cucumber-report.html"],
    timeout: 60000
  }
};
