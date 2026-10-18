# Étape 1 : Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build


FROM node:22-alpine AS runner
WORKDIR /app
ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION
COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/server.js"]

ENV NODE_ENV=production
EXPOSE 3001