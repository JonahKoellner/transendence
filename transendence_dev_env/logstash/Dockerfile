FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    wget \
    apt-transport-https \
    openjdk-17-jdk-headless \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Add Elastic GPG key and repository
RUN wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | gpg --dearmor > /usr/share/keyrings/elasticsearch.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/elasticsearch.gpg] https://artifacts.elastic.co/packages/8.x/apt stable main" > /etc/apt/sources.list.d/elastic-8.x.list

# Install Logstash
RUN apt-get update && apt-get install -y logstash && rm -rf /var/lib/apt/lists/*

# Copy pipeline configuration
COPY logstash.conf /usr/share/logstash/pipeline/logstash.conf

# Expose port for beats input
EXPOSE 5000

# Default command
CMD /bin/sh -c logstash -f /usr/share/logstash/pipeline/logstash.conf
# CMD ["logstash", "-f", "/usr/share/logstash/pipeline/logstash.conf"]
