#!/bin/sh

# Default values for DB_HOST and DB_PORT if not provided
DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}

# Wait until PostgreSQL is ready
until nc -z -v -w30 "$DB_HOST" "$DB_PORT"; do
  echo "Waiting for database connection on $DB_HOST:$DB_PORT..."
  sleep 1
done

# Start Daphne
exec "$@"
