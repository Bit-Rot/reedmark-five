import { defineConfig } from '@playwright/test';

const port = process.env.PW_PORT ?? '4177';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 110_000,
  workers: 2,
  use: {
    // Set PW_CHANNEL=chrome (or msedge) to use an installed browser instead of Playwright's bundled Chromium.
    channel: process.env.PW_CHANNEL || undefined,
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 20_000,
  },
});
