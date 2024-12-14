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

# Create the base dataview file with index pattern settings
cat <<EOF > /usr/share/kibana/config/kibana_saved_objects.ndjson
{"type":"index-pattern","id":"logstash-*","attributes":{"title":"logstash-*","timeFieldName":"@timestamp"}}
EOF
chown kibana:kibana /usr/share/kibana/config/kibana_saved_objects.ndjson
chmod 644 /usr/share/kibana/config/kibana_saved_objects.ndjson

# Import base dataview before starting Kibana
echo "Importing base dataview..."
curl -k -X POST "https://localhost:5601/api/saved_objects/_import" \
  -H "kbn-xsrf: true" \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  --form file=@/usr/share/kibana/config/kibana_saved_objects.ndjson

# Start Kibana
exec bin/kibana
