FROM oven/bun:1.1.27 AS deps

WORKDIR /app

COPY package.json bun.lock turbo.json tsconfig.json bunfig.toml ./
COPY packages/engine-settings/package.json packages/engine-settings/package.json
COPY packages/engine-temporal/package.json packages/engine-temporal/package.json

RUN bun install --frozen-lockfile

FROM deps AS build

COPY packages/engine-settings packages/engine-settings
COPY packages/engine-temporal packages/engine-temporal

RUN bun run --filter @judge-gym/engine-temporal build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends libatomic1 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/engine-settings ./packages/engine-settings
COPY --from=build /app/packages/engine-temporal ./packages/engine-temporal

CMD ["node_modules/.bin/ts-node", "packages/engine-temporal/src/worker.ts"]
