import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { networkInterfaces } from 'node:os';

// Detecção do IP LAN — mesma heurística de scripts/detect-host-ip.cjs (inlined
// porque o Vite bundle do config em ESM não suporta `require` de um .cjs).
// Mantenha as duas implementações em sincronia se uma mudar.
function detectHostIp(): string {
  const envIp = process.env.HOST_IP?.trim();
  if (envIp) return envIp;
  const candidates: string[] = [];
  for (const addrs of Object.values(networkInterfaces())) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      candidates.push(addr.address);
    }
  }
  const priv = candidates.find(
    (ip) =>
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip),
  );
  return priv ?? candidates[0] ?? '127.0.0.1';
}

// O proxy encaminha as chamadas /api e /uploads para a API (porta 3333),
// permitindo que o frontend use caminhos relativos e evite problemas de CORS.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const hostIp = env.HOST_IP || env.VITE_HOST_IP || detectHostIp();
  const backendUrl = env.VITE_BACKEND_URL || `http://${hostIp}:3333`;

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        // Sem service worker no dev server (evita interferir no Vite/E2E)
        devOptions: { enabled: false },
        manifest: {
          name: 'SkillEx — Troque habilidades',
          short_name: 'SkillEx',
          description:
            'Plataforma social de troca de habilidades. Ensine o que você sabe, aprenda o que deseja.',
          lang: 'pt-BR',
          display: 'standalone',
          start_url: '/',
          background_color: '#ffffff',
          theme_color: '#f97316',
          icons: [
            { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icons/pwa-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: 'index.html',
          // API, uploads e WebSocket NUNCA passam pelo cache do service worker
          navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//, /^\/socket\.io\//],
          runtimeCaching: [
            {
              // Fotos de perfil/capa são versionadas pelo nome do arquivo, mas
              // o service worker default pode entregar a versão precached da
              // home. Forçamos NetworkOnly para sempre buscar o arquivo atual.
              urlPattern: /^\/uploads\//,
              handler: 'NetworkOnly',
            },
          ],
        },
      }),
    ],
    css: {
      preprocessorOptions: {
        scss: {
          // Usa a API moderna do Dart Sass (remove o aviso de "legacy JS API").
          api: 'modern-compiler',
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': backendUrl,
        '/uploads': backendUrl,
        // WebSocket (socket.io) — ws:true habilita o upgrade de protocolo
        '/socket.io': { target: backendUrl, ws: true },
      },
    },
  };
});
