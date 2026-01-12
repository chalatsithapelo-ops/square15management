#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="/root/square15management"
SECRET_FILE="$BASE_DIR/.secrets/postgres_password"

if [ ! -f "$SECRET_FILE" ]; then
  echo "Missing secret: $SECRET_FILE" >&2
  exit 1
fi

PW="$(cat "$SECRET_FILE")"

# Update application .env
ENV_FILE="$BASE_DIR/.env"
TMP_ENV="$BASE_DIR/.env.tmp"
{
  if [ -f "$ENV_FILE" ]; then
    grep -v '^DATABASE_URL=' "$ENV_FILE" || true
  fi
  echo "DATABASE_URL=postgresql://postgres:${PW}@127.0.0.1:5432/app"
} > "$TMP_ENV"
mv "$TMP_ENV" "$ENV_FILE"

# Update docker/.env (for compose interpolation)
DOCKER_ENV="$BASE_DIR/docker/.env"
TMP_DOCKER_ENV="$BASE_DIR/docker/.env.tmp"
mkdir -p "$BASE_DIR/docker"
{
  if [ -f "$DOCKER_ENV" ]; then
    grep -vE '^(POSTGRES_PASSWORD|LISTEN_IP)=' "$DOCKER_ENV" || true
  fi
  echo 'LISTEN_IP=127.0.0.1'
  echo "POSTGRES_PASSWORD=${PW}"
} > "$TMP_DOCKER_ENV"
awk -F= '!seen[$1]++' "$TMP_DOCKER_ENV" > "$DOCKER_ENV"
rm -f "$TMP_DOCKER_ENV"

# Print masked URL
echo -n "Masked DATABASE_URL: "
grep '^DATABASE_URL=' "$ENV_FILE" | sed -E 's#(postgresql://[^:]+:)[^@]+#\1***#'
