FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    apt-transport-https \
    && rm -rf /var/lib/apt/lists/*

# Add Elastic GPG key and repository
RUN wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | gpg --dearmor > /usr/share/keyrings/elasticsearch.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/elasticsearch.gpg] https://artifacts.elastic.co/packages/8.x/apt stable main" > /etc/apt/sources.list.d/elastic-8.x.list

# Install Kibana
RUN apt-get update && apt-get install -y kibana && rm -rf /var/lib/apt/lists/*

# Expose Kibana port
EXPOSE 5601

# Default command
CMD /bin/sh -c kibana
