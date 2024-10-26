# Use Python 3.9 as the base image
FROM python:3.9-slim

WORKDIR /app
COPY . .

# Install system dependencies for Python packages that may require them
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install daphne to support ASGI for WebSockets
RUN pip install daphne

EXPOSE 8000

# Start the server with daphne
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "be.asgi:application"]
