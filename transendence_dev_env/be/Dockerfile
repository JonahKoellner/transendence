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

# Expose port 8000
EXPOSE 8000

# Start Django with migrations
CMD ["python", "manage.py", "makemigrations", "accounts", "&&", "python", "manage.py", "makemigrations", "games", "&&",  "python", "manage.py", "migrate", "&&",  "python", "manage.py", "loaddata","achievements.json", "&&", "daphne", "-b", "0.0.0.0", "-p", "8000", "be.asgi:application"]
