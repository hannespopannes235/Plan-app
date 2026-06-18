# ============================================================================
# Plan – ein einziger Container: PocketBase (Backend) + ausgelieferte PWA
# Gebaut für Synology DS218+ (Intel, amd64).
# ============================================================================

# ── Stage 1: React-App (PWA) bauen ─────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Ohne VITE_PB_URL nutzt die App dieselbe Herkunft wie PocketBase (same-origin)
RUN npm run build

# ── Stage 2: PocketBase + PWA + Schema/Logik ───────────────────────────────
FROM alpine:3.20
# Version bewusst gepinnt – Migrationen & Hooks sind auf diese API abgestimmt.
ARG PB_VERSION=0.22.21

RUN apk add --no-cache unzip ca-certificates wget && \
    wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
         -O /tmp/pb.zip && \
    unzip /tmp/pb.zip -d /pb && \
    rm /tmp/pb.zip && \
    chmod +x /pb/pocketbase

# Gebaute PWA – PocketBase liefert sie direkt aus (mit SPA-Fallback)
COPY --from=build /app/dist /pb/pb_public
# Schema (Collections + Zugriffsregeln) – beim Start automatisch angewendet
COPY pb_migrations /pb/pb_migrations
# Server-Logik: Einladungen einlösen + .ics-Kalender-Feed
COPY pb_hooks /pb/pb_hooks

EXPOSE 8090
WORKDIR /pb
CMD ["./pocketbase", "serve", "--http=0.0.0.0:8090"]
