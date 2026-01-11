#!/bin/bash
set -e

# This script runs during PostgreSQL initialization
# It configures authentication to allow password auth from external connections

echo "Setting up PostgreSQL authentication..."

# Add md5 authentication for all external connections
echo "host all all 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"

# Ensure the postgres user has the correct password
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Set postgres user password explicitly
    ALTER USER postgres WITH PASSWORD 'postgres';
    
    -- Log confirmation
    SELECT 'PostgreSQL authentication configured successfully' AS status;
EOSQL

echo "PostgreSQL authentication setup complete"
