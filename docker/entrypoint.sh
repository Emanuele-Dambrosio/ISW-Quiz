#!/bin/sh
set -eu

db_path="${APP_DB_PATH:-/app/runtime/local.db}"
seed_path="${SEED_DB_PATH:-/app/data/seed/isw-quiz.seed.db}"

mkdir -p "$(dirname "$db_path")"

if [ ! -f "$db_path" ]; then
  if [ ! -f "$seed_path" ]; then
    echo "Seed database not found: $seed_path" >&2
    exit 1
  fi

  cp "$seed_path" "$db_path"
  echo "Created runtime database from seed: $db_path"
fi

exec "$@"
