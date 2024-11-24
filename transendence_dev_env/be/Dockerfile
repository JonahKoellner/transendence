# Use Python 3.9 as the base image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy project files
COPY . .


# Install system dependencies for Python packages and dos2unix
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*
    
# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install daphne for ASGI support
RUN pip install daphne

COPY wait-for-service.sh /usr/bin/wait-for-it.sh
RUN chmod +x /usr/bin/wait-for-it.sh

# Expose port 8000
EXPOSE 8000

# Start Django with migrations
CMD ["/usr/bin/wait-for-it.sh", "logstash", "9600", "--", "python", "manage.py", "makemigrations", "accounts", "&&", "python", "manage.py", "makemigrations", "games", "&&",  "python", "manage.py", "migrate", "&&",  "python", "manage.py", "loaddata","achievements.json", "&&", "daphne", "-b", "0.0.0.0", "-p", "8000", "be.asgi:application"]