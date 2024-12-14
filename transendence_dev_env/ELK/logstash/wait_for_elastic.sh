#!/bin/bash
CERTS_DIR="/usr/share/logstash/shared"
CA_CERT="$CERTS_DIR/elastic-stack-ca/ca/ca.crt"

# Wait for the service token file to be available
function wait_for_elasticsearch() {
  echo "Waiting for Elasticsearch to be ready..."
  until curl -k -s https://elasticsearch:9200 -o /dev/null; do
    sleep 5
    echo "Retrying..."
  done
  echo "Elasticsearch is ready!"
}

wait_for_elasticsearch
echo "[Logstash] Elasticsearch is ready!"
# bin/logstash -f /usr/share/logstash/pipeline/logstash.conf

USER_TO_CHECK="logstash_writer"
ES_HOST="https://elasticsearch:9200"
ES_ADMIN_USER="admin"
ES_ADMIN_PASSWORD="$ELASTIC_ADMIN_PASSWORD"

# Function to check if the user exists
function check_user_exists() {
  curl -k -s -u "$ES_ADMIN_USER:$ES_ADMIN_PASSWORD" "$ES_HOST/_security/user/$USER_TO_CHECK" | grep -q "\"$USER_TO_CHECK\""
}

# Wait for the user to be created
echo "Waiting for user '$USER_TO_CHECK' to be created..."
while ! check_user_exists; do
  sleep 5
  echo "Retrying..."
done

echo "User '$USER_TO_CHECK' has been created."

mkdir -p /usr/share/logstash/config/certs/ca
cp $CA_CERT /usr/share/logstash/config/certs/ca/ca.crt

# SERVICE_TOKEN=$(cat /usr/share/logstash/shared/logstash_token.tok)


# sleep 100
mkdir /usr/share/logstash/pipeline/
cat <<EOL > /usr/share/logstash/pipeline/logstash.conf
input {
  gelf {
    host => "0.0.0.0"
    port => 5240
    use_udp => true
  }
}

filter {
  if [tag] {
    mutate {
      rename => { "tag" => "container_name" }
      gsub => [
        "container_name", "^/", ""
      ]
    }
  }
}

output {
  elasticsearch {
    hosts => ["https://elasticsearch:9200"]
    cacert => "$CA_CERT"
    ssl => true
    user => "logstash_writer"
    password => "$ELASTIC_LOGSTASH_PASSWORD"
    index => "logstash-%{container_name}_container"
  }
}
EOL

bin/logstash -f /usr/share/logstash/pipeline/logstash.conf
