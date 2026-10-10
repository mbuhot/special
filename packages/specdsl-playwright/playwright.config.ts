import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4012";

export default defineConfig({
  testDir: "src",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", testMatch: "run.ts", use: { ...devices["Desktop Chrome"] } },
    {
      name: "demo",
      testMatch: "demo.ts",
      timeout: 180_000,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "design",
      testMatch: "design.ts",
      fullyParallel: true,
      timeout: 180_000,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: process.env["SPECDSL_STATIC_ONLY"]
    ? undefined
    : {
        command: "PORT=4012 MIX_ENV=e2e mix phx.server",
        cwd: "../../apps/invoicing",
        url: `${baseURL}/login`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
