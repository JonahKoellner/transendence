# Use debian:bullseye as the base image
FROM debian:bullseye

# Install necessary packages
RUN apt-get update && apt-get install -y \
    redis-server \
    && apt-get clean

RUN mkdir -p /usr/local/etc/redis/

ARG REDIS_PASSWORD

ENV REDIS_PASSWORD=${REDIS_PASSWORD}

# Create the Redis configuration file
RUN echo "bind 0.0.0.0" > /usr/local/etc/redis/redis.conf && \
    # echo "protected-mode no" >> /usr/local/etc/redis/redis.conf && \
    echo "port 6379" >> /usr/local/etc/redis/redis.conf && \
    echo "requirepass \"$REDIS_PASSWORD\"" >> /usr/local/etc/redis/redis.conf && \
    echo "tcp-backlog 511" >> /usr/local/etc/redis/redis.conf && \
    echo "timeout 0" >> /usr/local/etc/redis/redis.conf && \
    echo "tcp-keepalive 300" >> /usr/local/etc/redis/redis.conf && \
    echo "daemonize no" >> /usr/local/etc/redis/redis.conf && \
    echo "supervised no" >> /usr/local/etc/redis/redis.conf && \
    echo "pidfile /var/run/redis_6379.pid" >> /usr/local/etc/redis/redis.conf && \
    echo "loglevel notice" >> /usr/local/etc/redis/redis.conf && \
    echo "logfile \"\"" >> /usr/local/etc/redis/redis.conf && \
    echo "databases 16" >> /usr/local/etc/redis/redis.conf && \
    echo "save 900 1" >> /usr/local/etc/redis/redis.conf && \
    echo "save 300 10" >> /usr/local/etc/redis/redis.conf && \
    echo "save 60 10000" >> /usr/local/etc/redis/redis.conf && \
    echo "stop-writes-on-bgsave-error yes" >> /usr/local/etc/redis/redis.conf && \
    echo "rdbcompression yes" >> /usr/local/etc/redis/redis.conf && \
    echo "rdbchecksum yes" >> /usr/local/etc/redis/redis.conf && \
    echo "dbfilename dump.rdb" >> /usr/local/etc/redis/redis.conf && \
    echo "dir ./" >> /usr/local/etc/redis/redis.conf && \
    echo "slave-serve-stale-data yes" >> /usr/local/etc/redis/redis.conf && \
    echo "slave-read-only yes" >> /usr/local/etc/redis/redis.conf && \
    echo "repl-diskless-sync no" >> /usr/local/etc/redis/redis.conf && \
    echo "repl-diskless-sync-delay 5" >> /usr/local/etc/redis/redis.conf && \
    echo "repl-disable-tcp-nodelay no" >> /usr/local/etc/redis/redis.conf && \
    echo "slave-priority 100" >> /usr/local/etc/redis/redis.conf && \
    echo "appendonly no" >> /usr/local/etc/redis/redis.conf && \
    echo "appendfilename \"appendonly.aof\"" >> /usr/local/etc/redis/redis.conf && \
    echo "appendfsync everysec" >> /usr/local/etc/redis/redis.conf && \
    echo "no-appendfsync-on-rewrite no" >> /usr/local/etc/redis/redis.conf && \
    echo "auto-aof-rewrite-percentage 100" >> /usr/local/etc/redis/redis.conf && \
    echo "auto-aof-rewrite-min-size 64mb" >> /usr/local/etc/redis/redis.conf && \
    echo "aof-load-truncated yes" >> /usr/local/etc/redis/redis.conf && \
    echo "aof-use-rdb-preamble yes" >> /usr/local/etc/redis/redis.conf && \
    echo "lua-time-limit 5000" >> /usr/local/etc/redis/redis.conf && \
    echo "slowlog-log-slower-than 10000" >> /usr/local/etc/redis/redis.conf && \
    echo "slowlog-max-len 128" >> /usr/local/etc/redis/redis.conf && \
    echo "latency-monitor-threshold 0" >> /usr/local/etc/redis/redis.conf && \
    echo "notify-keyspace-events \"\"" >> /usr/local/etc/redis/redis.conf && \
    echo "hash-max-ziplist-entries 512" >> /usr/local/etc/redis/redis.conf && \
    echo "hash-max-ziplist-value 64" >> /usr/local/etc/redis/redis.conf && \
    echo "list-max-ziplist-size -2" >> /usr/local/etc/redis/redis.conf && \
    echo "list-compress-depth 0" >> /usr/local/etc/redis/redis.conf && \
    echo "set-max-intset-entries 512" >> /usr/local/etc/redis/redis.conf && \
    echo "zset-max-ziplist-entries 128" >> /usr/local/etc/redis/redis.conf && \
    echo "zset-max-ziplist-value 64" >> /usr/local/etc/redis/redis.conf && \
    echo "hll-sparse-max-bytes 3000" >> /usr/local/etc/redis/redis.conf && \
    echo "activerehashing yes" >> /usr/local/etc/redis/redis.conf && \
    echo "client-output-buffer-limit normal 0 0 0" >> /usr/local/etc/redis/redis.conf && \
    echo "client-output-buffer-limit slave 256mb 64mb 60" >> /usr/local/etc/redis/redis.conf && \
    echo "client-output-buffer-limit pubsub 32mb 8mb 60" >> /usr/local/etc/redis/redis.conf && \
    echo "hz 10" >> /usr/local/etc/redis/redis.conf && \
    echo "aof-rewrite-incremental-fsync yes" >> /usr/local/etc/redis/redis.conf

# Expose the Redis port
EXPOSE 6379

# Set the entrypoint to the Redis server
ENTRYPOINT ["redis-server", "/usr/local/etc/redis/redis.conf"]