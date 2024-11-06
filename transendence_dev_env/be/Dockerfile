# Use Python 3.9 as the base image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Ensure wait-for-db.sh is executable
RUN chmod +x wait-for-db.sh

# Install system dependencies for Python packages and dos2unix
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    netcat-openbsd \
    dos2unix \
    && rm -rf /var/lib/apt/lists/*

# Convert wait-for-db.sh to Unix-style line endings
RUN dos2unix wait-for-db.sh

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install daphne for ASGI support
RUN pip install daphne

# Expose port 8000
EXPOSE 8000

# Start Django with migrations
CMD ["sh", "-c", "./wait-for-db.sh && python manage.py migrate && daphne -b 0.0.0.0 -p 8000 be.asgi:application"]