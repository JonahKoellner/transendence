#!/bin/bash
set -e

# Start PostgreSQL in the background
/usr/lib/postgresql/17/bin/pg_ctl -D /var/lib/postgresql/data -o "-c config_file=/etc/postgresql/postgresql.conf" start

# Wait for PostgreSQL to start
until pg_isready -h 127.0.0.1 -U postgres; do
  echo "Waiting for PostgreSQL to start..."
  sleep 2
done

# Create the user and database if they do not exist
psql -v ON_ERROR_STOP=1 --username "postgres" <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$POSTGRES_USER') THEN
      CREATE ROLE "$POSTGRES_USER" LOGIN PASSWORD '$POSTGRES_PASSWORD';
    END IF;
  END
  \$\$;

  CREATE DATABASE "$POSTGRES_DB" OWNER "$POSTGRES_USER";
EOSQL

# Stop PostgreSQL
/usr/lib/postgresql/17/bin/pg_ctl -D /var/lib/postgresql/data -o "-c config_file=/etc/postgresql/postgresql.conf" stop

# Start PostgreSQL in the foreground
exec "/usr/lib/postgresql/17/bin/postgres" "-D" "/var/lib/postgresql/data" "-c" "config_file=/etc/postgresql/postgresql.conf"