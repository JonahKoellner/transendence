FROM openjdk:17-jdk-slim
WORKDIR /usr/share/elasticsearch
RUN apt-get update && apt-get install -y wget && \
    wget https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.10.0-linux-x86_64.tar.gz && \
    tar -xzf elasticsearch-8.10.0-linux-x86_64.tar.gz --strip-components=1 && \
    rm elasticsearch-8.10.0-linux-x86_64.tar.gz
COPY elasticsearch.yml ./config/
EXPOSE 9200
CMD ["bin/elasticsearch"]
