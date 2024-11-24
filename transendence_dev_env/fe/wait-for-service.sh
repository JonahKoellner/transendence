#!/bin/bash

HOST=$1
PORT=$2
TIMEOUT=${3:-30}

if [ -z "$HOST" ] || [ -z "$PORT" ]; then
    echo "Usage: $0 <host> <port> [timeout]"
    exit 1
fi

echo "Waiting for $HOST:$PORT to become available..."

start_time=$(date +%s)
while true; do

    if nc -z $HOST $PORT; then
        echo "$HOST:$PORT is available!"
        break
    fi

    current_time=$(date +%s)
    elapsed_time=$((current_time - start_time))

    if [ $elapsed_time -ge $TIMEOUT ]; then
        echo "Timeout reached: $HOST:$PORT is still not available after $TIMEOUT seconds."
        exit 1
    fi

    sleep 1
done

shift 3
exec "$@"
