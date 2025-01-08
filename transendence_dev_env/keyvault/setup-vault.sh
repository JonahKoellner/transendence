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
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = vault.local
DNS.3 = vault
DNS.4 = hashicorpvault
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

cp $CERT_CRT /usr/local/data/

VAULT_INIT_FILE=/vault/data/init.json

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

# Enable kv secrest engine at secret/ path
vault secrets enable -path=secret kv-v2


# Create a custom policy
cat <<EOF > my_policy.hcl
path "secret/data/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "secret/metadata/*" {
  capabilities = ["list"]
}
EOF
# Write the policy to Vault
echo "Writing policy 'my_policy'..."
vault policy write my_policy my_policy.hcl

# Create a Userpass user with the custom policy
# UI_USERNAME="admin"
# UI_PASSWORD="ui-password"
echo "Creating UI user: $UI_USER"
vault write auth/userpass/users/$UI_USER \
  password=$UI_PASSWORD \
  policies=my_policy

# Set VAULT_TOKEN to the admin user's token
export VAULT_TOKEN=$(vault login -method=userpass username=$UI_USER password=$UI_PASSWORD -format=json | jq -r '.auth.client_token')

# Share VAULT_TOKEN with other service
echo "$VAULT_TOKEN" > /usr/local/data/vault_token.tok

# Set VAULT_CACERT to the CA certificate
export VAULT_CACERT=$CERT_CRT

# echo "42API key: $API_KEY42"
echo "ft secrets $ftUID $ftSecret"

# Write ftUID and ftSecret
vault kv put secret/ft_secrets ft.uid=${ftUID} ft.secret=${ftSecret}

# Write ftSecret
# vault kv put secret/ft_secrets ft.secret=$ftSecret

# Read the secret
# echo "Retrieving secret from \$SECRET_PATH..."
# vault kv get secret/my-secret

# Kill Vault background process
kill $VAULT_PID
echo "Vault setup complete. Ready for use."

# Restart Vault in the foreground
vault server -config=/vault/config/config.hcl &
VAULT_PID=$!

# Wait for Vault to become ready
echo "Waiting for Vault to restart..."
sleep 5

# Unseal Vault after restart
echo "Unsealing Vault after restart..."
for KEY in $UNSEAL_KEYS; do
  vault operator unseal $KEY
done

# Keep Vault running in the foreground
wait $VAULT_PID