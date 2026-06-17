# Plan – Deployment auf Synology DS218+ via PocketBase & Docker

> **Status:** Migrations-Anleitung (Backend-Umbau von Supabase → PocketBase steht noch aus).
> Diese Datei beschreibt den Zielzustand und alle Schritte bis zur laufenden App auf dem NAS.

---

## Zielbild

```
┌──────────── Synology DS218+ (Intel Celeron J3355, amd64) ───────────┐
│  Docker-Container „plan"                                             │
│   • /             PWA (React-Build, ausgeliefert von PocketBase)    │
│   • /api/         Auth, Collections, Realtime (SSE)                 │
│   • /ics/{token}  Kalender-Feed (Custom-Route in pb_hooks)          │
│   • /_/           PocketBase Admin-UI                               │
│                                                                      │
│  Volume: /volume1/docker/plan/pb_data/  ← SQLite + Backups          │
└──────────────────────────────────────────────────────────────────────┘
         ▲
   DSM Reverse Proxy (HTTPS, Let's Encrypt)
```

**Warum PocketBase statt Supabase-Self-Hosting?**
Der Supabase-Stack umfasst ~10 Container (Postgres, Kong, GoTrue, Realtime, Storage …)
und benötigt mind. 4 GB RAM. PocketBase läuft als **einzelnes Go-Binary mit SQLite**
und braucht typisch **20–80 MB RAM** — ideal für die DS218+ mit 2 GB.

---

## Voraussetzungen

- Synology DSM 7.2 oder neuer
- **Container Manager** (aus dem Paket-Zentrum installiert; ersetzt den alten Docker-Manager)
- Optional: eigene Domain + DynDNS für Zugriff von außen (im Heimnetz reicht die NAS-IP)
- Git oder SFTP-Client zum Übertragen der Dateien

---

## Ordnerstruktur auf dem NAS

Lege die folgende Struktur im Shared Folder `docker` an
(Systemsteuerung → Freigegebener Ordner → `docker`):

```
/volume1/docker/plan/
├── docker-compose.yml    ← Projekt-Datei für Container Manager
├── Dockerfile            ← Multi-Stage: Node-Build + PocketBase
├── pb_data/              ← SQLite-Datenbank + Uploads (BACKUP DIESER ORDNER!)
├── pb_migrations/        ← Collections-Schema (auto-eingespielt)
│   └── 1_init.js
├── pb_hooks/             ← Server-Logik (Haushalt, Einladungen, ICS)
│   └── main.pb.js
└── pb_public/            ← wird vom Docker-Build automatisch befüllt
                            (React-Build → dist/)
```

---

## Dateien

### `Dockerfile`

```dockerfile
# ── Stage 1: React-App bauen ──────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# VITE_PB_URL leer lassen → App nutzt same-origin (relativer Pfad)
RUN npm run build

# ── Stage 2: PocketBase + gebaute PWA ────────────────────────────────
FROM alpine:3.20
ARG PB_VERSION=0.23.4

RUN apk add --no-cache unzip ca-certificates wget && \
    wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
         -O /tmp/pb.zip && \
    unzip /tmp/pb.zip -d /pb && \
    rm /tmp/pb.zip && \
    chmod +x /pb/pocketbase

# Frontend-Build in pb_public (PocketBase liefert es direkt aus)
COPY --from=build /app/dist /pb/pb_public

EXPOSE 8090
VOLUME ["/pb/pb_data", "/pb/pb_hooks", "/pb/pb_migrations"]
WORKDIR /pb
CMD ["./pocketbase", "serve", "--http=0.0.0.0:8090"]
```

### `docker-compose.yml`

```yaml
services:
  pocketbase:
    build: .
    container_name: plan
    restart: unless-stopped
    ports:
      - "8090:8090"
    volumes:
      # Datenbank + Uploads – dieser Ordner ist das einzige, was du sichern musst
      - ./pb_data:/pb/pb_data
      # Server-Logik – Änderungen ohne Rebuild möglich (Container neu starten)
      - ./pb_hooks:/pb/pb_hooks
      # Schema-Migrationen
      - ./pb_migrations:/pb/pb_migrations
    environment:
      # Wird in pb_hooks für E-Mail-Links genutzt (hier nur NAS-lokal)
      PB_APP_URL: "http://plan.local:8090"
```

