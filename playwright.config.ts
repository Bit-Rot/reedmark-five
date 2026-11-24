import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 110_000,
  workers: 2,
  use: {
    baseURL: 'http://localhost:4177',
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4177',
    reuseExistingServer: true,
    timeout: 20_000,
  },
});
