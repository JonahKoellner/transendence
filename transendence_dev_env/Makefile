
# Function to generate password based on available tools
# generate-password=$(strip $(if $(shell command -v openssl), $(shell openssl rand -base64 12), $(shell head -c 12 /dev/urandom | base64)))
# Function to generate a password without backslashes and at least 24 characters long
generate-password=$(strip $(if $(shell command -v openssl), $(shell openssl rand -base64 32 | tr -d '/+' | head -c 24), $(shell head -c 24 /dev/urandom | base64 | tr -d '/+' | head -c 24)))
generate-secret-key=$(strip $(if $(shell command -v openssl), $(shell openssl rand -base64 64 | tr -d '/+' | head -c 50), $(shell head -c 50 /dev/urandom | base64 | tr -d '/+' | head -c 50)))


generate_passwords:
	@echo "Generating elk passwords..."
	@echo "ELASTIC_PASSWORD=$(call generate-password)" > ./elk/.env
	@echo "KIBANA_ENCRYPTION_KEY=$(call generate-password)" >> ./elk/.env
	@echo "ELASTIC_ADMIN_PASSWORD=$(call generate-password)" >> ./elk/.env
	@echo "ELASTIC_LOGSTASH_PASSWORD=$(call generate-password)" >> ./elk/.env
	@echo "Passwords generated and stored in .env file."
	
	@echo "Generating hashicorp keyvault password..."
	@echo "UI_USER=ADMIN" > ./keyvault/.env
	@echo "UI_PASSWORD=$(call generate-password)" >> ./keyvault/.env
	@echo "VAULT_ADDR=https://0.0.0.0:8200" >> ./keyvault/.env
	@echo "Passwords generated and stored in ./keyvault/.env file."

	@echo "Generating db passwords..."
	$(eval DB_PASS=$(call generate-password))
	@echo "POSTGRES_DB=mydb" > ./db/.env
	@echo "POSTGRES_USER=user" >> ./db/.env
	@echo "POSTGRES_PASSWORD=$(DB_PASS)" >> ./db/.env
	@echo "Generating be passwords..."
	@echo "POSTGRES_DB=mydb" > ./be/.env
	@echo "POSTGRES_USER=user" >> ./be/.env
	@echo "POSTGRES_PASSWORD=$(DB_PASS)" >> ./be/.env
	@echo "DB_HOST=db" >> ./be/.env
	@echo "DB_PORT=5432" >> ./be/.env
	@echo "REDIS_HOST=redis" >> ./be/.env
	@echo "REDIS_PORT=6379" >> ./be/.env
	@echo "DJANGO_SETTINGS_MODULE=be.settings" >> ./be/.env
	@echo "SECRET_KEY=$(call generate-secret-key)" >> ./be/.env

	@echo "Generting redis password..."
	$(eval REDIS_PASS=$(call generate-password))
	@sed -i '' '/^requirepass /d' ./redis/redis.conf && echo "requirepass \"$(REDIS_PASS)\"" >> ./redis/redis.conf
	@sed -i '' '/^REDIS_PASSWORD=/d' ./be/.env && echo "REDIS_PASSWORD=$(REDIS_PASS)" >> ./be/.env
	@echo "Redis password generated and saved to .env files."


addHost:
	@if ! grep -q '^DOMAIN=' be/.env; then \
        echo "DOMAIN=$$(hostname)" >> be/.env; \
    fi
	@echo "~~ Your 42 API Authentication Callback URL is: https://$$(hostname)/auth/callback ~~"


clean_pycache_migrations:
	@echo "Removing all __pycache__ and migrations directories from ./be..."
	@find ./be -type d \( -name '__pycache__' -o -name 'migrations' \) -exec rm -rf {} \;
	@echo "Cleanup complete."

ask42APIKey:
	@read -p "Enter the value for ftUID: " ftUID; \
    if grep -q '^ftUID=' ./keyvault/.env; then \
        sed -i 's/^ftUID=.*/API_KEY42=$$my_variable/' ./keyvault/.env; \
    else \
        echo "ftUID=$$ftUID" >> ./keyvault/.env; \
    fi; \
    echo "ftUID stored in ./keyvault/.env file."

	@read -p "Enter the value for ftSecret: " ftSecret; \
	    if grep -q '^ftSecret=' ./keyvault/.env; then \
        sed -i 's/^ftSecret=.*/ftSecret=$$ftSecret/' ./keyvault/.env; \
    else \
        echo "ftSecret=$$ftSecret" >> ./keyvault/.env; \
    fi; \
    echo "ftSecret stored in ./keyvault/.env file."


# Docker Compose file
COMPOSE_FILE := docker-compose.yml

.PHONY: all help up start stop down restart logs print-password clean_pycache_migrations

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
up: clean_pycache_migrations generate_passwords addHost ask42APIKey
	docker-compose -f $(COMPOSE_FILE) up --build

# Build and start all services in detached mode
start: clean_pycache_migrations generate_passwords addHost ask42APIKey
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
clean: clean_pycache_migrations down
	@docker system prune -af
	@docker volume ls -q | while read vol; do \
	    [ -z "$$vol" ] || docker volume rm "$$vol"; \
	done

# Example target that calls the generate-password function
print-password:
	@echo "Generated Password: $(call generate-password)"