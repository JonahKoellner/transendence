FROM openjdk:17-jdk-slim
WORKDIR /usr/share/logstash
RUN apt-get update && apt-get install -y wget && \
    wget https://artifacts.elastic.co/downloads/logstash/logstash-8.10.2-linux-x86_64.tar.gz && \
    tar -xzf logstash-8.10.2-linux-x86_64.tar.gz --strip-components=1 && \
    rm logstash-8.10.2-linux-x86_64.tar.gz
COPY logstash.yml ./config/
COPY pipeline ./pipeline/
EXPOSE 5000
CMD ["bin/logstash", "-f", "pipeline/logstash.conf"]
