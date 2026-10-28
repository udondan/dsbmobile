FROM oven/bun:1.4.4-alpine AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/
RUN bun run build && bun install --production --frozen-lockfile

FROM node:26-alpine

WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

ENTRYPOINT ["node", "dist/cli.js", "mcp"]
