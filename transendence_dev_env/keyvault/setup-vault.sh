#!/bin/bash
set -e

CERT_DIR="/vault/config/tls"
CERT_KEY="$CERT_DIR/vault.key"
CERT_CRT="$CERT_DIR/vault.crt"
CERT_CSR="$CERT_DIR/vault.csr"
CERT_CONF="$CERT_DIR/openssl.cnf"

echo "Generating self-signed TLS certificates with SANs..."

# Create directories
mkdir -p $CERT_DIR

# Generate OpenSSL configuration for SANs
cat > $CERT_CONF <<EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = Denial
L = Springfield
O = Dis
CN = vault.local

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = vault.local
IP.1 = 127.0.0.1
IP.2 = 0.0.0.0
EOF

# Generate private key and certificate signing request
openssl req -new -newkey rsa:2048 -nodes -keyout $CERT_KEY -out $CERT_CSR -config $CERT_CONF

# Generate self-signed certificate
openssl x509 -req -days 365 -in $CERT_CSR -signkey $CERT_KEY -out $CERT_CRT -extensions v3_req -extfile $CERT_CONF

# Set permissions
chmod 600 $CERT_KEY
chmod 644 $CERT_CRT

echo "Certificates generated successfully."

cp $CERT_CRT /usr/local/share/ca-certificates/
echo "Making certificate trusted" && update-ca-certificates || (echo "ERROR trusting cert." && exit 1)

VAULT_INIT_FILE=/vault/data/init.json
SECRET_PATH="secret/data/my-secret"
SECRET_DATA='{"data": {"username": "admin", "password": "supersecret"}}'

# Start Vault in the background
vault server -config=/vault/config/config.hcl &
VAULT_PID=$!

# Wait for Vault to become ready
echo "Waiting for Vault to start..."
sleep 5

# Initialize Vault if not already done
if [ ! -f "$VAULT_INIT_FILE" ]; then
  echo "Initializing Vault..."
  vault operator init -format=json > $VAULT_INIT_FILE
  VAULT_ROOT_TOKEN=$(jq -r ".root_token" $VAULT_INIT_FILE)
  UNSEAL_KEYS=$(jq -r ".unseal_keys_b64[]" $VAULT_INIT_FILE)
  echo "Vault initialized. Root token and unseal keys saved."
else
  echo "Vault already initialized. Using existing keys."
  VAULT_ROOT_TOKEN=$(jq -r ".root_token" $VAULT_INIT_FILE)
  UNSEAL_KEYS=$(jq -r ".unseal_keys_b64[]" $VAULT_INIT_FILE)
fi

# Unseal Vault
echo "Unsealing Vault..."
for KEY in $UNSEAL_KEYS; do
  vault operator unseal $KEY
done

# Export root token
export VAULT_TOKEN=$VAULT_ROOT_TOKEN

# Enable Userpass Authentication
echo "Enabling Userpass authentication method..."
vault auth enable userpass

# Create a Userpass user
#TODO: 
UI_USERNAME="admin"
UI_PASSWORD="ui-password"
echo "Creating UI user: $UI_USERNAME"
vault write auth/userpass/users/$UI_USERNAME password=$UI_PASSWORD policies=default


# Write a secret
# echo "Storing secret at $SECRET_PATH..."
# vault kv put $SECRET_PATH $SECRET_DATA

# Kill Vault background process
kill $VAULT_PID
echo "Vault setup complete. Ready for use."

# Restart Vault in the foreground
exec vault server -config=/vault/config/config.hcl
