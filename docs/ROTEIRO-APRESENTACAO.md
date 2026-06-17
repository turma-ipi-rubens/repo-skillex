# 🎤 Roteiro de Apresentação — SkillEx (TCC)

Guia prático para apresentar a plataforma à banca, com roteiro de demonstração,
pontos-chave e respostas para perguntas prováveis.

---

## ⏱️ Estrutura sugerida (10–15 min)

| Tempo | Etapa |
|-------|-------|
| 1 min | Abertura: o problema e a ideia |
| 2 min | Visão geral e tecnologias |
| 5 min | **Demonstração ao vivo** |
| 3 min | Algoritmo de match (diferencial técnico) |
| 2 min | Segurança, arquitetura e melhorias futuras |
| — | Perguntas |

---

## 1. Abertura (o problema)

> "Aprender uma nova habilidade costuma ser caro e nem sempre encontramos a pessoa
> certa para ensinar. Ao mesmo tempo, todos nós sabemos algo que poderia ser ensinado.
> A **SkillEx** conecta essas duas pontas: você ensina o que sabe e aprende o que
> deseja, **trocando habilidades** — ou pagando com uma moeda interna quando não há
> troca direta."

Exemplo de ouro: **"quem sabe violino e quer aprender tricô encontra quem sabe tricô e
quer aprender violino"**.

## 2. Visão geral e stack

- Plataforma **web, mobile-first**, inspirada em redes sociais.
- **Back-end:** Node.js + TypeScript + Express + Prisma + SQLite + socket.io.
- **Front-end:** React + TypeScript + SCSS (SPA) + PWA, com tema claro/escuro.
- **Vídeo chamada:** Jitsi Meet **self-hosted** (sala embutida via JWT — nada
  passa pela Jitsi.org).
- **Segurança:** JWT, senhas com *hash* bcrypt, validação com Zod, *rate limit*
  por IP, proteção contra SQL Injection e XSS.
- **Qualidade:** cobertura de testes 100% (Vitest + Supertest + Playwright E2E).

## 3. Roteiro de demonstração ao vivo

> Deixe o **backend** (`npm run dev`) e o **frontend** (`npm run dev`) já rodando.

1. **Login** como `bruno@skillex.com` / `senha123`.
2. **Feed** — mostre a **Ana no topo com score 100** e o selo *Match perfeito*.
   Explique o banner "vocês podem ensinar um ao outro".
3. **Tema escuro** — toque no ícone 🌙 no topo para mostrar o *dark mode*.
4. **Perfil da Ana** — destaque a seção **Compatibilidade**, as habilidades que ela
   ensina/quer aprender e as **avaliações**.
5. **Solicitar troca** — proponha "Tricô por Violino", envie e mostre a solicitação
   criada.
6. **Trocar de usuário** — faça login como `ana@skillex.com` (em outro navegador
   ou aba anônima) e **aceite** a solicitação; mostre o **chat em tempo real**
   (a mensagem aparece nos dois navegadores sem reload) e o botão **Concluir**.
7. **Vídeo chamada** — clique **Iniciar vídeo chamada** no detalhe da solicitação
   aceita; mostre a sala Jitsi embutida (self-hosted, sem chamar a Jitsi.org)
   carregando com JWT — e o outro participante recebendo o alerta ao vivo.
8. **Avaliação** — após concluir, dê uma nota de 1 a 5 estrelas.
9. **Carteira** — mostre o saldo, o **histórico de transações** e a recarga de moedas.
10. **Busca** — filtre por uma habilidade (ex.: "Inglês") e mostre os filtros avançados.
11. **Denúncia** — abra um perfil, clique em *Denunciar*, escolha o motivo e envie.
12. **Painel admin** (logado como Ana) — mostre o **dashboard com gráficos**
    (KPIs, séries temporais, distribuições), a aba **Denúncias** com a denúncia
    recém-criada e o **CRUD** de categorias/habilidades.
13. **Swagger UI** — abra `http://localhost:3333/api-docs` para mostrar a
    documentação interativa da API.

