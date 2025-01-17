FROM node:20 as build

WORKDIR /app

# Install Angular CLI
RUN npm install -g @angular/cli@16.2.6

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps && \
    npm uninstall ng2-charts chart.js && \
    npm install chart.js@^4.4.5 ng2-charts@5.0.0 --legacy-peer-deps

# Copy the rest of the application code and build
COPY . .
ENV CHOKIDAR_USEPOLLING=true
RUN ng build --configuration production

FROM debian:bullseye-slim

# Install required packages
RUN apt-get update && apt-get install -y \
    build-essential \
    libpcre3 \
    libpcre3-dev \
    zlib1g \
    zlib1g-dev \
    libssl-dev \
    libxml2 \
    libxml2-dev \
    libxslt1-dev \
    libgd-dev \
    libgeoip-dev \
    libmaxminddb-dev \
    libyajl-dev \
    git \
    wget \
    ca-certificates \
    curl \
    pkg-config \
    python3 \
    automake \
    libtool \
    libcurl4-gnutls-dev \
    liblua5.3-dev \
    openssl

# Set working directory
WORKDIR /usr/src

# Clone and build ModSecurity
RUN git clone --depth 1 -b v3/master --single-branch https://github.com/SpiderLabs/ModSecurity
WORKDIR /usr/src/ModSecurity
RUN git submodule init && \
    git submodule update && \
    ./build.sh && \
    ./configure && \
    make && \
    make install

# Clone ModSecurity Nginx connector
WORKDIR /usr/src
RUN git clone --depth 1 https://github.com/owasp-modsecurity/ModSecurity-nginx

# Download and extract Nginx source
WORKDIR /usr/src
ENV NGINX_VERSION 1.21.6
RUN wget http://nginx.org/download/nginx-$NGINX_VERSION.tar.gz && \
    tar -zxvf nginx-$NGINX_VERSION.tar.gz

# Compile Nginx with ModSecurity module
WORKDIR /usr/src/nginx-$NGINX_VERSION
RUN ./configure \
    --sbin-path=/usr/sbin/nginx \
    --conf-path=/etc/nginx/nginx.conf \
    --pid-path=/var/run/nginx.pid \
    --lock-path=/var/run/nginx.lock \
    --modules-path=/usr/local/nginx/modules \
    --with-compat \
    --with-http_ssl_module \
    --add-dynamic-module=../ModSecurity-nginx
RUN make

RUN make modules
RUN mkdir -p /usr/local/nginx/modules
RUN cp objs/ngx_http_modsecurity_module.so /usr/local/nginx/modules/

RUN make install

# Copy ModSecurity configuration files
RUN mkdir -p /etc/nginx/modsecurity
RUN cp /usr/src/ModSecurity/modsecurity.conf-recommended /etc/nginx/modsecurity/modsecurity.conf
RUN cp /usr/src/ModSecurity/unicode.mapping /etc/nginx/modsecurity/

# Copy custom ModSecurity configuration file
COPY modsecurity_custom.conf /etc/nginx/modsecurity/modsecurity_custom.conf


# Set up ModSecurity
RUN sed -i 's/SecRuleEngine DetectionOnly/SecRuleEngine DetectionOnly/' /etc/nginx/modsecurity/modsecurity.conf
RUN sed -i 's/SecResponseBodyAccess On/SecResponseBodyAccess Off/' /etc/nginx/modsecurity/modsecurity.conf
RUN sed -i 's/SecResponseBodyLimit 524288/SecResponseBodyLimit 0/' /etc/nginx/modsecurity/modsecurity.conf
RUN sed -i 's/SecResponseBodyLimitAction ProcessPartial/SecResponseBodyLimitAction Reject/' /etc/nginx/modsecurity/modsecurity.conf
RUN echo "Include /etc/nginx/modsecurity/modsecurity_custom.conf" >> /etc/nginx/modsecurity/modsecurity.conf

RUN echo "SecDebugLog /var/log/modsec_debug.log" >> /etc/nginx/modsecurity/modsecurity.conf && \
    echo "SecDebugLogLevel 9" >> /etc/nginx/modsecurity/modsecurity.conf && \
    echo "SecAuditEngine On" >> /etc/nginx/modsecurity/modsecurity.conf && \
    echo "SecAuditLog /var/log/modsec_audit.log" >> /etc/nginx/modsecurity/modsecurity.conf && \
    echo "SecAuditLogFormat JSON" >> /etc/nginx/modsecurity/modsecurity.conf && \
    echo "SecAuditLogParts ABIJDEFHZ" >> /etc/nginx/modsecurity/modsecurity.conf

# Download the OWASP ModSecurity Core Rule Set
WORKDIR /etc/nginx/modsecurity
RUN git clone --depth 1 https://github.com/coreruleset/coreruleset.git
RUN mv coreruleset/crs-setup.conf.example coreruleset/crs-setup.conf
RUN echo "Include /etc/nginx/modsecurity/coreruleset/crs-setup.conf" >> /etc/nginx/modsecurity/modsecurity.conf
RUN echo "Include /etc/nginx/modsecurity/coreruleset/rules/*.conf" >> /etc/nginx/modsecurity/modsecurity.conf

# Create Nginx configuration directory
RUN mkdir -p /etc/nginx/conf.d

# Copy the built Angular app from the build stage
COPY --from=build /app/dist/fe /usr/share/nginx/html

# Copy your Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Set up directories for the SSL certificate
RUN mkdir -p /etc/nginx/ssl

# Generate self-signed SSL certificate
ARG DOMAIN=localhost
RUN openssl genpkey -algorithm RSA -out /etc/nginx/ssl/nginx.key && \
    openssl req -new -x509 -key /etc/nginx/ssl/nginx.key -out /etc/nginx/ssl/nginx.crt -days 365 \
        -subj "/C=DE/ST=State/L=City/O=Company/OU=IT/CN=${DOMAIN}"

# Ensure the module is copied to the correct location
RUN mkdir -p /usr/lib/nginx/modules
RUN cp /usr/src/nginx-$NGINX_VERSION/objs/ngx_http_modsecurity_module.so /usr/lib/nginx/modules/

# Expose ports
EXPOSE 80 443

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]