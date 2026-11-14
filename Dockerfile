# ARDAN – obraz Docker (Fly.io, VPS, dowolny hosting z Dockerem). Dane w wolumenie /data.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts   # better-sqlite3 ships prebuilt binaries

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data TRUST_PROXY=1
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY public ./public
COPY scripts ./scripts
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/start.js"]
