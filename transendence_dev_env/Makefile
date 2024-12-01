# Docker Compose file
COMPOSE_FILE := docker-compose.yml

.PHONY: all help up start stop down restart logs

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

# Build and start all services interactively
up:
	docker-compose -f $(COMPOSE_FILE) up --build

# Build and start all services in detached mode
start:
	docker-compose -f $(COMPOSE_FILE) up --build -d

# Stop all running services
stop:
	docker-compose -f $(COMPOSE_FILE) stop

# Stop and remove all containers
down:
	docker-compose -f $(COMPOSE_FILE) down

# Restart all services
restart: down up

# Show logs for all running services
logs:
	docker-compose -f $(COMPOSE_FILE) logs -f
