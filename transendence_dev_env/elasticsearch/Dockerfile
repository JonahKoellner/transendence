FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    wget \
    apt-transport-https \
    openjdk-17-jdk-headless \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Add Elasticsearch repository and GPG key
RUN wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | gpg --dearmor > /usr/share/keyrings/elasticsearch.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/elasticsearch.gpg] https://artifacts.elastic.co/packages/8.x/apt stable main" > /etc/apt/sources.list.d/elasticsearch.list

# Install Elasticsearch
RUN apt-get update && apt-get install -y elasticsearch && rm -rf /var/lib/apt/lists/*

# Set up Elasticsearch environment
ENV discovery.type=single-node
EXPOSE 9200 9300

# Copy custom configuration if needed
# ADD elasticsearch.yml /etc/elasticsearch/

CMD /bin/sh -c elasticsearch
