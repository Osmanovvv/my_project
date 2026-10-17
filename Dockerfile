# Production-shaped image for the Node/Nitro server.
# The same image can run locally and on the future server; only environment
# variables and the persistent data volume change between them.

FROM oven/bun:1.3.14 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# VITE_SITE_URL is compiled into the client bundle by Vite. Keep the local
# default safe; the server release can pass the public domain as a build arg.
ARG VITE_SITE_URL=http://localhost:3000
ENV VITE_SITE_URL=${VITE_SITE_URL}
ENV NITRO_PRESET=node-server

RUN bun run build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/var/lib/itagent

COPY --from=build /app/.output ./.output

# The application writes SQLite and uploaded media to DATA_DIR only.
RUN mkdir -p /var/lib/itagent/media \
    && chown -R node:node /app /var/lib/itagent

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
