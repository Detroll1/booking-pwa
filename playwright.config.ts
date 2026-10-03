import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {timeout: 8_000},
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'off',
  },
  projects: [{name: 'chromium', use: {...devices['Desktop Chrome'], viewport: {width: 390, height: 844}}}],
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:4173/mock',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_APP_ENV: 'test',
      VITE_DEFAULT_TENANT: 'graphite-detailing',
    },
  },
});
