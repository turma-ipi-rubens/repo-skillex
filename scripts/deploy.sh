#!/usr/bin/env bash
# =============================================================================
#  SkillEx — Script de deploy via Docker Compose
# -----------------------------------------------------------------------------
#  Uso:
#    ./scripts/deploy.sh provision  # VPS Ubuntu virgem: bootstrap + up
#    ./scripts/deploy.sh bootstrap  # instala Docker, ufw, etc. (precisa sudo)
#    ./scripts/deploy.sh up         # build + sobe a stack
#    ./scripts/deploy.sh down       # derruba (preserva volumes)
#    ./scripts/deploy.sh rebuild    # reconstrói imagens do zero
#    ./scripts/deploy.sh logs       # acompanha os logs
#    ./scripts/deploy.sh status     # mostra status dos containers
#    ./scripts/deploy.sh clean      # APAGA tudo (containers, volumes, imagens)
# =============================================================================

set -euo pipefail

# ─── Localiza a raiz do projeto ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ─── Cores ────────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  C_BLUE="\033[1;34m"; C_GREEN="\033[1;32m"; C_YELLOW="\033[1;33m"
  C_RED="\033[1;31m";  C_DIM="\033[2m";      C_OFF="\033[0m"
else
  C_BLUE=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_DIM=""; C_OFF=""
fi

log()   { printf "${C_BLUE}▸${C_OFF} %s\n" "$*"; }
ok()    { printf "${C_GREEN}✓${C_OFF} %s\n" "$*"; }
warn()  { printf "${C_YELLOW}!${C_OFF} %s\n" "$*"; }
fail()  { printf "${C_RED}✗${C_OFF} %s\n" "$*" >&2; exit 1; }

# ─── Helper: sudo (vazio se já for root) ─────────────────────────────────────
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  fi
fi

# ─── Pré-checagens ───────────────────────────────────────────────────────────
check_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    fail "Docker não encontrado — rode: ./scripts/deploy.sh bootstrap"
  fi
  if ! docker info >/dev/null 2>&1; then
    fail "Docker daemon não está acessível — verifique se o serviço está rodando (sudo systemctl status docker) e se seu usuário está no grupo 'docker'"
  fi
  if ! docker compose version >/dev/null 2>&1; then
    fail "Docker Compose v2 não está disponível — rode: ./scripts/deploy.sh bootstrap"
  fi
}

ensure_env_file() {
  if [ ! -f .env ]; then
    if [ -f .env.docker ]; then
      cp .env.docker .env
      ok "Arquivo .env criado a partir de .env.docker"
      # Gera JWT_SECRET aleatório se openssl estiver disponível e estivermos com o placeholder
      if command -v openssl >/dev/null 2>&1 && grep -q "CHANGE-ME" .env; then
        local secret
        secret="$(openssl rand -hex 32)"
        # Usa um delimitador diferente de "/" para não conflitar com o valor
        sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=${secret}|" .env && rm -f .env.bak
        ok "JWT_SECRET aleatório gerado e gravado em .env"
      else
        warn "Edite .env e defina um JWT_SECRET forte antes de expor em produção"
      fi
    else
      fail "Nem .env nem .env.docker foram encontrados na raiz"
    fi
  fi
}

# ─── Bootstrap (provisiona uma VPS Ubuntu/Debian virgem) ─────────────────────
detect_os() {
  if [ ! -r /etc/os-release ]; then
    fail "/etc/os-release não encontrado — bootstrap só suporta Ubuntu/Debian"
  fi
  # shellcheck disable=SC1091
  . /etc/os-release
  case "${ID:-}" in
    ubuntu|debian) OS_ID="$ID"; OS_CODENAME="${VERSION_CODENAME:-}" ;;
    *) fail "Distribuição '$ID' não suportada pelo bootstrap (use Ubuntu ou Debian)" ;;
  esac
}

