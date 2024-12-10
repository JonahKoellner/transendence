#!/bin/bash

# CERTS_DIR="/usr/share/kibana/shared/certs"
# CA_CERT="$CERTS_DIR/elastic-stack-ca/ca/ca.crt"
# KIBANA_CERTS_DIR="$CERTS_DIR/kibana-certs"
# Wait for the service token file to be available
echo "Waiting for service token..."
until [ -f /usr/share/kibana/shared/token.tok ]; do
  sleep 5
  echo "Waiting for service token file..."
done
SERVICE_TOKEN=$(cat /usr/share/kibana/shared/token.tok)

# Update kibana.yml with the service token
# echo "elasticsearch.serviceAccountToken: \"$SERVICE_TOKEN\"" >> /usr/share/kibana/config/kibana.yml

mkdir -p /usr/share/kibana/config/certs/ca
cp /usr/share/kibana/shared/elastic-stack-ca/ca/ca.crt /usr/share/kibana/config/certs/ca.crt

# # Update kibana.yml
# echo "elasticsearch.hosts: [\"https://elasticsearch:9200\"]" >> /usr/share/kibana/config/kibana.yml
# echo "elasticsearch.serviceAccountToken: $SERVICE_TOKEN" >> /usr/share/kibana/config/kibana.yml
# echo "elasticsearch.ssl.certificateAuthorities: [\"$CA_CERT\"]" >> /usr/share/kibana/config/kibana.yml
# echo "elasticsearch.ssl.verificationMode: full" >> /usr/share/kibana/config/kibana.yml
# echo "server.ssl.enabled: true" >> /usr/share/kibana/config/kibana.yml
# echo "server.ssl.certificate: $KIBANA_CERTS_DIR/kibana.crt" >> /usr/share/kibana/config/kibana.yml
# echo "server.ssl.key: $KIBANA_CERTS_DIR/kibana.key" >> /usr/share/kibana/config/kibana.yml

cat <<EOL >> /usr/share/kibana/config/kibana.yml
elasticsearch.hosts: ["https://elasticsearch:9200"]
elasticsearch.serviceAccountToken: "$SERVICE_TOKEN"
elasticsearch.ssl.certificateAuthorities: ["/usr/share/kibana/config/certs/ca.crt"]
elasticsearch.ssl.verificationMode: none

server.host: "0.0.0.0"
server.name: "kibana"
server.port: 5601
server.ssl.enabled: true
server.ssl.certificate: "/usr/share/kibana/shared/kibana-certs/kibana/kibana.crt"
server.ssl.key: "/usr/share/kibana/shared/kibana-certs/kibana/kibana.key"
server.ssl.keyPassphrase: "KibanaCert"

xpack.security.enabled: true
EOL

chown kibana:kibana /usr/share/kibana/config/kibana.yml
chmod 600 /usr/share/kibana/config/kibana.yml

# Start Kibana
exec bin/kibana
