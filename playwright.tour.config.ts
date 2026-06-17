import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const backendDir = path.resolve(__dirname, 'backend');
const frontendDir = path.resolve(__dirname, 'frontend');

/**
 * Configuração dedicada ao TOUR GUIADO (não é teste — é uma demo visual).
 *
 *   npm run tour                     # tour padrão (slowMo 450ms)
 *   SLOWMO=700 npm run tour          # mais devagar
 *   $env:SLOWMO=200; npm run tour    # mais rápido (Windows PowerShell)
 *
 * Difere do playwright.config.ts em três pontos:
 *   - Roda apenas arquivos em ./e2e/tour
 *   - Sempre headed, com slowMo alto
 *   - Timeout esticado (o tour pode levar 3–5 min)
 */
export default defineConfig({
  testDir: './e2e/tour',
  testMatch: '**/*.ts',
  timeout: 10 * 60_000, // 10 min — passos longos e overlays narrativos
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    headless: false,
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      slowMo: process.env.SLOWMO ? Number(process.env.SLOWMO) : 450,
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run e2e:serve',
      cwd: backendDir,
      url: 'http://localhost:3333/health',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: 'file:./e2e.db',
        JWT_SECRET: 'e2e-secret',
        JWT_EXPIRES_IN: '7d',
        PORT: '3333',
        NODE_ENV: 'test',
        CLIENT_URL: 'http://localhost:5173',
      },
    },
    {
      command: 'npm run dev',
      cwd: frontendDir,
      url: 'http://localhost:5173',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
