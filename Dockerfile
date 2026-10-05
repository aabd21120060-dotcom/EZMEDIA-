FROM node:24.21.0-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable \
    && corepack install --global pnpm@12.9.1

WORKDIR /app

COPY . .

RUN pnpm --version

RUN pnpm install --frozen-lockfile

RUN pnpm build

EXPOSE 8080

CMD ["pnpm", "start"]
