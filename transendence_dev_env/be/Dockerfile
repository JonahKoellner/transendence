# Use Python 3.9 as the base image
FROM python:3.9-slim

WORKDIR /app
COPY . .

# Install Python dependencies
RUN pip install -r requirements.txt

EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]