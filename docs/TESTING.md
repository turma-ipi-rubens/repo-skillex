# 🧪 Estratégia de Testes — SkillEx

Cobertura completa em três camadas (pirâmide de testes): **unitários**, **integração** e **end-to-end (E2E)**.

| Camada | Ferramenta | Onde | O que cobre |
|--------|-----------|------|-------------|
| Unitário | **Vitest** | `backend/tests/unit`, `frontend/tests` | Funções puras: algoritmo de match, utils, schemas Zod, presenters, middlewares, formatação, contexts, hooks, componentes de UI |
| Integração | **Vitest + Supertest** | `backend/tests/integration` | Rotas HTTP `/api/*` + services contra um SQLite de teste real (Prisma); tempo real com socket.io-client de verdade |
| E2E | **Playwright** | `e2e/specs` | Fluxos reais do usuário pela SPA contra a API (auth, navegação, carteira, recuperação de senha, configurações, admin, chat em tempo real) |

## Cobertura

- **Backend:** 100% de statements, branches, functions e lines (gate no `vitest.config.ts`). Banco de teste isolado em `backend/prisma/test.db` (nunca toca o `dev.db`).
- **Frontend:** 100% na camada de **lógica + componentes reutilizáveis** (`utils`, `services`, `contexts`, `hooks`, `components`). As **páginas (view)** são validadas pelos testes **E2E**.
- Os poucos ramos marcados com `/* v8 ignore */` são guardas defensivos comprovadamente inalcançáveis (campos sempre presentes via `include` do Prisma, usuário autenticado garantido). Cada um traz uma justificativa no código.

## Tempo real (socket.io)

O socket.io é testado nas três camadas:

- **Backend (integração)** — `tests/integration/realtime.spec.ts` sobe um servidor HTTP **efêmero** (`server.listen(0)`, porta livre escolhida pelo SO) com `initRealtime` e conecta um **socket.io-client real** dentro do Vitest. Cobre o handshake (token válido, sem token, token inválido, conta desativada, usuário excluído), as rooms (participante recebe `chat:message`, intruso não recebe, ack de `request:joined`, `request:leave`) e os eventos emitidos pelos services ao aceitar solicitação e enviar mensagem.
- **Facade no-op** — os services emitem eventos apenas pela facade `src/realtime/realtime.ts`; quando `setIO` não foi chamado, as emissões viram no-ops. É isso que permite todas as demais specs de integração HTTP rodarem sem servidor de socket. A facade em si é coberta pelo unitário `realtime.spec` com um `io` falso e com `io` nulo.
- **Frontend (unitário)** — `tests/unit/realtime.spec.ts` testa o `services/realtime.ts` com `vi.mock('socket.io-client')` e um socket falso (nenhuma conexão de rede): conexão com o JWT no handshake, registry multi-subscriber (`subscribeRealtime` / `Map<Event, Set<handler>>`), join/leave de rooms, rejoin automático na reconexão e limpeza no disconnect.
- **E2E** — `realtime-chat.e2e.ts` abre **dois contextos de navegador** (dois usuários logados ao mesmo tempo) e verifica que a mensagem de chat aparece sem reload e que o badge de notificações incrementa ao vivo.

## Como rodar

### Backend (unitário + integração)
```bash
cd backend
npm install
npm run test          # roda os testes
npm run test:cov      # com relatório de cobertura (gate 100%)
```
> O `globalSetup` cria/zera o schema no `test.db` automaticamente; cada teste roda com as tabelas limpas. O rate limiting é desativado quando `NODE_ENV=test` — os testes de integração e o E2E disparam dezenas de requisições em sequência e estourariam o limite; o comportamento do limitador é coberto à parte no unitário `rate-limit.spec`.

### Frontend (unitário + componentes)
```bash
cd frontend
npm install
npm run test:cov
```

### E2E (Playwright)
```bash
# na raiz do projeto
npm install
npx playwright install chromium
npm run test:e2e          # sobe backend (semeado) + frontend automaticamente
npm run test:e2e:report   # abre o relatório HTML
```
> O Playwright sobe sozinho o backend (banco `e2e.db` resetado + `seed`) e o frontend (Vite) via `webServer`. Conta de teste: `ana@skillex.com` / `senha123` (admin).

#### Modo *headed* (navegador visível) e modo demo

Para acompanhar a execução com o navegador aberto — útil para depuração e para a **apresentação da banca**:

```bash
npm run test:e2e:headed   # todos os specs com o Chromium visível
npm run test:e2e:demo     # só o walkthrough do fluxo principal
npm run test:e2e:ui       # interface interativa do Playwright (passo a passo)
```

Para diminuir o ritmo das ações (cada interação espera `SLOWMO` milissegundos), defina a variável de ambiente antes do comando:

```bash
# Linux / macOS
SLOWMO=300 npm run test:e2e:headed

# Windows PowerShell
$env:SLOWMO="300"; npm run test:e2e:demo
```

| Script | Comportamento | Quando usar |
|--------|---------------|-------------|
| `test:e2e` | Headless, todos os specs | CI e checagem rápida local |
| `test:e2e:headed` | Headed, todos os specs | Depurar um spec quebrando |
| `test:e2e:demo` | Headed, só `demo-walkthrough.e2e.ts` | Apresentação da banca |
| `test:e2e:responsive` | Headless, só `responsive.e2e.ts` (mobile/tablet/desktop) | Validar a SPA nos 3 viewports |
| `test:e2e:ui` | Modo *time-travel* do Playwright | Investigar passo a passo |
| `test:e2e:report` | Abre o HTML report da última execução | Ver traces, screenshots e logs |
| `tour` | Tour guiado headed com narração visual | Demo da banca / vídeo de divulgação |

