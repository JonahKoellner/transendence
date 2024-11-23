#!/bin/bash

# Wait for Elasticsearch to be ready
echo "Waiting for Elasticsearch to be available..."
until curl -s -X GET "http://elasticsearch:9200/_cluster/health" | grep -q '"status":"green"'; do
    echo "Kibana waiting for elasticsearch"
    sleep 5
done

# Retrieve the Kibana service token from Elasticsearch
echo "Retrieving the Kibana service token..."
TOKEN=$(curl -s -u kibana_user:$(KIBANA_USER_PASSWORD) \
    -X GET "http://elasticsearch:9200/_security/service/elastic/kibana/kibana-token" | \
    grep -oP '(?<="token":")[^"]+')

# Update Kibana configuration
echo "elasticsearch.hosts: [\"http://elasticsearch:9200\"]" > /etc/kibana/kibana.yml
echo "elasticsearch.serviceAccountToken: \"$TOKEN\"" >> /etc/kibana/kibana.yml

# Start Kibana
/usr/share/kibana/bin/kibana
