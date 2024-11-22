#!/bin/bash

# Start Elasticsearch in the background

# su - ela -c "/usr/share/elasticsearch/bin/elasticsearch &"
whoami
/usr/share/elasticsearch/bin/elasticsearch &


# sleep 30
# Wait until Elasticsearch is up and running by checking the _cluster/health API
until curl -s -XGET "http://localhost:9200/_cluster/health" -u elastic:${ELASTIC_PASSWORD} --insecure | grep -q '"status":"green"'; do
  echo "Waiting for Elasticsearch to start..."
  sleep 5
done

# Create a new role for Kibana
curl -X POST "http://localhost:9200/_security/role/kibana_writer" -H "Content-Type: application/json" -u elastic:${ELASTIC_PASSWORD} --insecure -d '
{
  "cluster": ["all"],
  "index": [
    {
      "names": ["*"],
      "privileges": ["write", "create_index", "manage"]
    }
  ]
}
'

# Create a new user with the required role
curl -X POST "http://localhost:9200/_security/user/kibana_user" -H "Content-Type: application/json" -u elastic:${ELASTIC_PASSWORD} --insecure -d '
{
  "password" : "${KIBANA_USER_PASSWORD}",
  "roles" : [ "kibana_system", "kibana_writer" ],
  "full_name" : "kibana",
  "email" : "kibana_user@example.com"
}
'

echo "User creation completed successfully"
wait $1