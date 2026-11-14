FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8080 DATABASE_PATH=/data/ardan.db
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY public ./public
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
CMD ["node", "server/index.js"]
