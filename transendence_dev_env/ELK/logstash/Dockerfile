FROM openjdk:17-jdk-slim

WORKDIR /usr/share/logstash

#RUN apt-get update && apt-get install -y wget curl && \
#    wget https://artifacts.elastic.co/downloads/logstash/logstash-8.10.2-linux-aarch64.tar.gz && \
#    tar -xzf logstash-8.10.2-linux-aarch64.tar.gz --strip-components=1 && \
#    rm logstash-8.10.2-linux-aarch64.tar.gz && \
#    apt-get clean

RUN apt-get update && apt-get install -y wget unzip curl && \
    ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then \
        VERSION="logstash-8.10.2-linux-x86_64.tar.gz"; \
    elif [ "$ARCH" = "aarch64" ]; then \
        VERSION="logstash-8.10.2-linux-aarch64.tar.gz"; \
    else \
        echo "Unknown architecture: $ARCH"; \
        exit 1; \
    fi && \
    wget https://artifacts.elastic.co/downloads/logstash/$VERSION && \
    tar -xzf $VERSION --strip-components=1 && \
    rm $VERSION && \
    apt-get clean

#COPY pipeline ./pipeline
EXPOSE 5240 5431 5959

COPY wait_for_elastic.sh /usr/share/logstash/wait_for_elastic.sh
RUN chmod +x /usr/share/logstash/wait_for_elastic.sh

# CMD ["bin/logstash", "-f", "pipeline"]
ENTRYPOINT [ "/usr/share/logstash/wait_for_elastic.sh" ]
