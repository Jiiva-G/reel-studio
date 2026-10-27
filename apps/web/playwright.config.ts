import { defineConfig, devices } from "@playwright/test";

// Runs against the production build (vite preview). Locally it uses the installed Chrome; CI installs Chromium.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:4173",
    channel: process.env.CI ? undefined : "chrome",
    acceptDownloads: true,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"] }, testMatch: /layout\.spec/ },
  ],
  webServer: process.env.BASE_URL ? undefined : { command: "npm run preview", url: "http://localhost:4173", reuseExistingServer: true, timeout: 60_000 },
});
