# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# התקנת git וביצוע clone
RUN apk add --no-cache git && \
    git clone https://github.com/n0S3curity/zenlist-mobile-app-reactNative.git .

# שימוש ב-legacy-peer-deps כדי לפתור את הקונפליקט בין React 19 ל-Lottie
RUN npm install --legacy-peer-deps

# Stage 2: Runtime
FROM node:22-alpine

WORKDIR /app

# התקנת חבילות מערכת נחוצות להרצת Expo על לינוקס (במידה וצריך)
RUN apk add --no-cache bash

# העתקת כל תיקיית האפליקציה (כולל node_modules) מהבילדר
COPY --from=builder /app /app

# התקנת expo-cli ב-Runtime (רק אם הוא באמת נחוץ כפקודה גלובלית)
RUN npm install -g expo-cli

# חשיפת פורטים (הוספתי גם את 19002 ל-Dashboard הישן אם רלוונטי)
EXPOSE 8081 19000 19001 19002

# הגדרות סביבה
ENV EXPO_DEBUG=true
ENV NODE_ENV=development
# עוזר ל-Expo לעבוד בתוך Docker
ENV EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0

# הרצה במצב LAN כדי שהטלפון שלך יוכל להתחבר לרסברי פאי בקלות
CMD ["npx", "expo", "start", "--lan", "--web"]