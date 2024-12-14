## Use Node to build the Angular app
#FROM node:20 as build

#WORKDIR /app

## Install Angular CLI globally
#RUN npm install -g @angular/cli@16.2.6

## Copy package.json and package-lock.json before other files to leverage Docker caching
#COPY package*.json ./

## Step 1: Install all other dependencies, excluding ng2-charts and chart.js
#RUN npm install --legacy-peer-deps && \
#    npm uninstall ng2-charts chart.js

## Step 2: Install only ng2-charts and chart.js with --legacy-peer-deps
#RUN npm install chart.js@^4.4.5 ng2-charts@5.0.0 --legacy-peer-deps

## Copy the rest of the application code
#COPY . .

## Set environment variable to enable polling (useful in Docker)
#ENV CHOKIDAR_USEPOLLING=true

## Default command: Run Angular development server
#CMD ["ng", "serve", "--host", "0.0.0.0", "--port", "4200", "--configuration", "development", "--poll", "2000", "--watch", "--disable-host-check"]

# Uncomment this section if you want to serve with Nginx instead of ng serve
FROM node:20 as build

WORKDIR /app

RUN npm install -g @angular/cli@16.2.6

COPY package.json package-lock.json ./
# RUN npm install

RUN npm install --legacy-peer-deps && \
    npm uninstall ng2-charts chart.js

RUN npm install chart.js@^4.4.5 ng2-charts@5.0.0 --legacy-peer-deps

COPY . .

ENV CHOKIDAR_USEPOLLING=true

# RUN npm run build --configuration=production
RUN ng build --configuration production

# Stage 2: Serve with nginx
FROM nginx:alpine

# Set environment variables for the domain name
ARG DOMAIN=transendence.42.hn

# Set up directories for the SSL certificate
RUN mkdir -p /etc/nginx/ssl

# Generate self-signed SSL certificate
RUN apk add --no-cache openssl \
    && openssl genpkey -algorithm RSA -out /etc/nginx/ssl/nginx.key \
    && openssl req -new -x509 -key /etc/nginx/ssl/nginx.key -out /etc/nginx/ssl/nginx.crt -days 365 -subj "/C=DE/ST=State/L=City/O=Company/OU=IT/CN=$DOMAIN"


COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/fe /usr/share/nginx/html

EXPOSE 80 443
