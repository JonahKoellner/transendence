# Use Node to build the Angular app
FROM node:20 as build

WORKDIR /app
COPY . .

# Install dependencies and build the Angular app
RUN npm install -g @angular/cli@16.2.6
RUN npm install

# Copy the Angular project files to the container
COPY . .

# Set environment variable to enable polling
ENV CHOKIDAR_USEPOLLING=true

# Default command: Run Angular development server
CMD ["ng", "serve", "--host", "0.0.0.0", "--port", "4200", "--configuration", "development", "--poll", "2000", "--watch"]

# # Use Nginx to serve the Angular files
# FROM nginx:alpine
# COPY --from=build /app/dist/your-angular-app /usr/share/nginx/html

# EXPOSE 80
# CMD ["nginx", "-g", "daemon off;"]