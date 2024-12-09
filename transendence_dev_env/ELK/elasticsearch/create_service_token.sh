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

# Update elasticsearch.yml
# echo "xpack.security.enabled: true" >> /usr/share/elasticsearch/config/elasticsearch.yml
# echo "xpack.security.http.ssl.enabled: true" >> /usr/share/elasticsearch/config/elasticsearch.yml
# echo "xpack.security.http.ssl.key: $ELASTIC_CERTS_DIR/elasticsearch.key" >> /usr/share/elasticsearch/config/elasticsearch.yml
# echo "xpack.security.http.ssl.certificate: $ELASTIC_CERTS_DIR/elasticsearch.crt" >> /usr/share/elasticsearch/config/elasticsearch.yml
# echo "xpack.security.http.ssl.certificate_authorities: [\"$CA_CERT\"]" >> /usr/share/elasticsearch/config/elasticsearch.yml
bin/elasticsearch-keystore create
echo "elapwd" | bin/elasticsearch-keystore add "bootstrap.password" --stdin
echo "kibpwd" | bin/elasticsearch-keystore add "xpack.security.authc.realms.native.native1.secure_kibana_system_password" --stdin
echo "logpwd" | bin/elasticsearch-keystore add "xpack.security.authc.realms.native.native1.secure_logstash_system_password" --stdin

# cd /usr/share/elasticsearch

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

# Check if the ILM policy already exists
POLICY_EXISTS=$(curl -k -s -X GET "http://localhost:9200/_ilm/policy/logs_policy" | grep -c 'policy')

if [ "$POLICY_EXISTS" -eq 0 ]; then
  echo "Creating ILM policy..."

  # Create ILM policy
  curl -k -s -X PUT "http://localhost:9200/_ilm/policy/logs_policy" -H 'Content-Type: application/json' -d'
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
  curl -k -s -X PUT "http://localhost:9200/_template/logs_template" -H 'Content-Type: application/json' -d'
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
  curl -k -s -X PUT "http://localhost:9200/logs-000001" -H 'Content-Type: application/json' -d'
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
SERVICE_TOKEN=$(bin/elasticsearch-service-tokens create elastic/kibana kibana | grep -oP '(?<=SERVICE_TOKEN elastic/kibana/kibana = ).*')

# Save the token to a shared file (ensure this volume is shared with Kibana)
# mkdir -p /usr/share/elasticsearch/service_token
# touch /usr/share/elasticsearch/service_token/token.tok
(echo "$SERVICE_TOKEN" > /usr/share/elasticsearch/shared/token.tok && echo "Service token generated and saved to /usr/share/elasticsearch/shared/token.tok") || echo "ERROR storing servicetoken: $SERVICE_TOKEN in /usr/share/elasticsearch/shared/token.tok"



wait