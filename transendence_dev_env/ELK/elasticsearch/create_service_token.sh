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

# Check if the ILM policy already exists
POLICY_EXISTS=$(curl -s -X GET "http://localhost:9200/_ilm/policy/logs_policy" | grep -c 'policy')

if [ "$POLICY_EXISTS" -eq 0 ]; then
  echo "Creating ILM policy..."

  # Create ILM policy
  curl -X PUT "http://localhost:9200/_ilm/policy/logs_policy" -H 'Content-Type: application/json' -d'
  {
    "policy": {
      "phases": {
        "hot": {
          "actions": {
            "rollover": {
              "max_size": "50gb",
              "max_age": "30d"
            }
          }
        },
        "warm": {
          "min_age": "30d",
          "actions": {
            "forcemerge": {
              "max_num_segments": 1
            },
            "shrink": {
              "number_of_shards": 1
            }
          }
        },
        "delete": {
          "min_age": "90d",
          "actions": {
            "delete": {}
          }
        }
      }
    }
  }'
  
  echo "ILM policy created."

  echo "Creating index template..."

  # Create index template
  curl -X PUT "http://localhost:9200/_template/logs_template" -H 'Content-Type: application/json' -d'
  {
    "index_patterns": ["logs*"],
    "settings": {
      "number_of_shards": 3,
      "number_of_replicas": 1,
      "index.lifecycle.name": "logs_policy",
      "index.lifecycle.rollover_alias": "logs-write"
    },
    "aliases": {
      "logs-read": {},
      "logs-write": {
        "is_write_index": false
      }
    }
  }'

  echo "Index template created."

  echo "Creating initial index..."

  # Create initial index
  curl -X PUT "http://localhost:9200/logs-000001" -H 'Content-Type: application/json' -d'
  {
    "aliases": {
      "logs-read": {},
      "logs-write": {
        "is_write_index": true
      }
    }
  }'

  echo "Initial index created."
else
  echo "ILM policy already exists. Skipping initialization."
fi

# Generate the service token
SERVICE_TOKEN=$(bin/elasticsearch-service-tokens create elastic/kibana kibana)

# Save the token to a shared file (ensure this volume is shared with Kibana)
# mkdir -p /usr/share/elasticsearch/service_token
# touch /usr/share/elasticsearch/service_token/token.tok
echo "$SERVICE_TOKEN" > /usr/share/elasticsearch/service_token/token.tok

echo "Service token generated and saved to /usr/share/elasticsearch/service_token/token.tok"

wait