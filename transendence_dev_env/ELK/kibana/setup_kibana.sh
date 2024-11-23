#!/bin/bash

# Wait for the service token file to be available
echo "Waiting for service token..."
until [ -f /usr/share/kibana/service_token/token.tok ]; do
  sleep 5
  echo "Waiting for service token file..."
done
SERVICE_TOKEN=$(cat /usr/share/kibana/service_token/token.tok)

# Update kibana.yml with the service token
echo "elasticsearch.serviceAccountToken: $SERVICE_TOKEN" >> /usr/share/kibana/config/kibana.yml

# Start Kibana
exec bin/kibana
