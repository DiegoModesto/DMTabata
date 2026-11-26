#!/bin/bash
# Publica a imagem do DMTabata web (PWA) no Docker Hub e, se VPS_HOST estiver definido,
# atualiza o container na VPS.
#
#   ./deploy.sh [tag]                       # só build + push
#   VPS_HOST=root@meu-servidor ./deploy.sh  # build + push + atualiza a VPS
#
# Na VPS, /opt/apps/dmtabata/ precisa ter o docker-compose.yml deste repositório.

set -euo pipefail

TAG="${1:-latest}"
IMAGE="diegosanches/dmtabata-web"
STACK_DIR="/opt/apps/dmtabata"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
info() { echo -e "${YELLOW}ℹ $1${NC}"; }

info "Verificando login no Docker Hub..."
if ! docker info 2>/dev/null | grep -q "Username: diegosanches"; then
  docker login
fi
ok "Login verificado"

info "Configurando Docker Buildx..."
docker buildx create --use --name dmtabata-builder 2>/dev/null || docker buildx use dmtabata-builder
ok "Buildx configurado"

# Imagem para linux/amd64, a plataforma da VPS.
info "Construindo ${IMAGE}:${TAG}..."
TAGS=(-t "${IMAGE}:${TAG}")
[ "${TAG}" != "latest" ] && TAGS+=(-t "${IMAGE}:latest")
docker buildx build --platform linux/amd64 "${TAGS[@]}" --push .
ok "${IMAGE} publicada"

if [ -n "${VPS_HOST:-}" ]; then
  info "Atualizando ${VPS_HOST}:${STACK_DIR}..."
  ssh "${VPS_HOST}" "mkdir -p ${STACK_DIR}"
  scp docker-compose.yml "${VPS_HOST}:${STACK_DIR}/docker-compose.yml"
  ssh "${VPS_HOST}" "cd ${STACK_DIR} && docker compose pull && docker compose up -d --remove-orphans"
  ok "VPS atualizada"
else
  echo ""
  info "Para atualizar o servidor:"
  echo "  VPS_HOST=root@<servidor> ./deploy.sh   (ou, no servidor: cd ${STACK_DIR} && docker compose pull && docker compose up -d)"
fi
