# Use debian:bullseye as the base image
FROM debian:bullseye

# Install necessary packages
RUN apt-get update && apt-get install -y \
    redis-server \
    && apt-get clean

RUN mkdir -p /usr/local/etc/redis/

# Copy the Redis configuration file
COPY redis.conf /usr/local/etc/redis/redis.conf

# Expose the Redis port
EXPOSE 6379

# Set the entrypoint to the Redis server
ENTRYPOINT ["redis-server", "/usr/local/etc/redis/redis.conf"]