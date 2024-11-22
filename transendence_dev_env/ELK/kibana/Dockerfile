FROM node:18-slim
WORKDIR /usr/share/kibana
RUN apt-get update && apt-get install -y wget && \
    wget https://artifacts.elastic.co/downloads/kibana/kibana-8.10.2-linux-x86_64.tar.gz && \
    tar -xzf kibana-8.10.2-linux-x86_64.tar.gz --strip-components=1 && \
    rm kibana-8.10.2-linux-x86_64.tar.gz
COPY kibana.yml ./config/
EXPOSE 5601
CMD ["bin/kibana"]
