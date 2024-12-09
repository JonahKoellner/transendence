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

mkdir -p /usr/share/logstash/config/certs/ca
cp $CA_CERT /usr/share/logstash/config/certs/ca/ca.crt

# cat <<EOL > /usr/share/logstash/pipeline/logstash.conf
# input {
#   gelf {
#     host => "0.0.0.0"
#     port => 5240
#     use_udp => true
#   }
# }

# filter {
#   if [tag] {
#     mutate {
#       rename => { "tag" => "container_name" }
#       gsub => [
#         "container_name", "^/", ""
#       ]
#     }
#   }
# }

# output {
#   elasticsearch {
#     hosts => ["https://elasticsearch:9200"]
#     cacert => "$CA_CERT"
#     ssl => true
#     # If using authentication, add user and password
#     # user => "logstash_system"
#     # password => "your_password"
#   }
# }
# EOL

bin/logstash -f pipeline
