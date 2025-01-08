#!/bin/bash


# Define the shared volume path
CERTS_DIR="/usr/share/elasticsearch/shared"

# Create the shared volume directory if it doesn't exist
mkdir -p "$CERTS_DIR"

# Change to the certificates directory
# cd "$CERTS_DIR"

# Generate a Certificate Authority (CA)
bin/elasticsearch-certutil ca --pem --out $CERTS_DIR/elastic-stack-ca.zip --pass ""

# Unzip the CA
unzip $CERTS_DIR/elastic-stack-ca.zip -d $CERTS_DIR/elastic-stack-ca

# Generate certificates for Elasticsearch
bin/elasticsearch-certutil cert --name "elasticsearch" --dns "elasticsearch" --ca-cert $CERTS_DIR/elastic-stack-ca/ca/ca.crt --ca-key $CERTS_DIR/elastic-stack-ca/ca/ca.key --pem --out $CERTS_DIR/elasticsearch-certificates.zip --pass "ElasticCert" 

# Generate certificates for Kibana
bin/elasticsearch-certutil cert --name "kibana" --dns "kibana" --ca-cert $CERTS_DIR/elastic-stack-ca/ca/ca.crt --ca-key $CERTS_DIR/elastic-stack-ca/ca/ca.key --pem --out $CERTS_DIR/kibana-certificates.zip --pass "KibanaCert" 

# Generate certificates for Logstash
bin/elasticsearch-certutil cert --name "logstash" --dns "logstash" --ca-cert $CERTS_DIR/elastic-stack-ca/ca/ca.crt --ca-key $CERTS_DIR/elastic-stack-ca/ca/ca.key --pem --out $CERTS_DIR/logstash-certificates.zip --pass "LogstashCert" 

# Unzip the certificates
unzip $CERTS_DIR/elasticsearch-certificates.zip -d $CERTS_DIR/elasticsearch-certs
unzip $CERTS_DIR/kibana-certificates.zip -d $CERTS_DIR/kibana-certs
unzip $CERTS_DIR/logstash-certificates.zip -d $CERTS_DIR/logstash-certs

# Clean up zipped files
rm $CERTS_DIR/*.zip 

ELASTIC_CERTS_DIR="$CERTS_DIR/elasticsearch-certs"
CA_CERT="$CERTS_DIR/elastic-stack-ca/ca/ca.crt"

cp -R $ELASTIC_CERTS_DIR/elasticsearch /usr/share/elasticsearch/config/certs/
mkdir -p /usr/share/elasticsearch/config/certs/ca
cp $CA_CERT /usr/share/elasticsearch/config/certs/ca/ca.crt


bin/elasticsearch-keystore create

# Function to check if Elasticsearch is up
function wait_for_elasticsearch() {
  echo "Waiting for Elasticsearch to be ready..."
  until curl -k -s https://localhost:9200 -o /dev/null; do
    sleep 5
    echo "Retrying..."
  done
  echo "Elasticsearch is ready!"
}

bin/elasticsearch &

# Wait for Elasticsearch to start
wait_for_elasticsearch

# Generate the service token
SERVICE_TOKEN=$(bin/elasticsearch-service-tokens create elastic/kibana kibana | grep -oP '(?<=SERVICE_TOKEN elastic/kibana/kibana = ).*')

bin/elasticsearch-users useradd admin -p $ELASTIC_ADMIN_PASSWORD -r superuser

until curl -k -u admin:$ELASTIC_ADMIN_PASSWORD -X GET "https://localhost:9200/_security/_authenticate?pretty" | grep -q '"username" : "admin"'; do
  echo "Authentication failed or not yet ready for admin. Retrying..."
  sleep 5
done

# Check if the ILM policy already exists
POLICY_EXISTS=$(curl -k -u admin:$ELASTIC_ADMIN_PASSWORD -s -X GET "https://localhost:9200/_ilm/policy/logs_policy" | grep -c 'policy')

if [ "$POLICY_EXISTS" -eq 0 ]; then
  echo "Creating ILM policy..."

  # Create ILM policy
  curl -k -u admin:$ELASTIC_ADMIN_PASSWORD -s -X PUT "https://localhost:9200/_ilm/policy/logs_policy" -H 'Content-Type: application/json' -d'
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
  curl -k -u admin:$ELASTIC_ADMIN_PASSWORD -s -X PUT "https://localhost:9200/_template/logs_template" -H 'Content-Type: application/json' -d'
  {
    "index_patterns": ["logstash*"],
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
  curl -k -u admin:$ELASTIC_ADMIN_PASSWORD -s -X PUT "https://localhost:9200/logs-000001" -H 'Content-Type: application/json' -d'
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


# if [ "$ROLE_EXISTS" -eq 404 ]; then
  echo "Creating logstash_writer role..."
  curl -k -u admin:$ELASTIC_ADMIN_PASSWORD -X PUT "https://localhost:9200/_security/role/logstash_writer" -H 'Content-Type: application/json' -d'
  {
    "cluster": ["monitor"],
    "indices": [
      {
        "names": ["logstash-*", "logs-*"], 
        "privileges": ["write", "create_index", "manage", "auto_configure"]
      }
    ]
  }'
# else
#   echo "logstash_writer role already exists."
# fi

# Create the logstash_writer user with the assigned role
echo "Creating logstash_writer user..."
curl -k -u admin:$ELASTIC_ADMIN_PASSWORD -X POST "https://localhost:9200/_security/user/logstash_writer" -H 'Content-Type: application/json' -d"
{
  \"password\": \"$ELASTIC_LOGSTASH_PASSWORD\",
  \"roles\": [\"logstash_writer\"]
}"
# bin/elasticsearch-users useradd logstash_writer -p "$ELASTIC_LOGSTASH_PASSWORD" -r logstash_writer

echo "logstash_writer user created successfully!"

(echo "$SERVICE_TOKEN" > /usr/share/elasticsearch/shared/token.tok && echo "Service token generated and saved to /usr/share/elasticsearch/shared/token.tok") || echo "ERROR storing servicetoken: $SERVICE_TOKEN in /usr/share/elasticsearch/shared/token.tok"


wait