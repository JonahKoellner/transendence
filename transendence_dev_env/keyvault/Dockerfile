# Base image
FROM debian:bullseye

# Environment variables
ENV VAULT_VERSION=1.15.3 \
    VAULT_ADDR=https://0.0.0.0:8200

# Install dependencies and Vault
RUN apt-get update && apt-get install -y --no-install-recommends \
       wget \
       unzip \
       curl \
       ca-certificates \
       gnupg \
       openssl && \
    ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then \
        VAULT_PACKAGE="vault_${VAULT_VERSION}_linux_amd64.zip"; \
    elif [ "$ARCH" = "aarch64" ]; then \
        VAULT_PACKAGE="vault_${VAULT_VERSION}_linux_arm64.zip"; \
    else \
        echo "Unknown architecture: $ARCH"; \
        exit 1; \
    fi && \
    wget https://releases.hashicorp.com/vault/${VAULT_VERSION}/$VAULT_PACKAGE && \
    unzip $VAULT_PACKAGE && \
    mv vault /usr/local/bin/ && \
    chmod +x /usr/local/bin/vault && \
    rm -f $VAULT_PACKAGE && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create Vault directories
RUN mkdir -p /vault/data /vault/config/tls && \
    chmod -R 750 /vault

# Copy configuration and scripts
COPY config.hcl /vault/config/config.hcl
COPY setup-vault.sh /usr/local/bin/setup-vault.sh
RUN chmod +x /usr/local/bin/setup-vault.sh

# Generate self-signed TLS certificates
RUN openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 \
    -subj "/C=US/ST=Denial/L=Springfield/O=Dis/CN=vault.local" \
    -keyout /vault/config/tls/vault.key \
    -out /vault/config/tls/vault.crt && \
    chmod 600 /vault/config/tls/vault.key && \
    chmod 644 /vault/config/tls/vault.crt

# Expose Vault ports
EXPOSE 8200

# Entry point for Vault
CMD ["setup-vault.sh"]
