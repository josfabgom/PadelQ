# Build stage
FROM ghcr.io/cirruslabs/flutter:stable AS build
WORKDIR /app

# Copy pubspec files and fetch dependencies
COPY pubspec.yaml pubspec.lock ./
RUN flutter pub get

# Copy all source code and build for web
COPY . .
ARG API_URL
RUN flutter build web --release --dart-define=API_URL=$API_URL

# Production stage
FROM nginx:alpine
# Copy built files from the build stage to Nginx directory
COPY --from=build /app/build/web /usr/share/nginx/html

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
