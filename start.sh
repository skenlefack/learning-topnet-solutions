#!/usr/bin/env bash
###############################################################################
# ARIS Academy — Platform Startup Script
# learning.topnet-solutions.com
# Usage: ./start.sh [dev|prod|down|logs|status]
###############################################################################
set -euo pipefail

BOLD="\033[1m"
BLUE="\033[34m"
GOLD="\033[33m"
GREEN="\033[32m"
RED="\033[31m"
RESET="\033[0m"

banner() {
  echo -e "${BLUE}${BOLD}"
  echo "  ╔═══════════════════════════════════════════════════════════╗"
  echo "  ║           TOPNET SOLUTIONS ACADEMY — learning.topnet-solutions.com               ║"
  echo "  ║         Topnet Solutions E-Learning Platform © 2026               ║"
  echo "  ╚═══════════════════════════════════════════════════════════╝"
  echo -e "${RESET}"
}

check_deps() {
  for cmd in docker; do
    if ! command -v "$cmd" &> /dev/null; then
      echo -e "${RED}Error: $cmd is not installed${RESET}"
      exit 1
    fi
  done
  if ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: docker compose plugin is required${RESET}"
    exit 1
  fi
}

setup_env() {
  if [ ! -f .env ]; then
    echo -e "${GOLD}Creating .env from .env.example...${RESET}"
    cp .env.example .env
    echo -e "${GREEN}.env created — edit with production values before deploying${RESET}"
  fi
}

start_dev() {
  banner
  check_deps
  setup_env
  echo -e "${BLUE}Starting ARIS Academy in ${BOLD}development${RESET}${BLUE} mode...${RESET}\n"

  # Start infrastructure first
  echo -e "${GOLD}[1/4] Starting infrastructure (PostgreSQL, Redis, Kafka, MinIO)...${RESET}"
  docker compose up -d postgres redis kafka minio
  echo -e "${GREEN}  ✓ Infrastructure ready${RESET}\n"

  # Wait for health
  echo -e "${GOLD}[2/4] Waiting for services to be healthy...${RESET}"
  sleep 5
  docker compose exec -T postgres pg_isready -U academy -d academy > /dev/null 2>&1 && \
    echo -e "${GREEN}  ✓ PostgreSQL ready${RESET}" || \
    echo -e "${RED}  ✗ PostgreSQL not ready (may need more time)${RESET}"
  docker compose exec -T redis redis-cli ping > /dev/null 2>&1 && \
    echo -e "${GREEN}  ✓ Redis ready${RESET}" || \
    echo -e "${RED}  ✗ Redis not ready${RESET}"
  echo ""

  # Start backend services
  echo -e "${GOLD}[3/4] Starting backend microservices...${RESET}"
  docker compose up -d academy-course academy-learning academy-assessment academy-live
  echo -e "${GREEN}  ✓ academy-course    → http://localhost:4001${RESET}"
  echo -e "${GREEN}  ✓ academy-learning  → http://localhost:4002${RESET}"
  echo -e "${GREEN}  ✓ academy-assessment→ http://localhost:4003${RESET}"
  echo -e "${GREEN}  ✓ academy-live      → http://localhost:4004${RESET}\n"

  # Start frontend + traefik
  echo -e "${GOLD}[4/4] Starting frontend & reverse proxy...${RESET}"
  docker compose up -d frontend traefik
  echo -e "${GREEN}  ✓ Frontend          → http://localhost:3000${RESET}"
  echo -e "${GREEN}  ✓ Traefik Dashboard → http://localhost:8080${RESET}"
  echo -e "${GREEN}  ✓ MinIO Console     → http://localhost:9001${RESET}\n"

  echo -e "${BLUE}${BOLD}═══════════════════════════════════════════════════════════${RESET}"
  echo -e "${GREEN}${BOLD}  ARIS Academy is running!${RESET}"
  echo -e ""
  echo -e "  ${BOLD}Frontend:${RESET}    http://localhost:3000"
  echo -e "  ${BOLD}API:${RESET}         http://localhost:8080/api"
  echo -e "  ${BOLD}Traefik:${RESET}     http://localhost:8080"
  echo -e "  ${BOLD}MinIO:${RESET}       http://localhost:9001"
  echo -e "  ${BOLD}PostgreSQL:${RESET}  localhost:5432"
  echo -e "  ${BOLD}Redis:${RESET}       localhost:6379"
  echo -e "  ${BOLD}Kafka:${RESET}       localhost:9094"
  echo -e ""
  echo -e "  Run ${GOLD}./start.sh logs${RESET} to tail all logs"
  echo -e "  Run ${GOLD}./start.sh status${RESET} to check service health"
  echo -e "  Run ${GOLD}./start.sh down${RESET} to stop everything"
  echo -e "${BLUE}${BOLD}═══════════════════════════════════════════════════════════${RESET}"
}

start_prod() {
  banner
  check_deps
  setup_env
  echo -e "${BLUE}Starting ARIS Academy in ${BOLD}production${RESET}${BLUE} mode...${RESET}\n"
  docker compose --profile production up -d --build
  echo -e "\n${GREEN}${BOLD}Production deployment complete!${RESET}"
  echo -e "  ${BOLD}URL:${RESET} https://learning.topnet-solutions.com"
}

stop_all() {
  banner
  echo -e "${GOLD}Stopping all ARIS Academy services...${RESET}"
  docker compose down
  echo -e "${GREEN}All services stopped.${RESET}"
}

show_logs() {
  docker compose logs -f --tail=50
}

show_status() {
  banner
  echo -e "${BOLD}Service Status:${RESET}\n"
  docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
  echo ""

  echo -e "${BOLD}Health Checks:${RESET}"
  for svc in academy-course:4001 academy-learning:4002 academy-assessment:4003 academy-live:4004; do
    name=$(echo "$svc" | cut -d: -f1)
    port=$(echo "$svc" | cut -d: -f2)
    if curl -sf "http://localhost:$port/health" > /dev/null 2>&1; then
      echo -e "  ${GREEN}✓${RESET} $name ($port)"
    else
      echo -e "  ${RED}✗${RESET} $name ($port)"
    fi
  done
  echo ""
}

# --- Main ---
case "${1:-dev}" in
  dev)    start_dev ;;
  prod)   start_prod ;;
  down)   stop_all ;;
  logs)   show_logs ;;
  status) show_status ;;
  *)
    echo "Usage: $0 [dev|prod|down|logs|status]"
    exit 1
    ;;
esac
