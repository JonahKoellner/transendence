FROM openjdk:17-jdk-slim

WORKDIR /usr/share/logstash

RUN apt-get update && apt-get install -y wget curl && \
    wget https://artifacts.elastic.co/downloads/logstash/logstash-8.10.2-linux-aarch64.tar.gz && \
    tar -xzf logstash-8.10.2-linux-aarch64.tar.gz --strip-components=1 && \
    rm logstash-8.10.2-linux-aarch64.tar.gz && \
    apt-get clean

#COPY pipeline ./pipeline
EXPOSE 5240 5431 5959

COPY wait_for_elastic.sh /usr/share/logstash/wait_for_elastic.sh
RUN chmod +x /usr/share/logstash/wait_for_elastic.sh

# CMD ["bin/logstash", "-f", "pipeline"]
ENTRYPOINT [ "/usr/share/logstash/wait_for_elastic.sh" ]
