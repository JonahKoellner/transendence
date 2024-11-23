FROM debian:bullseye-slim

# Set the working directory
WORKDIR /usr/share/elasticsearch

ENV ELASTIC_PASSWORD=yourpassword

# Update and install required dependencies
RUN apt-get update && apt-get install -y wget unzip curl && \
    wget https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.10.2-linux-aarch64.tar.gz && \
    tar -xzf elasticsearch-8.10.2-linux-aarch64.tar.gz --strip-components=1 && \
    rm elasticsearch-8.10.2-linux-aarch64.tar.gz && \
    apt-get clean

# Create required directories
RUN mkdir -p /usr/share/elasticsearch/config/certs && \
    mkdir -p /usr/share/elasticsearch/config/ca && \
    chmod -R 777 /usr/share/elasticsearch/config

# Generate the CA (Certificate Authority)
RUN /usr/share/elasticsearch/bin/elasticsearch-certutil ca \
    --silent --pem -out /usr/share/elasticsearch/config/elastic-stack-ca.zip && \
    echo "Elastic Stack CA created, now unzipping..." && \
    unzip /usr/share/elasticsearch/config/elastic-stack-ca.zip -d /usr/share/elasticsearch/config/ca && \
    echo "Unzipped CA files, listing the contents of /usr/share/elasticsearch/config/ca:" && \
    ls -l /usr/share/elasticsearch/config/ca  # Debug step to verify the contents of the CA directory

# Check if CA certificates exist
RUN test -f /usr/share/elasticsearch/config/ca/ca/ca.crt && \
    test -f /usr/share/elasticsearch/config/ca/ca/ca.key && \
    echo "CA certificates exist." || (echo "CA certificates not found!" && exit 1)

# Generate server certificates using the CA
RUN /usr/share/elasticsearch/bin/elasticsearch-certutil cert \
    --silent --pem \
    --ca-cert /usr/share/elasticsearch/config/ca/ca/ca.crt \
    --ca-key /usr/share/elasticsearch/config/ca/ca/ca.key \
    -out /usr/share/elasticsearch/config/elastic-certificates.zip && \
    unzip /usr/share/elasticsearch/config/elastic-certificates.zip -d /usr/share/elasticsearch/config/certs && \
    echo "Unzipped server certificates, listing the contents of /usr/share/elasticsearch/config/certs:" && \
    ls -l /usr/share/elasticsearch/config/certs  # Debug step to verify the contents of the certs directory


# Create a non-root user for Elasticsearch (UID 1000 is commonly used)
RUN groupadd -g 1000 ela && \
    useradd -u 1000 -g ela ela && \
    # Set ownership of the installed Elasticsearch files to the non-root user
    chown -R ela:ela /usr/share/elasticsearch

# Update ownership and permissions to ensure Elasticsearch can read the private key and certs
RUN chown -R ela:ela /usr/share/elasticsearch/config/certs/* && \
    chmod -R 755 /usr/share/elasticsearch/config/certs/* && \
    chmod 600 /usr/share/elasticsearch/config/certs/instance/instance.key && \
    chmod 600 /usr/share/elasticsearch/config/certs/instance/instance.crt

# RUN whoami && ls -l /usr/share/elasticsearch/config/certs/instance
COPY elasticsearch.yml /usr/share/elasticsearch/config/elasticsearch.yml

COPY create-kibana-user.sh /usr/share/elasticsearch/create-user.sh
RUN chmod +x /usr/share/elasticsearch/create-user.sh


# Switch to the non-root user
USER ela
# RUN /usr/share/elasticsearch/create-user.sh


# RUN test -f /usr/share/elasticsearch/config/ca/ca.crt && \
#     test -f /usr/share/elasticsearch/config/ca/ca.key && \
#     echo "CA certificates exist." || (echo "CA certificates not found!" && whoami && ls -l /usr/share/elasticsearch/config/certs/instance && exit 1)

# ENTRYPOINT ["/usr/share/elasticsearch/create-user.sh" ]

# RUN /usr/share/elasticsearch/create-user.sh

# Expose necessary ports
EXPOSE 9200 9300

# Command to run Elasticsearch
CMD ["bin/elasticsearch"]