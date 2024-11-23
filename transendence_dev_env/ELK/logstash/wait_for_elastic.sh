#!/bin/bash

# Wait for the service token file to be available
function wait_for_elasticsearch() {
  echo "Waiting for Elasticsearch to be ready..."
  until curl -s http://elasticsearch:9200 -o /dev/null; do
    sleep 5
    echo "Retrying..."
  done
  echo "Elasticsearch is ready!"
}

wait_for_elasticsearch
echo "[Logstash] Elasticsearch is ready!"
# bin/logstash -f /usr/share/logstash/pipeline/logstash.conf

bin/logstash -f pipeline
