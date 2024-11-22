# FROM debian:bullseye-slim

# WORKDIR /usr/share/elasticsearch

# RUN apt-get update && apt-get install -y wget && \
#     wget https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.10.2-linux-x86_64.tar.gz && \
#     tar -xzf elasticsearch-8.10.2-linux-x86_64.tar.gz --strip-components=1 && \
#     rm elasticsearch-8.10.2-linux-x86_64.tar.gz && \
#     apt-get clean

# CMD ["bin/elasticsearch"]
# Start from a slim Debian base image
FROM debian:bullseye-slim

# Set the working directory
WORKDIR /usr/share/elasticsearch

# Update and install required dependencies
RUN apt-get update && apt-get install -y wget && \
    wget https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.10.2-linux-aarch64.tar.gz && \
    tar -xzf elasticsearch-8.10.2-linux-aarch64.tar.gz --strip-components=1 && \
    rm elasticsearch-8.10.2-linux-aarch64.tar.gz && \
    apt-get clean

# Create a non-root user for Elasticsearch (UID 1000 is commonly used)
RUN groupadd -g 1000 elasticsearch && \
    useradd -u 1000 -g elasticsearch elasticsearch && \
    # Set ownership of the installed Elasticsearch files to the non-root user
    chown -R elasticsearch:elasticsearch /usr/share/elasticsearch

# Switch to the non-root user
USER elasticsearch

# Expose necessary ports
EXPOSE 9200 9300

# Command to run Elasticsearch
CMD ["bin/elasticsearch"]