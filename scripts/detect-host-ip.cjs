// =============================================================================
//  SkillEx — Detecção do IP LAN da máquina (cross-platform)
// -----------------------------------------------------------------------------
//  Estratégia:
//   1. Se HOST_IP estiver definido no ambiente, usa ele (override manual).
//   2. Caso contrário, escolhe a primeira interface IPv4 "real":
//        - externa (não-loopback)
//        - "up" / não-virtual quando possível
//        - prioriza faixas privadas comuns (192.168, 10., 172.16-31)
//   3. Fallback final: 127.0.0.1 (último recurso, apenas se a máquina
//      estiver totalmente offline).
//
//  Uso programático:
//    const { detectHostIp } = require('./detect-host-ip.cjs');
//    const ip = detectHostIp();
//
//  Uso via CLI (imprime o IP):
//    node scripts/detect-host-ip.cjs
// =============================================================================

const os = require('node:os');

function isPrivateIPv4(ip) {
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('172.')) {
    const second = Number(ip.split('.')[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

function detectHostIp() {
  if (process.env.HOST_IP && process.env.HOST_IP.trim()) {
    return process.env.HOST_IP.trim();
  }

  const nets = os.networkInterfaces();
  const candidates = [];

  for (const [name, addrs] of Object.entries(nets)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family !== 'IPv4') continue;
      if (addr.internal) continue;
      candidates.push({ name, address: addr.address });
    }
  }

  // Prioriza faixas privadas (LAN típica de dev/escritório).
  const priv = candidates.find((c) => isPrivateIPv4(c.address));
  if (priv) return priv.address;

  // Senão pega a primeira interface externa disponível (IP público direto).
  if (candidates.length > 0) return candidates[0].address;

  // Máquina offline — último recurso.
  return '127.0.0.1';
}

module.exports = { detectHostIp, isPrivateIPv4 };

if (require.main === module) {
  process.stdout.write(detectHostIp() + '\n');
}
