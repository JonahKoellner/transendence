# Use Node to build the Angular app
FROM node:14 as build

WORKDIR /app
COPY . .

# Install dependencies and build the Angular app
RUN npm install && npm run build --prod

# Use Nginx to serve the Angular files
FROM nginx:alpine
COPY --from=build /app/dist/your-angular-app /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
