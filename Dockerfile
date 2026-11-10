# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- dependencias (com as de desenvolvimento: build e migracoes precisam) -----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- build do Next.js ---------------------------------------------------------
FROM deps AS builder
COPY . .
# O build nao acessa o banco; estes valores so existem para os modulos carregarem.
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_STANDALONE=true \
    DATABASE_URL=mysql://build:build@localhost:3306/build \
    SESSION_SECRET=build-only
RUN npx prisma generate && npm run build

# --- tarefa de migracao + seed do administrador inicial -----------------------
FROM deps AS migrate
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed"]

# --- imagem final da aplicacao ------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]
