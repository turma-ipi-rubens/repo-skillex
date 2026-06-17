import path from 'node:path';
import dotenv from 'dotenv';

// Fonte única de configuração: .env na raiz do projeto.
// `__dirname` resolve a partir de src/config/ (dev/tsx) ou dist/config/ (build),
// e ambos ficam 3 níveis abaixo da raiz — o mesmo offset cobre os dois casos.
// Em Docker, as vars já chegam via `environment:` no compose; este load vira
// no-op porque o arquivo não existe naquele filesystem.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Centraliza o acesso às variáveis de ambiente, aplicando valores padrão
 * seguros para desenvolvimento e garantindo tipagem.
 */
export const env = {
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  jwtSecret: process.env.JWT_SECRET ?? 'skillex-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  port: Number(process.env.PORT ?? 3333),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB ?? 5),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  isDev: (process.env.NODE_ENV ?? 'development') === 'development',
  // Jitsi self-hosted: o domínio é apenas a identidade da instância (também
  // serve como `sub` do JWT). O endpoint só emite token se APP_SECRET existir.
  jitsiDomain: process.env.JITSI_DOMAIN ?? 'jitsi.localhost:8000',
  jitsiAppId: process.env.JITSI_APP_ID ?? 'skillex',
  jitsiAppSecret: process.env.JITSI_APP_SECRET ?? '',
  // Rate limits — defaults sãos os mesmos de antes; o env permite afrouxar em
  // prod sob carga ou apertar para sondagem de abuso, sem rebuild.
  rateLimitGlobalWindowMs: Number(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS ?? 60_000),
  rateLimitGlobalMax: Number(process.env.RATE_LIMIT_GLOBAL_MAX ?? 300),
  rateLimitAuthWindowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS ?? 15 * 60_000),
  rateLimitAuthMax: Number(process.env.RATE_LIMIT_AUTH_MAX ?? 10),
};
