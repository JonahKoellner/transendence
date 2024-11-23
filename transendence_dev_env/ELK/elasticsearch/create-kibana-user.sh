#!/bin/bash

# Start Elasticsearch in the background

# su - ela -c "/usr/share/elasticsearch/bin/elasticsearch &"
whoami
/usr/share/elasticsearch/bin/elasticsearch &


sleep 30
# Wait until Elasticsearch is up and running by checking the _cluster/health API
# until curl -s -XGET "http://localhost:9200/_cluster/health" -u elastic:${ELASTIC_PASSWORD} --insecure | grep -q '"status":"green"'; do
#   echo "Waiting for Elasticsearch to start..."
#   sleep 5
# done

# Create a new role for Kibana
# curl -X POST "http://localhost:9200/_security/role/kibana_writer" -H "Content-Type: application/json" -u elastic:${ELASTIC_PASSWORD} --insecure -d '
# {
#   "cluster": ["all"],
#   "index": [
#     {
#       "names": ["*"],
#       "privileges": ["write", "create_index", "manage"]
#     }
#   ]
# }
# '


# Set up a Kibana system user with superuser privileges (optional)
echo "Creating Kibana system user..."
curl -X POST -u elastic:${ELASTIC_PASSWORD} -H "Content-Type: application/json" \
    -d '{"password":"kibana_password", "roles":["kibana_system"], "full_name":"Kibana Service User"}' \
    "http://localhost:9200/_security/user/kibana_user"

# Generate a service token for Kibana
echo "Generating Kibana service token..."
TOKEN=$(bin/elasticsearch-service-tokens create kibana kibana-token | grep 'service_token:' | awk '{print $2}')
echo "Generated service token: $TOKEN"


#DEBUG TESTING
echo "$TOKEN" > /usr/share/elasticsearch/kibana-service-token.txt

# # Create a new user with the required role
# curl -X POST "http://localhost:9200/_security/user/kibana_user" -H "Content-Type: application/json" -u elastic:${ELASTIC_PASSWORD} --insecure -d '
# {
#   "password" : "${KIBANA_USER_PASSWORD}",
#   "roles" : [ "kibana_system", "kibana_writer" ],
#   "full_name" : "kibana",
#   "email" : "kibana_user@example.com"
# }
# '

echo "User creation completed successfully"
wait