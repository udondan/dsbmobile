FROM node:22-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN npm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build && npm prune --omit=dev

ENTRYPOINT ["node", "dist/cli.js", "mcp"]
