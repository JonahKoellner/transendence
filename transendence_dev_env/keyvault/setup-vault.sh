#!/bin/bash
set -e

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

# Write a secret
echo "Storing secret at $SECRET_PATH..."
vault kv put $SECRET_PATH $SECRET_DATA

# Kill Vault background process
kill $VAULT_PID
echo "Vault setup complete. Ready for use."

# Restart Vault in the foreground
exec vault server -config=/vault/config/config.hcl
