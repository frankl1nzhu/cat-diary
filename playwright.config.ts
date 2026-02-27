import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './e2e',
    timeout: 45_000,
    expect: {
        timeout: 8_000,
    },
    fullyParallel: true,
    retries: 0,
    use: {
        baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
        trace: 'on-first-retry',
    },
    webServer: {
        command: 'npm run dev -- --host 127.0.0.1 --port 5173',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: true,
        timeout: 90_000,
    },
    projects: [
        {
            name: 'mobile-chromium',
            use: {
                ...devices['Pixel 7'],
            },
        },
    ],
})
