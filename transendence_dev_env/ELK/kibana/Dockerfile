
FROM debian:bullseye-slim

WORKDIR /usr/share/kibana

RUN apt-get update && apt-get install -y wget && \
    wget https://artifacts.elastic.co/downloads/kibana/kibana-8.10.2-linux-aarch64.tar.gz && \
    tar -xzf kibana-8.10.2-linux-aarch64.tar.gz --strip-components=1 && \
    rm kibana-8.10.2-linux-aarch64.tar.gz && \
    apt-get clean

COPY kibana.yml /usr/share/kibana/config/kibana.yml


RUN groupadd -g 1000 kibana && \
    useradd -u 1000 -g kibana kibana && \
    # Set ownership of the installed Elasticsearch files to the non-root user
    chown -R kibana:kibana /usr/share/kibana


    
# Switch to the non-root user
USER kibana

# COPY setup-kibana.sh /usr/share/kibana/setup-kibana.sh
# RUN chmod +x /usr/share/kibana/setup-kibana.sh


EXPOSE 5601

# ENTRYPOINT [ "/usr/share/kibana/setup-kibana.sh" ]
CMD ["bin/kibana"]