> **Tipp:** Für HTTPS-Zugriff von außen `PB_APP_URL` auf deine HTTPS-Domain setzen,
> nachdem der Reverse Proxy eingerichtet ist (Schritt 6).

---

## Deployment-Schritte

### Schritt 1 – Dateien auf den NAS kopieren

Mit dem **Datei-Explorer (DSM)** oder per SFTP (z. B. FileZilla):
1. Shared Folder `docker` öffnen.
2. Ordner `plan` anlegen.
3. `docker-compose.yml`, `Dockerfile` und die Unterordner
   `pb_data/`, `pb_migrations/`, `pb_hooks/` hochladen.
   (Die Unterordner dürfen leer sein, außer `pb_migrations/1_init.js` und `pb_hooks/main.pb.js`.)

Alternativ per SSH:
```bash
ssh admin@<NAS-IP>
mkdir -p /volume1/docker/plan/{pb_data,pb_hooks,pb_migrations}
# Dann Dateien per scp/sftp einspielen
```

### Schritt 2 – Container Manager: Projekt anlegen

1. DSM → Container Manager → **Projekte** → **Erstellen**.
2. Projektname: `plan`.
3. Pfad: `/volume1/docker/plan`.
4. „docker-compose.yml" wird automatisch erkannt.
5. **Erstellen** → Container Manager baut das Image (Node-Build kann 2–3 Min. dauern)
   und startet den Container.
6. Status prüfen: Protokoll-Tab → letzte Zeile sollte lauten:
   ```
   Server started at http://0.0.0.0:8090
   ```

### Schritt 3 – Admin-Account anlegen (einmalig)

Öffne im Browser: `http://<NAS-IP>:8090/_/`

Beim Erststart fordert PocketBase einen Admin-E-Mail und Passwort.
Merke dir diese Zugangsdaten — sie geben Vollzugriff auf die DB.

**Migrationen** werden beim Start automatisch eingespielt: Die Collections
(Haushalte, Mitglieder, Einkaufslisten, Aufgaben usw.) sind danach schon vorhanden.

### Schritt 4 – Auth konfigurieren (kein SMTP nötig)

Im Admin-UI unter **Settings → Auth → Collection: users**:
- `Require email verification`: **aus** (kein SMTP vorhanden)
- E-Mail/Passwort-Auth: **aktiv** (Standard)

Unter **Settings → Application**:
- Application name: `Plan`
- URL: `http://<NAS-IP>:8090` (später auf HTTPS-Domain ändern)

### Schritt 5 – App testen

`http://<NAS-IP>:8090` → Plan-Login erscheint.
Registrieren, Haushalt erstellen, loslegen.

### Schritt 6 – HTTPS + eigene Domain (empfohlen für Mobil-Zugriff)

**Option A: Synology Reverse Proxy + Let's Encrypt (einfachster Weg)**

1. Eine (Sub-)Domain auf die öffentliche IP deines Routers zeigen lassen
   (DynDNS z. B. über Synology DDNS: Systemsteuerung → Externer Zugriff → DDNS).
2. Router: Port 80 + 443 an die NAS-IP weiterleiten.
3. DSM → Systemsteuerung → **Anmeldeportal → Erweitert → Reverse Proxy**:
   - Quell-Protokoll: HTTPS, Hostname: `plan.deine-domain.de`, Port: 443
   - Ziel-Protokoll: HTTP, Hostname: `localhost`, Port: 8090
4. DSM → Systemsteuerung → **Sicherheit → Zertifikat → Hinzufügen → Let's Encrypt**:
   Domain `plan.deine-domain.de` eintragen → Zertifikat wird automatisch erneuert.
5. In `docker-compose.yml` `PB_APP_URL` auf `https://plan.deine-domain.de` setzen
   und Container neu starten.

**Option B: Nur im Heimnetz (kein Port-Forwarding)**
Die App ist unter `http://<NAS-IP>:8090` erreichbar, solange du im gleichen WLAN bist.
Für unterwegs: Synology **VPN Server** (OpenVPN) → du wählst dich per Handy ins Heim-VPN
ein und erreichst die NAS-IP wie gewohnt.

### Schritt 7 – Kalender abonnieren

