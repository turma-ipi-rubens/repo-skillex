# 🔄 SkillEx — Plataforma de Troca de Habilidades

> Projeto de TCC — Curso de Desenvolvimento de Sistemas.
> Rede social colaborativa onde pessoas **ensinam e aprendem habilidades entre si** (Skill Exchange), com sistema de match inteligente e moeda interna.

![status](https://img.shields.io/badge/status-MVP%20funcional-orange)
![stack](https://img.shields.io/badge/stack-React%20%7C%20Node%20%7C%20TypeScript%20%7C%20Express%20%7C%20Prisma%20%7C%20Socket.IO%20%7C%20Jitsi%20%7C%20SQLite-blue)

---

## 📖 Sobre

A **SkillEx** conecta pessoas com conhecimentos complementares. Exemplo clássico:
uma pessoa sabe **violino** e quer aprender **tricô**; outra sabe **tricô** e quer aprender
**violino** → a plataforma detecta o **match perfeito** e sugere a troca. Quem não tem uma
habilidade compatível pode pagar a aula com a **moeda interna (SkillCoins)**.

## 🧱 Arquitetura

```
┌──────────────────────┐      HTTP/JSON + JWT      ┌──────────────────────┐
│   Frontend (SPA)     │  ───────────────────────► │   Backend (API REST) │
│  React + TS + SCSS   │                           │   Express + TS       │
│  PWA · mobile-first  │  ◄─────────────────────── │   Prisma ORM         │
└──────────────────────┘   WebSocket (socket.io)   └──────────┬───────────┘
                                                              │
                                                       ┌──────▼───────┐
                                                       │   SQLite     │
                                                       └──────────────┘
```

## 🗂️ Estrutura do repositório

| Pasta / arquivo | Descrição |
|-----------------|-----------|
| `backend/`  | API REST (Express + Prisma + SQLite + socket.io + Swagger UI) |
| `frontend/` | Aplicação SPA (React + Vite + TypeScript + SCSS + PWA) |
| `e2e/`      | Testes end-to-end (Playwright) e *tour* guiado para a banca |
| `scripts/`  | Utilitários (`deploy.sh` de Docker, gerador de ícones PWA) |
| `docs/`     | Documentação técnica e acadêmica do TCC |
| `docker-compose.yml` · `compose.jitsi.yml` | Stack principal + stack opcional Jitsi self-hosted (vídeo chamada) |
| `.env.example` | Template **único** de variáveis lido pelo backend e pelo Docker Compose |

## 🚀 Como rodar (resumo)

```bash
# 1. Backend
cd backend
npm install
npm run db:setup     # cria banco, aplica migrations e popula com dados fictícios
npm run dev          # API em http://localhost:3333

# 2. Frontend (em outro terminal)
cd frontend
npm install
npm run dev          # App em http://localhost:5173
```

> Instruções completas de instalação, contas de teste e detalhes de cada módulo estão em [`docs/`](docs/).

## ✨ Funcionalidades

- Cadastro, login e autenticação segura (JWT + bcrypt)
- Alteração e recuperação de senha (token de uso único)
- Onboarding guiado em etapas
- Cadastro de habilidades que ensina e que deseja aprender
- Feed social priorizado por compatibilidade
- Busca avançada com filtros
- **Algoritmo de match inteligente** (pontuação 0–100)
- Solicitações de troca e de aula paga
- Carteira e moeda interna (SkillCoins) com histórico
- Avaliações e reputação
- Notificações, favoritos e chat **em tempo real** (WebSocket via socket.io)
- **Vídeo chamada** integrada nas trocas aceitas (Jitsi Meet self-hosted, JWT)
- **Sistema de denúncias** (assédio, golpe, perfil falso, spam) com moderação no painel admin
- Painel administrativo completo: dashboard com gráficos, gestão de usuários, categorias, habilidades e denúncias
- Exclusão de conta com anonimização de dados (LGPD)
- Segurança reforçada (helmet + rate limiting por IP configurável via env)
- **Documentação interativa da API** com Swagger UI em `/api-docs`
- **PWA instalável** no celular e no desktop (vite-plugin-pwa)
- Tema claro/escuro · design mobile-first
- **Cobertura de testes 100%** (Vitest unitário + integração + Playwright E2E + *tour* narrado)

## 👥 Integrantes do Grupo

| Nome | GitHub |
|------|--------|
| Geovane Alves da Silva | [@geovanelvs](https://github.com/geovanelvs) |
| Guilherme Otavio Amantino Vieira | [@guilhermevieirao](https://github.com/guilhermevieirao) |
| Gustavo Henrique Felix Nobre Leal | [@Gustavoleal007](https://github.com/Gustavoleal007) |
| Pablo Henrique de Jesus de Oliveira | [@pablohenriquejs](https://github.com/pablohenriquejs) |
| Valéria Martins dos Santos | [@Valmartinssantos](https://github.com/Valmartinssantos) |
| Vanessa Martins dos Santos | [@Vans-n](https://github.com/Vans-n) |

## 🎓 Orientador

**Rubens Lemos da Cruz Junior** — [@snebur84](https://github.com/snebur84)

## 📜 Licença

Projeto acadêmico desenvolvido para fins educacionais no curso Técnico em Desenvolvimento de Sistemas do SENAI.
