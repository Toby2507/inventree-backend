#!/bin/sh
set -e
echo "Starting $APP_NAME in development mode..."
exec pnpm nest start $APP_NAME --watch