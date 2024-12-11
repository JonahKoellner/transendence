
# Function to generate password based on available tools
generate-password=$(strip $(if $(shell command -v openssl), $(shell openssl rand -base64 12), $(shell head -c 12 /dev/urandom | base64)))

generate_passwords:
	@echo "Generating passwords..."
	@echo "ELASTIC_PASSWORD=$(call generate-password)" > .env
	@echo "KIBANA_ENCRYPTION_KEY=$(call generate-password)" >> .env
	@echo "ELASTIC_ADMIN_PASSWORD=$(call generate-password)" >> .env
	@echo "ELASTIC_LOGSTASH_PASSWORD=$(call generate-password)" >> .env
	@echo "Passwords generated and stored in .env file."

# Docker Compose file
COMPOSE_FILE := docker-compose.yml

.PHONY: all help up start stop down restart logs print-password

# Show available commands
help:
	@echo "Usage: make [command]"
	@echo ""
	@echo "Commands:"
	@echo "  up                Build and start all services interactively"
	@echo "  start             Build and start all services in detached mode"
	@echo "  stop              Stop all running services"
	@echo "  down              Stop and remove all containers"
	@echo "  restart           Restart all services"
	@echo "  logs              Show logs for all running services"
	@echo "  help              Show this help message"
	@echo "  clean             Clean everything and remove the volumes"

# Build and start all services interactively
up: generate_passwords
	docker-compose -f $(COMPOSE_FILE) up --build

# Build and start all services in detached mode
start: generate_passwords
	docker-compose -f $(COMPOSE_FILE) up --build -d

# Stop all running services
stop:
	docker-compose -f $(COMPOSE_FILE) stop

# Stop and remove all containers
down:
	docker-compose -f $(COMPOSE_FILE) down -v
	rm -rf data/

# Restart all services
restart: down up

# Show logs for all running services
logs:
	docker-compose -f $(COMPOSE_FILE) logs -f

# Clear everything and remove the volumes
clean: down
	@echo "Removing .env"
	@rm .env
	@docker system prune -af
	@docker volume ls -q | xargs -r docker volume rm

# Example target that calls the generate-password function
print-password:
	@echo "Generated Password: $(call generate-password)"