O spec `e2e/specs/demo-walkthrough.e2e.ts` é um **roteiro narrado** dividido em `test.step` (login → feed com match → perfil do Bruno → busca → carteira → logout) — cada passo aparece nomeado no relatório e na barra superior do Chromium quando rodando com `--headed`.

#### Responsividade (mobile / tablet / desktop)

O spec `e2e/specs/responsive.e2e.ts` roda **o mesmo conjunto de verificações em 3 viewports** representativos, validando que o único breakpoint estrutural da SPA (`@media (min-width: 1024px)` em `frontend/src/styles/components/_shell.scss`) reagrupa o layout corretamente.

| Perfil | Viewport | Dispositivo | Layout esperado |
|--------|----------|-------------|-----------------|
| `mobile` | 412 × 915 | Pixel 7 (Android, `isMobile` + `hasTouch`) | Barra inferior fixa |
| `tablet` | 820 × 1180 | iPad-like | Barra inferior fixa |
| `desktop` | 1440 × 900 | Notebook 14" / monitor padrão | Sidebar lateral |

O que cada teste verifica em cada perfil:

1. **Shell renderiza** — header, `bottom-nav` e os 5 itens (`feed`, `search`, `requests`, `wallet`, `profile`) visíveis.
2. **Breakpoint correto** — mede o `boundingBox` da `.bottom-nav` e valida a forma:
   - **Sidebar (desktop):** `x < 50`, `width < 300`, altura > 40% da viewport.
   - **Bottom-bar (mobile/tablet):** `width > 70%` da viewport, altura `< 120px`, borda inferior nos últimos 15% da tela.
3. **Navegação clicável** — clica em `Carteira` e confirma rota `/wallet` + heading visível.
4. **Login funcional** — campos `email`, `password` e botão de submit visíveis (importante porque a tela de login tem layout próprio fora do shell).

Cada teste tira um **screenshot** em `e2e/snapshots/{perfil}-{tela}.png` para revisão visual manual (9 arquivos: feed/wallet/login × mobile/tablet/desktop). A pasta é ignorada pelo git — gere localmente sempre que quiser comparar.

#### Tour guiado (`npm run tour`)

Diferente dos testes — o **tour** (`e2e/tour/guided-tour.ts`) é uma **demo automatizada** pensada para ser ASSISTIDA, não para validar nada. Roda em janela headed, com `slowMo: 450`, e injeta **legendas overlay** sobre o app explicando cada feature enquanto o cursor navega.

```bash
npm run tour                     # ritmo padrão (~3–4 min)
SLOWMO=700 npm run tour          # bem devagar (apresentação ao vivo)
$env:SLOWMO=200; npm run tour    # rápido (gravação de vídeo)
```

**Roteiro (16 paradas):**

1. 👋 Landing pública
2. 🔐 Login (conta seed `ana@skillex.com`)
3. 🏠 Feed de matches (destaca o card do Bruno, score 100)
4. 👤 Perfil do match
5. 🔍 Busca (com digitação simulada)
6. 📈 Tendências
7. 🏆 Ranking
8. 🎯 Habilidades
9. ❤️ Favoritos
10. 🔄 Trocas
11. 💰 Carteira (destaca o saldo)
12. 🔔 Notificações
13. ⚙️ Configurações (demonstra o toggle de tema claro ↔ escuro)
14. 🪪 Perfil próprio
15. 🛡️ Painel administrativo
16. 👋 Logout + tela "Tour finalizado"

Configuração isolada em `playwright.tour.config.ts` (não interfere no `test:e2e`). Cada parada usa `trySection()` — se um elemento opcional não existir, o tour pula e continua, **nunca quebra** uma demo ao vivo. Os overlays são injetados via `page.evaluate` com `z-index: 2147483647`, ficando sobre toda a UI da SPA.

## CI

`.github/workflows/ci.yml` roda os três conjuntos em paralelo a cada push/PR:
- **backend** — `npm run test:cov` (gate de cobertura 100%);
- **frontend** — `npm run test:cov` (gate 100%);
- **e2e** — instala navegadores, sobe a stack e roda o Playwright, publicando o relatório como artefato.

## Estrutura dos testes

```
backend/
  tests/
    global-setup.ts        # prisma db push no banco de teste
    setup.ts               # resetDb() antes de cada teste
    helpers/               # db, factories, supertest app
    unit/                  # funções puras, schemas, middlewares, rate-limit, reset-token, facade realtime
    integration/           # uma spec por módulo (auth, auth-password, users, requests, wallet, admin, account-deletion, inactive-users, realtime, ...)
frontend/
  tests/
    setup.ts               # jsdom, mocks, jest-dom, scrollTo stub
    unit/                  # format, api, realtime, files
    contexts/              # AuthContext, ToastContext (renderHook + wrapper)
    hooks/                 # useRealtime, useTheme
    components/            # guards, AppLayout, ScrollToTop, UserCard, ui
e2e/
  support/auth.ts          # helper de login
  snapshots/               # screenshots gerados pelo spec responsive (ignorado no git)
  specs/                   # auth, navigation, wallet, password-reset, settings, admin, realtime-chat, demo-walkthrough, responsive (.e2e.ts)
  tour/guided-tour.ts      # demo guiada com narração visual (npm run tour)
```
