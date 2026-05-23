FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY bin/ ./bin/
COPY src/ ./src/

ENTRYPOINT ["bun", "src/index.ts"]
