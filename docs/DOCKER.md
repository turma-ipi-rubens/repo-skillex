# 🐳 Guia Docker — SkillEx

Este guia explica como subir a plataforma **SkillEx** usando **Docker** e **Docker Compose**.
Não exige Node.js instalado no host — tudo roda em containers.

## Pré-requisitos

- **Docker Engine 20.10+** ou **Docker Desktop** ([download](https://www.docker.com/products/docker-desktop/))
- **Docker Compose v2** (já incluso no Docker Desktop)

Verifique a instalação:

```bash
docker --version
docker compose version
```

---

## Arquitetura dos containers

```mermaid
flowchart LR
    U[🌐 Navegador] -->|porta 80| F[🟦 frontend<br/>nginx + SPA]
    F -->|/api · /uploads · /socket.io| B[🟩 backend<br/>Node + Express + Prisma]
    B --> V1[(💾 skillex_data<br/>SQLite)]
    B --> V2[(📁 skillex_uploads<br/>arquivos)]
```

| Serviço | Imagem base | Porta exposta | Volumes |
|---------|-------------|---------------|---------|
| `backend` | `node:20-slim` | `3333` | `skillex_data`, `skillex_uploads` |
| `frontend` | `nginx:1.27-alpine` | `80` | — |

O frontend nginx faz **proxy reverso** para o backend, então o navegador conversa apenas com a porta 80. Banco SQLite e uploads ficam em **volumes nomeados**, sobrevivendo a `docker compose down`.

---

## 1. Subida rápida (recomendado)

Use o script `deploy.sh` na raiz do repositório:

```bash
./scripts/deploy.sh up
```

O script cuida de tudo:
- copia `.env.docker` para `.env` se ainda não existir (e gera um `JWT_SECRET` aleatório);
- faz `docker compose build` + `up -d`;
- aguarda o backend ficar **healthy**;
- imprime as URLs de acesso.

Acesse depois:
- **Aplicação:** http://localhost
- **API:** http://localhost:3333
- **Healthcheck:** http://localhost:3333/health

---

## 1.1 Deploy numa VPS Ubuntu virgem 🆕

Em uma VPS **Ubuntu 20.04/22.04/24.04** (ou Debian 11/12) recém-instalada, sem Docker, sem nada — três comandos:

```bash
# 1. Instala o git (única dependência pra clonar)
sudo apt-get update && sudo apt-get install -y git

# 2. Clona o repositório
git clone <URL-do-repo> /opt/skillex && cd /opt/skillex

# 3. Provisiona o servidor e sobe a aplicação
sudo ./scripts/deploy.sh provision
```

O subcomando **`provision`** faz, na ordem:

1. **`bootstrap`** — `apt-get update`, instala `ca-certificates`, `curl`, `gnupg`, `git`, `openssl`, `ufw`; adiciona o repositório **oficial do Docker**, instala `docker-ce` + `docker compose plugin`; habilita o serviço; adiciona o usuário ao grupo `docker`; libera portas **22/80/443** no UFW e ativa o firewall.
2. **`up`** — cria `.env` com `JWT_SECRET` aleatório, builda e sobe os containers, aguarda `healthy`.

> ⚠️ **Depois do `provision`** faça **logout/login** uma única vez para que seu usuário herde o grupo `docker` (a partir daí o `deploy.sh up` roda sem `sudo`).

Se preferir separar as etapas:

```bash
sudo ./scripts/deploy.sh bootstrap   # só provisiona o SO
# (logout/login)
./scripts/deploy.sh up               # sobe a aplicação
```

### O que o bootstrap NÃO faz

Por design o bootstrap é mínimo. Se você precisa, configure separadamente:

| Item | Como fazer |
|------|-----------|
| Domínio + HTTPS | Adicione Caddy/Traefik na frente, ou `certbot --nginx` numa instância de nginx no host |
| Backups automáticos | `cron` chamando `docker compose exec backend sh -c 'cat /app/data/skillex.db' > /backups/...` |
| Atualizações automáticas | `unattended-upgrades` (`sudo apt install unattended-upgrades`) |
| Monitoramento | Prometheus/Grafana, ou um serviço gerenciado |
| Swap (VPS com pouca RAM) | `fallocate -l 2G /swapfile && mkswap /swapfile && swapon /swapfile` |

---

## 2. Subida manual (passo a passo)

```bash
# 1. Copie o template de variáveis de ambiente
cp .env.docker .env

# 2. (Opcional) Edite .env e defina um JWT_SECRET forte
#    Em produção isto é obrigatório!

# 3. Build das imagens
docker compose build

# 4. Sobe em segundo plano
docker compose up -d

# 5. Acompanhe os logs
docker compose logs -f
```

---

## 3. Variáveis de ambiente

As variáveis ficam em `.env` na raiz (criado a partir de `.env.docker`).

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `JWT_SECRET` | `skillex-docker-secret-CHANGE-ME` | **Mude obrigatoriamente em produção** |
| `JWT_EXPIRES_IN` | `7d` | Tempo de vida do token |
| `MAX_UPLOAD_SIZE_MB` | `5` | Limite de upload em MB |

Para gerar um `JWT_SECRET` forte:

```bash
openssl rand -hex 32
```

---

## 4. Comandos do dia a dia

| Ação | Comando |
|------|---------|
| Subir a stack | `./scripts/deploy.sh up` |
| Derrubar (mantém dados) | `./scripts/deploy.sh down` |
| Reconstruir do zero | `./scripts/deploy.sh rebuild` |
| Ver logs | `./scripts/deploy.sh logs` |
| Ver status | `./scripts/deploy.sh status` |
| Apagar tudo (inclusive volumes) | `./scripts/deploy.sh clean` |

Equivalentes em `docker compose` direto:

```bash
docker compose up -d                  # subir
docker compose down                   # parar (mantém volumes)
docker compose down -v                # parar e APAGAR volumes
docker compose logs -f backend        # logs de um serviço
docker compose ps                     # status
docker compose exec backend sh        # shell dentro do backend
```

---

## 5. Persistência de dados

Dois volumes nomeados persistem o estado:

| Volume | Conteúdo | Caminho no container |
|--------|----------|----------------------|
| `tcc_skillex_data` | Banco SQLite (`skillex.db`) | `/app/data` |
| `tcc_skillex_uploads` | Fotos de perfil e anexos | `/app/uploads` |

Para inspecionar:

```bash
docker volume ls --filter name=tcc_skillex
docker volume inspect tcc_skillex_data
```

Para fazer **backup** do banco:

```bash
docker compose exec backend sh -c 'cat /app/data/skillex.db' > skillex-backup.db
```

> ⚠️ `docker compose down -v` **apaga** os volumes e todos os dados.

---

## 6. Migrations e seed

As migrations do Prisma rodam automaticamente quando o backend inicia (`prisma migrate deploy`). Para **popular o banco** com dados de demonstração:

```bash
docker compose exec backend npx tsx prisma/seed.ts
```

Para **resetar** o banco do zero:

```bash
docker compose down -v && ./scripts/deploy.sh up
```

---

## 7. Solução de problemas

| Sintoma | Diagnóstico / Solução |
|---------|----------------------|
| `Cannot connect to the Docker daemon` | Docker Desktop não está rodando |
| Porta 80 ou 3333 ocupada | Pare o processo conflitante ou edite `docker-compose.yml` |
| Backend fica `unhealthy` | Veja `docker compose logs backend` — geralmente falha de migration |
| `db:up` mas a aplicação não carrega | Confira no navegador o console de rede — pode ser CORS ou `CLIENT_URL` |
| Build muito lento | A primeira vez baixa as imagens base (≈ 200 MB) |
| Mudou o `.env` mas nada mudou | `docker compose up -d` precisa de `--force-recreate` para reler env |

Para investigar um container vivo:

```bash
docker compose exec backend sh
# dentro do container:
ls /app/data
cat /app/prisma/schema.prisma
```

---

## 8. Healthcheck

O backend expõe `/health` e o compose verifica a cada 20s:

```yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost:3333/health"]
  interval: 20s
  timeout: 5s
  retries: 5
  start_period: 30s
```

O frontend só inicia depois que o backend reporta `healthy` (`depends_on.condition: service_healthy`).

---

## 9. Limpeza completa

Quando quiser **zerar tudo** (containers, imagens e dados):

```bash
./scripts/deploy.sh clean

# ou manualmente:
docker compose down -v --rmi local
```
