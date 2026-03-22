# --- Build stage ---
FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# --- Serve stage ---
FROM oven/bun:1-alpine
WORKDIR /app

RUN addgroup -S drift && adduser -S drift -G drift

COPY --from=build /app/dist ./dist
COPY serve.js .

USER drift
EXPOSE 3000

CMD ["bun", "serve.js"]
