
FROM debian:bullseye-slim

WORKDIR /usr/share/kibana


RUN apt-get update && apt-get install -y wget unzip curl && \
    ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then \
        VERSION="kibana-8.10.2-linux-x86_64.tar.gz"; \
    elif [ "$ARCH" = "aarch64" ]; then \
        VERSION="kibana-8.10.2-linux-aarch64.tar.gz"; \
    else \
        echo "Unknown architecture: $ARCH"; \
        exit 1; \
    fi && \
    wget https://artifacts.elastic.co/downloads/kibana/$VERSION && \
    tar -xzf $VERSION --strip-components=1 && \
    rm $VERSION && \
    apt-get clean

#RUN apt-get update && apt-get install -y wget curl && \
#    wget https://artifacts.elastic.co/downloads/kibana/kibana-8.10.2-linux-aarch64.tar.gz && \
#    tar -xzf kibana-8.10.2-linux-aarch64.tar.gz --strip-components=1 && \
#    rm kibana-8.10.2-linux-aarch64.tar.gz && \
#    apt-get clean

COPY kibana.yml /usr/share/kibana/config/kibana.yml


RUN groupadd -g 1000 kibana && \
    useradd -u 1000 -g kibana kibana && \
    # Set ownership of the installed Elasticsearch files to the non-root user
    chown -R kibana:kibana /usr/share/kibana



# Switch to the non-root user

COPY setup_kibana.sh /usr/share/kibana/setup_kibana.sh
RUN chmod +x /usr/share/kibana/setup_kibana.sh

USER kibana

EXPOSE 5601

ENTRYPOINT ["/bin/bash", "/usr/share/kibana/setup_kibana.sh"]

# ENTRYPOINT [ "/usr/share/kibana/setup-kibana.sh" ]
# CMD ["bin/kibana"]
