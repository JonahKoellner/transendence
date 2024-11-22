# FROM openjdk:17-jdk-slim

# WORKDIR /usr/share/logstash

# RUN apt-get update && apt-get install -y wget && \
#     wget https://artifacts.elastic.co/downloads/logstash/logstash-8.10.2-linux-x86_64.tar.gz && \
#     tar -xzf logstash-8.10.2-linux-x86_64.tar.gz --strip-components=1 && \
#     rm logstash-8.10.2-linux-x86_64.tar.gz && \
#     apt-get clean

# COPY pipeline ./pipeline
# EXPOSE 5234 5240

# CMD ["bin/logstash", "-f", "pipeline"]

FROM openjdk:17-jdk-slim

WORKDIR /usr/share/logstash

RUN apt-get update && apt-get install -y wget && \
    wget https://artifacts.elastic.co/downloads/logstash/logstash-8.10.2-linux-aarch64.tar.gz && \
    tar -xzf logstash-8.10.2-linux-aarch64.tar.gz --strip-components=1 && \
    rm logstash-8.10.2-linux-aarch64.tar.gz && \
    apt-get clean

COPY pipeline ./pipeline
EXPOSE 5234 5240

CMD ["bin/logstash", "-f", "pipeline"]


# Use an official Logstash base image
# FROM docker.elastic.co/logstash/logstash:8.5.0

# # Copy custom Logstash pipeline configuration
# COPY ./pipeline/ /usr/share/logstash/pipeline/

# # Set environment variables (M1 compatibility)
# ENV JAVA_HOME=/usr/lib/jvm/java-8-openjdk

# # Expose Logstash port
# EXPOSE 5044

# USER logstash
