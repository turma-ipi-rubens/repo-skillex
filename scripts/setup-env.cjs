// =============================================================================
//  SkillEx — Bootstrap de configuração baseado no IP da máquina
// -----------------------------------------------------------------------------
//  Roda ANTES do `docker compose up`, `npm run dev` (back/front) e dos testes
//  E2E. Detecta o IP LAN da máquina e grava em `.env` as variáveis derivadas
//  (CLIENT_URL, JITSI_DOMAIN, JITSI_PUBLIC_URL, JITSI_DOCKER_HOST_ADDRESS,
//  JITSI_XMPP_DOMAIN), sempre sobrescrevendo valores antigos para refletir
//  mudanças de rede (notebook trocando de Wi-Fi, etc.).
//
//  Variáveis preservadas (não tocadas se já existirem):
//    - segredos (JWT_SECRET, JITSI_*_SECRET/PASSWORD)
//    - configurações que não dependem do host (PORT, NODE_ENV, rate-limits...)
//
//  Uso:
//    node scripts/setup-env.cjs            # grava .env e imprime o IP escolhido
//    node scripts/setup-env.cjs --quiet    # sem output (apenas grava)
//    HOST_IP=10.0.0.42 node scripts/setup-env.cjs   # força um IP específico
// =============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { detectHostIp } = require('./detect-host-ip.cjs');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const ENV_EXAMPLE_PATH = path.join(ROOT, '.env.example');
const FRONTEND_ENV_LOCAL = path.join(ROOT, 'frontend', '.env.local');

const QUIET = process.argv.includes('--quiet');

function log(msg) {
  if (!QUIET) process.stdout.write(msg + '\n');
}

function ensureEnvFile() {
  if (fs.existsSync(ENV_PATH)) return;
  if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
    throw new Error('Nem .env nem .env.example existem na raiz do projeto');
  }
  fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
  log('✓ .env criado a partir de .env.example');
}

function readEnvLines() {
  return fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
}

function writeEnvLines(lines) {
  fs.writeFileSync(ENV_PATH, lines.join('\n'));
}

// Upsert preservando comentários e ordem original.
// Se a chave existir → reescreve a linha. Se não → adiciona ao final.
function upsertEnv(lines, key, value) {
  const re = new RegExp('^' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=');
  let replaced = false;
  const out = lines.map((line) => {
    if (re.test(line)) {
      replaced = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!replaced) {
    if (out.length && out[out.length - 1] !== '') out.push('');
    out.push(`${key}=${value}`);
  }
  return out;
}

function buildDerivedVars(ip) {
  const jitsiPort = process.env.JITSI_HTTP_PORT || '8000';
  return {
    HOST_IP: ip,
    CLIENT_URL: `http://${ip}`,
    JITSI_DOMAIN: `${ip}:${jitsiPort}`,
    JITSI_PUBLIC_URL: `http://${ip}:${jitsiPort}`,
    JITSI_XMPP_DOMAIN: ip,
    JITSI_DOCKER_HOST_ADDRESS: ip,
  };
}

function writeFrontendEnvLocal(ip) {
  // Vite carrega `frontend/.env.local` automaticamente. As VITE_* ficam
  // disponíveis no client; as não-prefixadas ficam no vite.config.ts.
  const content =
    `# Gerado automaticamente por scripts/setup-env.cjs — não editar à mão.\n` +
    `HOST_IP=${ip}\n` +
    `VITE_HOST_IP=${ip}\n` +
    `VITE_BACKEND_URL=http://${ip}:3333\n`;
  fs.writeFileSync(FRONTEND_ENV_LOCAL, content);
}

function main() {
  ensureEnvFile();
  const ip = detectHostIp();
  const derived = buildDerivedVars(ip);

  let lines = readEnvLines();
  for (const [key, value] of Object.entries(derived)) {
    lines = upsertEnv(lines, key, value);
  }
  writeEnvLines(lines);
  writeFrontendEnvLocal(ip);

  log(`✓ HOST_IP detectado: ${ip}`);
  log(`  .env atualizado: ${path.relative(ROOT, ENV_PATH)}`);
  log(`  frontend/.env.local atualizado`);
  log('');
  log('  CLIENT_URL                = ' + derived.CLIENT_URL);
  log('  JITSI_DOMAIN              = ' + derived.JITSI_DOMAIN);
  log('  JITSI_PUBLIC_URL          = ' + derived.JITSI_PUBLIC_URL);
  log('  JITSI_DOCKER_HOST_ADDRESS = ' + derived.JITSI_DOCKER_HOST_ADDRESS);
}

main();
