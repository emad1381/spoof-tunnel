import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: './tests', fullyParallel: true, workers: 2, retries: 0,
 use: { baseURL: 'http://127.0.0.1:18765', browserName: 'chromium', channel: process.env.PW_CHANNEL || undefined, trace: 'retain-on-failure' },
 webServer: { command: 'node tests/serve.mjs', url: 'http://127.0.0.1:18765/reviewprefix/login/', reuseExistingServer: false },
});
