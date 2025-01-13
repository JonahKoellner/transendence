FROM debian:bullseye-slim

# Install necessary packages
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    lsb-release \
    && apt-get clean

RUN echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -

# Install PostgreSQL
RUN apt-get update && apt-get install -y \
    postgresql-17 \
    postgresql-client-17 \
    && apt-get clean

# Create the PostgreSQL data directory
RUN mkdir -p /var/lib/postgresql/data \
    && chown -R postgres:postgres /var/lib/postgresql

# Create the PostgreSQL configuration directory
RUN mkdir -p /etc/postgresql \
    && chown -R postgres:postgres /etc/postgresql

# Copy the custom entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

# Make the entrypoint script executable
RUN chmod +x /usr/local/bin/entrypoint.sh

# Switch to the postgres user
USER postgres

# Initialize the PostgreSQL data directory
RUN /usr/lib/postgresql/17/bin/initdb -D /var/lib/postgresql/data

# Copy the default configuration file to the expected location
RUN cp /var/lib/postgresql/data/postgresql.conf /etc/postgresql/postgresql.conf

# Update the PostgreSQL configuration to log to stdout and listen on all interfaces
RUN echo "logging_collector = off" >> /etc/postgresql/postgresql.conf \
    && echo "log_destination = 'stderr'" >> /etc/postgresql/postgresql.conf \
    && echo "client_min_messages = notice" >> /etc/postgresql/postgresql.conf \
    && echo "log_min_messages = info" >> /etc/postgresql/postgresql.conf \
    && echo "log_min_error_statement = error" >> /etc/postgresql/postgresql.conf \
    && echo "log_min_duration_statement = 0" >> /etc/postgresql/postgresql.conf \
    && echo "listen_addresses = '*'" >> /etc/postgresql/postgresql.conf

# Update the pg_hba.conf file to allow connections from all hosts
RUN echo "host all all 0.0.0.0/0 trust" >> /var/lib/postgresql/data/pg_hba.conf \
    && echo "host all all ::/0 trust" >> /var/lib/postgresql/data/pg_hba.conf

EXPOSE 5432

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/lib/postgresql/17/bin/postgres", "-D", "/var/lib/postgresql/data", "-c", "config_file=/etc/postgresql/postgresql.conf"]