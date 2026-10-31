import { defineConfig } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const output = process.env.HISTORY_FORGE_QA_DIR ||
  path.join(os.tmpdir(), "history-forge-public-browser");
const port = Number(process.env.HISTORY_FORGE_QA_PORT || 5275);
export default defineConfig({
  testDir: "./tests/browser",
  outputDir: path.join(output, "results"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(output, "results.json") }],
    ["html", { outputFolder: path.join(output, "report"), open: "never" }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${port}/HistoryForge/`,
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.HISTORY_FORGE_BROWSER || undefined,
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  projects: [1, 2].flatMap((deviceScaleFactor) =>
    [
      { name: "desktop", viewport: { width: 1280, height: 800 } },
      { name: "phone", viewport: { width: 390, height: 844 } },
    ].map(({ name, viewport }) => ({
      name: `${name}-dpr${deviceScaleFactor}`,
      use: { viewport, deviceScaleFactor },
    })),
  ),
  webServer: {
    command: `npm run preview -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/HistoryForge/`,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
