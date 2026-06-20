import http from 'node:http';
import os from 'node:os';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { initRealtime } from './realtime/socket-server';
import { setIO } from './realtime/realtime';

const app = createApp();
const server = http.createServer(app);
const io = initRealtime(server);

// Detecta o IP LAN da máquina (mesma lógica de scripts/detect-host-ip.cjs)
// só para o log de boot ficar útil — o servidor segue ouvindo em 0.0.0.0.
function detectHostIp(): string {
  const envIp = process.env.HOST_IP?.trim();
  if (envIp) return envIp;
  for (const addrs of Object.values(os.networkInterfaces())) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      const ip = addr.address;
      if (
        ip.startsWith('192.168.') ||
        ip.startsWith('10.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
      ) {
        return ip;
      }
    }
  }
  return '0.0.0.0';
}

server.listen(env.port, '0.0.0.0', () => {
  const host = detectHostIp();
  console.log(`\n🚀 SkillEx API rodando em http://${host}:${env.port}`);
  console.log(`   Healthcheck: http://${host}:${env.port}/health`);
  console.log(`   WebSocket: ws://${host}:${env.port}/socket.io`);
  console.log(`   Ambiente: ${env.nodeEnv}\n`);
});

// Encerramento gracioso (libera socket.io e a conexão com o banco)
async function shutdown() {
  console.log('\n⏳ Encerrando servidor SkillEx...');
  setIO(null);
  io.close();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