## 4. Diferencial técnico: o algoritmo de match

Mostre o arquivo `backend/src/modules/match/match.algorithm.ts` e explique:

- Pontuação **0–100** com **7 critérios ponderados** (reciprocidade vale 50).
- É uma **função pura**, fácil de testar e explicar.
- Demonstre o cálculo do exemplo Ana ↔ Bruno chegando a **100** (slide da
  [documentação](DOCUMENTACAO-TCC.md#9-algoritmo-de-match)).

## 5. Arquitetura e segurança (encerramento)

- **Cliente-Servidor** com **API REST** e **camadas** (rotas → controllers → services
  → Prisma).
- **Organização modular** por funcionalidade.
- **Boas práticas de segurança** (cite 3–4: hash de senha, JWT, Zod, Prisma contra SQL
  Injection).
- **Melhorias futuras**: pagamentos reais, notificações push (Web Push),
  gravação de vídeo chamada (Jibri sobre a stack Jitsi já existente),
  geolocalização e app nativo.

---

## ❓ Perguntas prováveis da banca (e respostas)

**Por que SQLite e não MySQL/PostgreSQL?**
> Para um projeto acadêmico que precisa rodar localmente com simplicidade, o SQLite
> dispensa servidor de banco. Como uso o **Prisma**, a migração para PostgreSQL exige
> apenas trocar o *datasource* — a aplicação não muda.

**Como o sistema garante a segurança das senhas?**
> As senhas nunca são armazenadas em texto puro: uso **bcrypt** para gerar um *hash*
> com *salt*. A autenticação é feita com **JWT**.

**Como você evita SQL Injection?**
> O **Prisma** usa consultas parametrizadas por padrão. Não há concatenação de SQL com
> dados do usuário.

**Como funciona a reserva de moedas?**
> Ao solicitar uma aula paga, as moedas saem do saldo disponível e vão para um **saldo
> bloqueado** (LOCK). Se a solicitação é recusada/cancelada, há **estorno** (UNLOCK); se
> concluída, são **transferidas ao professor** (EARNING). Tudo dentro de uma
> **transação** para garantir consistência.

**O algoritmo de match escala?**
> No MVP, os candidatos são pontuados em memória — simples e didático. Para escala,
> a evolução natural é pré-filtrar por habilidade no SQL e paginar no banco, mantendo a
> mesma função de pontuação.

**Por que React e não um framework mais simples?**
> A interface tem estado complexo em vários níveis: sessão do usuário, notificações em
> tempo real, filtros de busca na URL e wizard de onboarding. **React 18** com
> **Context API + hooks** organiza isso de forma declarativa e testável. O **React Router
> v6** fornece URLs limpas (BrowserRouter), e os testes com **React Testing Library**
> cobrem 100% da lógica sem depender de renderização no DOM real — o que seria
> inviável com template strings e `innerHTML`.

**Como você gerencia o estado global?**
> Usei **Context API** com dois providers: `AuthContext` (sessão, token, status de boot,
> connect/disconnect do socket) e `ToastContext` (notificações e diálogos de confirmação
> *promise-based*). Para estado de servidor uso `useState + useEffect + fetch` por
> componente. Não há Zustand/Redux — a complexidade não justificava.

---

## ✅ Checklist antes de apresentar

- [ ] Backend rodando (`http://localhost:3333/health` responde)
- [ ] Frontend rodando (`http://localhost:5173`)
- [ ] Banco populado (`npm run seed`)
- [ ] Internet ativa (fotos de perfil via *pravatar*)
- [ ] Testar o login do Bruno e ver o score 100 no feed
- [ ] **Stack Jitsi de pé** (`docker compose -f docker-compose.yml -f compose.jitsi.yml up -d`) e `127.0.0.1 jitsi.localhost` no arquivo `hosts` — necessário para o passo da vídeo chamada
- [ ] Swagger UI acessível em `http://localhost:3333/api-docs`
- [ ] Slides com os diagramas da [documentação](DOCUMENTACAO-TCC.md)
