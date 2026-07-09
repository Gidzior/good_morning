import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// Testy e2e startuja wlasny backend (port 3102) na odrebnej bazie SQLite —
// dev serwer (3001, data/dashboard.db) zostaje nietkniety.
// Backend serwuje frontend/dist, wiec przed testami frontend musi byc zbudowany.
const PORT = 3102;
const BASE_URL = `http://localhost:${PORT}`;
const DB_PATH = path.join(__dirname, 'e2e', '.tmp', 'e2e.db');

export default defineConfig({
  testDir: './e2e',
  // wspolna baza i jeden user — testy ida sekwencyjnie
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // w CI dodatkowo raport html — workflow wrzuca go jako artifact przy failu
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx ts-node --project e2e/tsconfig.json e2e/start-server.ts',
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      DB_PATH,
      BASE_URL,
      FRONTEND_URL: BASE_URL,
      // sekwencyjne testy robia wiele dev-loginow + session checkow w <1 min,
      // a kilka zaladowan dashboardu z jednego IP zbliza sie do limitu /api
      AUTH_RATE_LIMIT: '1000',
      API_RATE_LIMIT: '5000',
    },
  },
});
