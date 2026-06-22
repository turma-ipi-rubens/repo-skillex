import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Banco de teste isolado (nunca toca o dev.db). Caminho absoluto para evitar
// ambiguidade de resolução relativa do SQLite entre CLI e runtime do Prisma.
const TEST_DB_URL = 'file:' + path.resolve(process.cwd(), 'prisma/test.db');

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Variáveis carregadas no worker ANTES de importar env.ts/Prisma.
    env: {
      DATABASE_URL: TEST_DB_URL,
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '1h',
      NODE_ENV: 'test',
      CLIENT_URL: 'http://localhost:5173',
      // Definidas (não-vazias, exceto o secret) para que o load do env.ts
      // exercite o ramo "valor presente" de cada `??`/`||`. O secret fica
      // vazio para preservar o 503 padrão da vídeo chamada nos testes; e os
      // rate limits usam os mesmos defaults (sem alterar comportamento).
      JITSI_DOMAIN: 'jitsi.localhost:8000',
      JITSI_APP_ID: 'skillex',
      JITSI_APP_SECRET: '',
      RATE_LIMIT_GLOBAL_WINDOW_MS: '60000',
      RATE_LIMIT_GLOBAL_MAX: '300',
      RATE_LIMIT_AUTH_WINDOW_MS: '900000',
      RATE_LIMIT_AUTH_MAX: '10',
    },
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    // SQLite (arquivo único) não tolera escrita concorrente entre workers.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.ts'],
      // Bootstrap validado por integração/E2E, fora do gate de cobertura.
      exclude: ['src/server.ts', 'src/config/prisma.ts'],
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