cmd_bootstrap() {
  detect_os
  log "Provisionando $OS_ID ($OS_CODENAME) — isto vai instalar Docker e dependências"

  if [ -z "$SUDO" ] && [ "$(id -u)" -ne 0 ]; then
    fail "bootstrap precisa de privilégios — instale sudo ou rode como root"
  fi

  log "Atualizando índices apt..."
  $SUDO apt-get update -y

  log "Instalando utilitários básicos..."
  $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y \
    ca-certificates curl gnupg git openssl ufw

  # Docker — instalação pelo repositório oficial (recomendada)
  if command -v docker >/dev/null 2>&1; then
    ok "Docker já instalado ($(docker --version))"
  else
    log "Adicionando repositório oficial do Docker..."
    $SUDO install -m 0755 -d /etc/apt/keyrings
    if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
      curl -fsSL "https://download.docker.com/linux/${OS_ID}/gpg" \
        | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      $SUDO chmod a+r /etc/apt/keyrings/docker.gpg
    fi
    local arch; arch="$(dpkg --print-architecture)"
    echo "deb [arch=${arch} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${OS_ID} ${OS_CODENAME} stable" \
      | $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null

    log "Instalando docker-ce + plugin compose..."
    $SUDO apt-get update -y
    $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y \
      docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    ok "Docker instalado ($(docker --version))"
  fi

  log "Habilitando serviço docker no boot..."
  $SUDO systemctl enable --now docker

  # Adiciona o usuário invocador ao grupo docker (para usar sem sudo)
  local target_user="${SUDO_USER:-$USER}"
  if [ -n "$target_user" ] && [ "$target_user" != "root" ]; then
    if ! id -nG "$target_user" | tr ' ' '\n' | grep -qx docker; then
      $SUDO usermod -aG docker "$target_user"
      warn "Usuário '$target_user' adicionado ao grupo 'docker' — faça logout/login (ou 'newgrp docker') para aplicar"
    else
      ok "Usuário '$target_user' já está no grupo docker"
    fi
  fi

  # Firewall — libera SSH/HTTP/HTTPS, habilita só se ainda não estiver ativo
  if command -v ufw >/dev/null 2>&1; then
    log "Configurando firewall (UFW)..."
    $SUDO ufw allow OpenSSH >/dev/null || $SUDO ufw allow 22/tcp >/dev/null
    $SUDO ufw allow 80/tcp >/dev/null
    $SUDO ufw allow 443/tcp >/dev/null
    if ! $SUDO ufw status | grep -q "Status: active"; then
      $SUDO ufw --force enable
      ok "UFW ativado (portas 22, 80, 443 liberadas)"
    else
      ok "UFW já ativo — regras 22/80/443 garantidas"
    fi
  fi

  ok "Bootstrap concluído"
  echo
  printf "${C_DIM}  Próximo passo: ./scripts/deploy.sh up${C_OFF}\n"
  if [ -n "$target_user" ] && [ "$target_user" != "root" ] && \
     ! id -nG "$target_user" 2>/dev/null | tr ' ' '\n' | grep -qx docker; then
    printf "${C_DIM}  (se 'docker' pedir sudo, faça logout/login antes)${C_OFF}\n"
  fi
}

# ─── Espera o backend ficar healthy ──────────────────────────────────────────
wait_for_backend() {
  log "Aguardando backend ficar saudável..."
  local container max=60 i=0 health
  container="$(docker compose ps -q backend)"
  [ -n "$container" ] || fail "Container do backend não foi criado"

  while [ $i -lt $max ]; do
    health="$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo unknown)"
    case "$health" in
      healthy)  ok "Backend saudável"; return 0 ;;
      unhealthy) fail "Backend ficou unhealthy — veja: docker compose logs backend" ;;
      *) printf "${C_DIM}  status: %s (%ds)\r${C_OFF}" "$health" "$((i*2))"; sleep 2; i=$((i+1)) ;;
    esac
  done
  fail "Timeout aguardando backend — veja: docker compose logs backend"
}

