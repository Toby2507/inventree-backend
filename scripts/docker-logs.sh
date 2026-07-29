#!/bin/sh

SERVICE_NAME=$1

# Fetch valid docker compose service names
VALID_SERVICES=$(docker compose config --services 2>/dev/null)

# Throw if service name is not provided
if [ -z "$SERVICE_NAME" ]; then
  echo "❌ Error: You must specify a service name to prevent log-prefix merging confusion."
  echo "Usage: pnpm docker:logs <service_name>"
  echo "\nAvailable services in this project:"
  echo "$VALID_SERVICES" | sed 's/^/  - /'
  exit 1
fi

# Throw if service name is not valid
if ! echo "$VALID_SERVICES" | grep -q "^$SERVICE_NAME$"; then
  echo "❌ Error: Invalid service name '$SERVICE_NAME'."
  echo "Available services in this project:"
  echo "$VALID_SERVICES" | sed 's/^/  - /'
  exit 1
fi

echo "🚀 Streaming logs for service: $SERVICE_NAME"
docker compose logs -f --no-log-prefix $SERVICE_NAME | pnpm exec pino-pretty --config ./.pino-prettyrc