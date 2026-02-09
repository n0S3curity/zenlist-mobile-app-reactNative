# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Clone the frontend repository
RUN apk add --no-cache git && \
    git clone https://github.com/n0S3curity/zenlist-mobile-app-reactNative.git .

# Install dependencies
RUN npm install

# Install Expo CLI globally
RUN npm install -g expo-cli

# Stage 2: Runtime
FROM node:18-alpine

WORKDIR /app

# Install Expo CLI globally
RUN npm install -g expo-cli

# Copy from builder
COPY --from=builder /app /app

# Expose ports
# 8081 - Expo development server
# 19000 - Expo Metro bundler
# 19001 - Expo dev client
EXPOSE 8081 19000 19001

# Set environment variables
ENV EXPO_DEBUG=true
ENV NODE_ENV=development

# Start the Expo development server
CMD ["expo", "start", "--web"]