# ─── Imprime URLs de acesso ──────────────────────────────────────────────────
print_urls() {
  echo
  ok "Stack pronta!"
  printf "  ${C_GREEN}Aplicação:${C_OFF}   http://localhost\n"
  printf "  ${C_GREEN}API:${C_OFF}         http://localhost:3333\n"
  printf "  ${C_GREEN}Healthcheck:${C_OFF} http://localhost:3333/health\n"
  echo
  printf "${C_DIM}  Logs:   ./scripts/deploy.sh logs${C_OFF}\n"
  printf "${C_DIM}  Down:   ./scripts/deploy.sh down${C_OFF}\n"
}

# ─── Comandos ────────────────────────────────────────────────────────────────
cmd_up() {
  check_docker
  ensure_env_file
  log "Build das imagens..."
  docker compose build
  log "Subindo containers..."
  docker compose up -d
  wait_for_backend
  print_urls
}

cmd_down() {
  check_docker
  log "Derrubando containers (volumes preservados)..."
  docker compose down
  ok "Stack derrubada — dados em volumes mantidos"
}

cmd_rebuild() {
  check_docker
  ensure_env_file
  log "Reconstruindo imagens sem cache..."
  docker compose down
  docker compose build --no-cache
  docker compose up -d
  wait_for_backend
  print_urls
}

cmd_logs() {
  check_docker
  docker compose logs -f --tail=100
}

cmd_status() {
  check_docker
  docker compose ps
  echo
  log "Volumes:"
  docker volume ls --filter name=tcc_skillex
}

cmd_clean() {
  check_docker
  warn "Isto vai APAGAR containers, volumes e imagens da stack."
  read -r -p "Confirma? (digite 'sim' para continuar) " ans
  [ "$ans" = "sim" ] || { log "Cancelado"; exit 0; }
  docker compose down -v --rmi local
  ok "Limpeza concluída"
}

cmd_provision() {
  log "Modo provision: bootstrap completo + deploy"
  cmd_bootstrap
  # Se o usuário acabou de ser adicionado ao grupo docker, a sessão atual
  # ainda não tem o grupo aplicado. Tentamos com sg/newgrp; caso contrário,
  # caímos para sudo apenas neste momento.
  if ! docker info >/dev/null 2>&1; then
    if [ -n "$SUDO" ] && $SUDO docker info >/dev/null 2>&1; then
      warn "Sessão atual ainda sem grupo 'docker' — rodando 'up' com sudo só desta vez"
      SUDO_FOR_UP="$SUDO" _provision_up_with_sudo
      return
    fi
  fi
  cmd_up
}

# Variante interna do up que prefixa docker com sudo (usada só no provision
# logo após o bootstrap, antes do logout/login que aplica o grupo).
_provision_up_with_sudo() {
  ensure_env_file
  log "Build das imagens..."
  $SUDO_FOR_UP docker compose build
  log "Subindo containers..."
  $SUDO_FOR_UP docker compose up -d
  log "Aguardando backend ficar saudável..."
  local container max=60 i=0 health
  container="$($SUDO_FOR_UP docker compose ps -q backend)"
  [ -n "$container" ] || fail "Container do backend não foi criado"
  while [ $i -lt $max ]; do
    health="$($SUDO_FOR_UP docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo unknown)"
    case "$health" in
      healthy)   ok "Backend saudável"; print_urls; return 0 ;;
      unhealthy) fail "Backend ficou unhealthy — veja: sudo docker compose logs backend" ;;
      *) printf "${C_DIM}  status: %s (%ds)\r${C_OFF}" "$health" "$((i*2))"; sleep 2; i=$((i+1)) ;;
    esac
  done
  fail "Timeout aguardando backend"
}

usage() {
  sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
}

# ─── Dispatcher ──────────────────────────────────────────────────────────────
case "${1:-}" in
  provision) cmd_provision ;;
  bootstrap) cmd_bootstrap ;;
  up)        cmd_up ;;
  down)      cmd_down ;;
  rebuild)   cmd_rebuild ;;
  logs)      cmd_logs ;;
  status)    cmd_status ;;
  clean)     cmd_clean ;;
  -h|--help|help|"") usage ;;
  *) fail "Comando desconhecido: $1 (use --help)" ;;
esac