Unter **Kalender** in der App erscheint die `.ics`-URL automatisch.
Format: `https://plan.deine-domain.de/ics/<token>`

In Google Kalender:
- Andere Kalender → Per URL hinzufügen → URL einfügen.

In Apple Kalender:
- Ablage → Neues Kalenderabonnement → URL einfügen.

---

## Updates einspielen

Neue App-Version (Code-Änderungen):
```bash
# SSH auf NAS
cd /volume1/docker/plan
git pull                           # falls du git nutzt, sonst Dateien per SFTP ersetzen
```
Dann im Container Manager: Projekt `plan` → **Erstellen** → „Image neu bauen" (Build).

Neue pb_hooks ohne Rebuild:
```bash
# Geänderte pb_hooks/main.pb.js hochladen, dann:
# Container Manager → plan → Container → Neu starten
```

---

## Backup

Der **einzige** Ordner, der gesichert werden muss:
```
/volume1/docker/plan/pb_data/
```
Er enthält die komplette SQLite-Datenbank und alle Uploads.

Mit **Hyper Backup** (Synology-Paket):
- Sicherungsaufgabe → Lokaler Ordner → Quelle: `/volume1/docker/plan/pb_data/`.
- Zeitplan: täglich, z. B. 03:00 Uhr.
- Ziel: zweite HDD im NAS oder externer USB-Datenträger.

---

## Architektur nach dem Umbau (Supabase → PocketBase)

### Backend-Äquivalente

| Supabase | PocketBase |
|---|---|
| `auth.users` + `profiles`-Tabelle | **users**-Collection (Auth-Collection, um `display_name`, `color`, `avatar_emoji` erweitert) |
| SQL-Tabellen (z. B. `tasks`) | **Collections** (gleiche Felder, `household`-Relation statt `household_id`) |
| Row Level Security (SQL-Policies) | **API Rules** (Filterausdrücke) pro Collection |
| `supabase.channel().subscribe()` | `pb.collection("x").subscribe(...)` (SSE-basiert) |
| Edge Function `ics` | Custom-Route in `pb_hooks/main.pb.js` |
| RPCs `create_household`, `redeem_invite`, `complete_task` | Hooks + Custom-Routes in `pb_hooks/main.pb.js` |
| Supabase CLI Migrations | `pb_migrations/` (JS, beim Start auto-eingespielt) |

### API-Rules (entsprechen den SQL-RLS-Policies)

Alle Inhalts-Collections (Aufgaben, Einkaufsartikel usw.) bekommen dieselbe Rule:

```
// Nur Mitglieder des zugehörigen Haushalts dürfen zugreifen
@request.auth.id != "" &&
household.members_via_household.user ?= @request.auth.id
```

Die `?=`-Syntax prüft „enthält mindestens ein Element mit diesem Wert" in der
Rückwärts-Relation — exakt dieselbe strikte Datentrennung wie mit SQL-RLS.

### Frontend-Datenlayer

Die UI (Tailwind, Komponenten, Routing, Design) bleibt **vollständig unverändert**.
Angepasst werden nur:

| Datei | Änderung |
|---|---|
| `src/lib/supabase.ts` | → `src/lib/pocketbase.ts` (PocketBase-Client-Instanz) |
| `src/hooks/useAuth.tsx` | PB Auth-Methoden statt Supabase Auth |
| `src/hooks/useHousehold.tsx` | PB Collections statt Supabase-Tables |
| `src/hooks/useRealtime.ts` | `pb.collection().subscribe()` statt Supabase-Channels |
| `src/pages/*.tsx` | Queries/Mutations auf PB SDK umgestellt |

---

## Nächste Schritte (Implementierung)

Sobald grünes Licht, wird in dieser Reihenfolge umgesetzt und commitet:

1. `pb_migrations/1_init.js` — Collections + API-Rules
2. `pb_hooks/main.pb.js` — Haushalt-Logik, Einladungen, Aufgaben-Wiederholung, ICS-Feed
3. `src/lib/pocketbase.ts` + Hooks (useAuth, useHousehold, useRealtime)
4. Alle Seiten auf PB SDK umstellen
5. `Dockerfile` + `docker-compose.yml`
6. `src/lib/supabase.ts` + Supabase-Abhängigkeiten entfernen
7. README und diese Datei auf finalen Stand bringen
