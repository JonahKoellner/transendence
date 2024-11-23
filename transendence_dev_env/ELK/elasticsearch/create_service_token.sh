#!/bin/bash

# Function to check if Elasticsearch is up
function wait_for_elasticsearch() {
  echo "Waiting for Elasticsearch to be ready..."
  until curl -s http://localhost:9200 -o /dev/null; do
    sleep 5
    echo "Retrying..."
  done
  echo "Elasticsearch is ready!"
}

bin/elasticsearch &

# Wait for Elasticsearch to start
wait_for_elasticsearch

# Generate the service token
SERVICE_TOKEN=$(bin/elasticsearch-service-tokens create elastic/kibana kibana)

# Save the token to a shared file (ensure this volume is shared with Kibana)
# mkdir -p /usr/share/elasticsearch/service_token
# touch /usr/share/elasticsearch/service_token/token.tok
echo "$SERVICE_TOKEN" > /usr/share/elasticsearch/service_token/token.tok

echo "Service token generated and saved to /usr/share/elasticsearch/service_token/token.tok"

wait