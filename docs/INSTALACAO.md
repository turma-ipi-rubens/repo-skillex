# 🚀 Guia de Instalação e Execução — SkillEx

Este guia explica como configurar e executar a plataforma localmente.

## Pré-requisitos

- **Node.js 18 ou superior** ([download](https://nodejs.org))
- **npm** (acompanha o Node.js)
- Um navegador moderno (Chrome, Edge, Firefox)

Verifique a instalação:

```bash
node --version
npm --version
```

---

## 1. Backend (API)

A API roda na porta **3333** e usa um banco **SQLite** (criado automaticamente).

> ⚠️ **Importante:** o arquivo `.env` precisa existir **na raiz** antes de
> rodar `npm run db:setup` — os scripts Prisma usam `dotenv-cli` apontando
> para `../.env`. Se você esquecer o `cp`, o Prisma reclama
> `Environment variable not found: DATABASE_URL`.

```bash
# 1. Copie o template de variáveis (UMA vez, na raiz do projeto)
cp .env.example .env

cd backend

# 2. Instalar dependências
npm install

# 3. Criar o banco, aplicar as migrations e popular com dados fictícios
npm run db:setup

# 4. Iniciar a API em modo desenvolvimento
npm run dev
```

A API estará disponível em **http://localhost:3333**.
Teste o *healthcheck*: http://localhost:3333/health
Documentação interativa (Swagger UI): http://localhost:3333/api-docs

> Todas as variáveis de ambiente ficam num **único `.env` na raiz** — o backend o
> lê via `dotenv` e o Docker Compose também. Em produção, gere `JWT_SECRET` e os
> segredos Jitsi com `openssl rand -hex 32`.

### Scripts úteis do backend

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia a API com *hot reload* |
| `npm run db:setup` | Cria o banco + migrations + seed |
| `npm run seed` | Repopula o banco com dados fictícios |
| `npm run db:reset` | Apaga e recria o banco do zero |
| `npm run prisma:studio` | Abre o Prisma Studio (visualizador do banco) |
| `npm run build` | Compila o TypeScript para produção |

---

## 2. Frontend (Interface)

Em **outro terminal**, com a API já rodando:

```bash
cd frontend

# 1. Instalar dependências
npm install

# 2. Iniciar a interface
npm run dev
```

Acesse **http://localhost:5173** no navegador.

> O Vite encaminha automaticamente as chamadas `/api`, `/uploads` e o WebSocket
> `/socket.io` para a porta 3333 (proxy), evitando problemas de CORS.

---

## 3. Contas de teste

Todas as contas usam a senha **`senha123`**.

| E-mail | Papel | Destaque |
|--------|-------|----------|
| `ana@skillex.com` | **Admin** | Ensina Violino, quer Tricô (match perfeito com Bruno) |
| `bruno@skillex.com` | Usuário | Ensina Tricô, quer Violino |
| `carla@skillex.com` | Usuário | Ensina Inglês/Fotografia, quer Programação |
| `diego@skillex.com` | Usuário | Ensina Programação, quer Inglês |
| `lucas@skillex.com` | Usuário | Fotógrafo (recebeu pagamento em moedas) |

> Dica para a banca: faça login como **`bruno@skillex.com`** e abra o **Feed** — a
> **Ana** aparece no topo com **score 100** (match perfeito violino ↔ tricô).

---

## 4. Solução de problemas

| Problema | Solução |
|----------|---------|
| Porta 3333 ocupada | Altere `PORT` no arquivo `.env` da raiz |
| Erro "Cannot find module" | Rode `npm install` na pasta correspondente |
| Banco com dados estranhos | Rode `npm run db:reset` e depois `npm run seed` |
| Tela em branco no front | Verifique se a API (porta 3333) está rodando |
| Fotos de perfil não carregam | As fotos do seed usam o serviço externo *pravatar* (requer internet) |

---

## 5. Build de produção (opcional)

```bash
# Backend
cd backend && npm run build && npm start

# Frontend
cd frontend && npm run build   # gera a pasta dist/
```

---

## 6. Vídeo chamada (opcional, requer Docker)

A vídeo chamada usa uma instância **Jitsi Meet 100% self-hosted**. Para
demonstrá-la localmente:

1. Adicione `127.0.0.1 jitsi.localhost` ao seu arquivo `hosts`.
2. Preencha os 4 segredos Jitsi do `.env` (`JITSI_APP_SECRET`,
   `JITSI_JICOFO_COMPONENT_SECRET`, `JITSI_JICOFO_AUTH_PASSWORD`,
   `JITSI_JVB_AUTH_PASSWORD`) — o `scripts/deploy.sh up` gera todos automaticamente.
3. Suba a stack: `docker compose -f docker-compose.yml -f compose.jitsi.yml up -d`
4. Em `/requests/:id` (solicitação `ACCEPTED`) clique **Iniciar vídeo chamada**.

Detalhes completos em [DOCKER.md](DOCKER.md#9-vídeo-chamada-jitsi-self-hosted).

---

## 7. Testes

Veja [TESTING.md](TESTING.md) para a estratégia completa (Vitest unitário +
integração com banco real e socket.io, e Playwright para E2E). Resumindo:

```bash
# Backend (unitário + integração)
cd backend && npm run test:cov

# Frontend (unitário + componentes)
cd frontend && npm run test:cov

# E2E (na raiz — sobe backend e frontend sozinho)
npm install && npx playwright install chromium && npm run test:e2e
```
