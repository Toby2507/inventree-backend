#!/bin/sh
set -e
echo "Starting $APP_NAME in development mode..."

if [ "$APP_NAME" = "migrator" ]; then
  exec pnpm nest start $APP_NAME
else
  exec pnpm nest start $APP_NAME --watch
fi