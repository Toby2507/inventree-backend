#!/bin/sh
set -a
. ./.env
set +a
kysely-codegen --url "$DATABASE_URL" --out-file libs/database/src/db.types.ts