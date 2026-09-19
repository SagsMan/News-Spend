#!/bin/sh

if command -v docker-compose >/dev/null 2>&1; then
  docker-compose up -d
elif command -v docker >/dev/null 2>&1 && docker compose >/dev/null 2>&1; then
  docker compose up -d
else
  echo "Neither docker-compose nor docker compose is installed."
  exit 1
fi
