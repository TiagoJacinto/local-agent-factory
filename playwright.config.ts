import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 5 * 60 * 1000,
  use: {
    headless: true,
  },
});
