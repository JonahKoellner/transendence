FROM openjdk:17-jdk-slim

WORKDIR /usr/share/logstash

RUN apt-get update && apt-get install -y wget && \
    wget https://artifacts.elastic.co/downloads/logstash/logstash-8.10.2-linux-aarch64.tar.gz && \
    tar -xzf logstash-8.10.2-linux-aarch64.tar.gz --strip-components=1 && \
    rm logstash-8.10.2-linux-aarch64.tar.gz && \
    apt-get clean

COPY pipeline ./pipeline
EXPOSE 5234 5240 5431

CMD ["bin/logstash", "-f", "pipeline"]
