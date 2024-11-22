# FROM debian:bullseye-slim

# WORKDIR /usr/share/kibana

# RUN apt-get update && apt-get install -y wget && \
#     wget https://artifacts.elastic.co/downloads/kibana/kibana-8.10.2-linux-x86_64.tar.gz && \
#     tar -xzf kibana-8.10.2-linux-x86_64.tar.gz --strip-components=1 && \
#     rm kibana-8.10.2-linux-x86_64.tar.gz && \
#     apt-get clean

# EXPOSE 5601

# CMD ["bin/kibana"]


FROM debian:bullseye-slim

WORKDIR /usr/share/kibana

RUN apt-get update && apt-get install -y wget && \
    wget https://artifacts.elastic.co/downloads/kibana/kibana-8.10.2-linux-aarch64.tar.gz && \
    tar -xzf kibana-8.10.2-linux-aarch64.tar.gz --strip-components=1 && \
    rm kibana-8.10.2-linux-aarch64.tar.gz && \
    apt-get clean


RUN groupadd -g 1000 kibana && \
    useradd -u 1000 -g kibana kibana && \
    # Set ownership of the installed Elasticsearch files to the non-root user
    chown -R kibana:kibana /usr/share/kibana

# Switch to the non-root user
USER kibana


EXPOSE 5601

CMD ["bin/kibana"]


# # Use an official Kibana base image
# FROM docker.elastic.co/kibana/kibana:8.5.0

# # Set environment variables (M1 compatibility)
# ENV JAVA_HOME=/usr/lib/jvm/java-8-openjdk

# # Expose Kibana port
# EXPOSE 5601

# USER kibana
