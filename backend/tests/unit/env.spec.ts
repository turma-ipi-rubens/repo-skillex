import { describe, it, expect, vi } from 'vitest';

/**
 * Cobre os valores padrão de env.ts quando nenhuma variável de ambiente
 * está definida (dotenv é mockado para não recarregar do arquivo .env).
 *
 * O ramo "valor presente" de cada `??`/`||` é exercitado pelo load normal do
 * módulo (o vitest define as variáveis no worker — ver vitest.config.ts);
 * aqui exercitamos o ramo "valor ausente" (fallback) re-importando o módulo
 * com todas as variáveis removidas.
 */
describe('env — valores padrão', () => {
  it('aplica defaults seguros quando nada está definido no ambiente', async () => {
    const keys = [
      'DATABASE_URL',
      'JWT_SECRET',
      'JWT_EXPIRES_IN',
      'PORT',
      'NODE_ENV',
      'UPLOAD_DIR',
      'MAX_UPLOAD_SIZE_MB',
      'CLIENT_URL',
      'JITSI_DOMAIN',
      'JITSI_APP_ID',
      'JITSI_APP_SECRET',
      'RATE_LIMIT_GLOBAL_WINDOW_MS',
      'RATE_LIMIT_GLOBAL_MAX',
      'RATE_LIMIT_AUTH_WINDOW_MS',
      'RATE_LIMIT_AUTH_MAX',
    ];
    const saved: Record<string, string | undefined> = {};
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    vi.resetModules();
    vi.doMock('dotenv', () => ({ default: { config: () => ({}) }, config: () => ({}) }));

    try {
      const { env } = await import('../../src/config/env');
      expect(env.databaseUrl).toBe('file:./dev.db');
      expect(env.jwtSecret).toBe('skillex-dev-secret');
      expect(env.jwtExpiresIn).toBe('7d');
      expect(env.port).toBe(3333);
      expect(env.nodeEnv).toBe('development');
      expect(env.uploadDir).toBe('uploads');
      expect(env.maxUploadSizeMb).toBe(5);
      expect(env.clientUrl).toBe('http://localhost:5173');
      expect(env.isDev).toBe(true);
      // Jitsi e rate limits — defaults
      expect(env.jitsiDomain).toBe('jitsi.localhost:8000');
      expect(env.jitsiAppId).toBe('skillex');
      expect(env.jitsiAppSecret).toBe('');
      expect(env.rateLimitGlobalWindowMs).toBe(60_000);
      expect(env.rateLimitGlobalMax).toBe(300);
      expect(env.rateLimitAuthWindowMs).toBe(15 * 60_000);
      expect(env.rateLimitAuthMax).toBe(10);
    } finally {
      for (const k of keys) {
        if (saved[k] !== undefined) process.env[k] = saved[k];
      }
      vi.doUnmock('dotenv');
      vi.resetModules();
    }
  });
});
