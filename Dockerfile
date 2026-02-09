# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git && \
    git clone https://github.com/n0S3curity/zenlist-mobile-app-reactNative.git .
RUN npm install --legacy-peer-deps

# Stage 2: Runtime
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache bash
COPY --from=builder /app /app

# הפורט הפנימי ש-Expo מריץ עליו את ה-Web
EXPOSE 8081

ENV NODE_ENV=development
# CI=1 מחליף את non-interactive ומונע שגיאות ב-Docker
ENV CI=1

CMD ["npx", "expo", "start", "--web"]