# 📋 Plan – Familien-Haushalts-App

Eine geräteübergreifende Haushalts-Organizer-App für Familien & WGs mit
**Echtzeit-Synchronisation**, **Login** und **strikter Datentrennung pro Haushalt**.
Alle Mitglieder teilen dieselben Daten – ändert jemand etwas, sehen es alle sofort.

**Funktionen:** Einkaufslisten · Aufgaben/Putzplan · Essensplanung · Budget/Rechnungen ·
In-App-Kalender mit abonnierbarem `.ics`-Feed.

- 🇩🇪 Oberfläche komplett auf Deutsch
- 🌗 Hell- & Dunkelmodus
- 📱 PWA – im Browser lauffähig und auf allen Geräten installierbar (mobile-first bis Desktop)
- ⚡ Echtzeit-Sync über mehrere Geräte
- 🔒 Zugriffsregeln pro Haushalt (jeder sieht nur die eigenen Daten)
- 🏠 Selbst-gehostet auf dem eigenen NAS – keine Cloud nötig

---

## 👉 Installation auf der Synology (für Einsteiger)

Eine ausführliche, bebilderte Schritt-für-Schritt-Anleitung – inkl. Installation
auf dem **Handy** – findest du hier:

### ➡️ [docs/ANLEITUNG.md](docs/ANLEITUNG.md)

Kurzfassung (ein Container auf dem NAS, der App + Backend ausliefert):

1. Projektordner nach `/volume1/docker/plan` auf das NAS kopieren.
2. **Container Manager → Projekt → Erstellen** mit Pfad `/volume1/docker/plan`.
3. `http://NAS-IP:8090/_/` öffnen, Admin-Konto anlegen (Schema wird automatisch erstellt).
4. `http://NAS-IP:8090` öffnen, registrieren, Haushalt anlegen, loslegen.

---

## Tech-Stack

| Bereich   | Technologie |
|-----------|-------------|
| Frontend  | React + TypeScript + Vite |
| Styling   | Tailwind CSS + Radix UI (shadcn-Stil) |
| Backend   | **PocketBase** (Go + SQLite): Datenbank, Auth, Realtime, Zugriffsregeln, JS-Hooks |
| State     | TanStack Query + PocketBase-Realtime-Subscriptions (optimistische Updates) |
| Diagramme | Recharts |
| PWA       | `vite-plugin-pwa` |
| Hosting   | Ein Docker-Container auf Synology (PocketBase serviert API **und** PWA) |

> **Warum PocketBase?** Es ist ein einziges, sehr sparsames Programm (Datenbank +
> Auth + Realtime + Admin-UI in einem) und damit ideal für ein NAS mit wenig RAM.
> Ein Container liefert sowohl die API als auch die fertige PWA aus – gleicher
> Origin, kein CORS, ein Backup-Ordner.

---

## Lokale Entwicklung

Voraussetzung: Node 20+ und eine laufende PocketBase-Instanz.

### 1. PocketBase lokal starten

```bash
# PocketBase-Binary von https://pocketbase.io/docs/ herunterladen, dann:
./pocketbase serve --dir ./pb_data --hooksDir ./pb_hooks --migrationsDir ./pb_migrations
```

PocketBase läuft nun auf `http://127.0.0.1:8090`. Beim ersten Start unter
`http://127.0.0.1:8090/_/` ein Admin-Konto anlegen – die Migrationen aus
`pb_migrations/` legen das Schema automatisch an.

### 2. Frontend starten

```bash
cp .env.example .env        # VITE_PB_URL=http://127.0.0.1:8090 eintragen
npm install
npm run dev                 # läuft auf http://localhost:5173
```

> Im Docker-Betrieb auf dem NAS muss `VITE_PB_URL` **nicht** gesetzt werden –
> PocketBase liefert die App selbst aus (gleiche Herkunft).

---

## Projektstruktur

```
.
├── Dockerfile                 # Multi-Stage: PWA bauen + PocketBase (amd64)
├── docker-compose.yml         # Ein Service „plan", Volume: pb_data
├── pb_migrations/             # Collections + Zugriffsregeln (auto-angewendet)
│   └── 1700000000_init.js
├── pb_hooks/                  # Server-Logik: Einladungen einlösen + .ics-Feed
│   └── main.pb.js
├── scripts/gen-icons.mjs      # Erzeugt die PWA-Icons (ohne externe Tools)
├── src/
│   ├── components/            # UI-Primitives (shadcn-Stil), Layout, Avatar …
│   ├── hooks/                 # useAuth, useHousehold, useTheme, useRealtime
│   ├── lib/                   # PocketBase-Client, Query-Client, Utils, Konstanten
│   ├── pages/                 # Dashboard, Einkauf, Aufgaben, Essen, Budget, Kalender, Einstellungen
│   └── types/                 # Domänen-Typen (Spiegel der Collections)
├── docs/ANLEITUNG.md          # Einsteiger-Anleitung (NAS + Handy)
└── vite.config.ts             # inkl. PWA-Konfiguration
```

---

## Datenmodell & Zugriff

Collections (entsprechen den früheren SQL-Tabellen): `households`,
`household_members`, `invites`, `shopping_lists`, `shopping_items`, `tasks`,
`recipes`, `recipe_ingredients`, `meal_plan_entries`, `transactions`,
`recurring_bills`. Profilfelder (Name, Farbe, Emoji) liegen auf der
eingebauten `users`-Collection.

Jede inhaltliche Collection hat ein `household_id`-Relationsfeld. Die
**API Rules** erlauben Zugriff nur Mitgliedern des jeweiligen Haushalts:

```
@request.auth.id != "" && household_id.household_members_via_household_id.user_id ?= @request.auth.id
```

Server-Logik in `pb_hooks/main.pb.js`:
- `POST /api/plan/redeem-invite` – Einladungs-Code einlösen (Mitglied werden)
- `GET /ics/:token` – abonnierbarer Kalender-Feed pro Haushalt

---

## Skripte

| Befehl | Zweck |
|--------|-------|
| `npm run dev` | Dev-Server (Hot Reload) |
| `npm run build` | Produktions-Build (Typecheck + Vite) |
| `npm run preview` | Build lokal testen |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript prüfen |
| `node scripts/gen-icons.mjs` | PWA-Icons neu erzeugen |

---

## Architektur-Hinweise

- **Sicherheit:** Zugriff wird über PocketBase-API-Rules je Collection erzwungen
  (Äquivalent zu Row Level Security). Der Kalender-Feed ist über ein geheimes,
  pro Haushalt zufälliges `ics_token` abgesichert.
- **Echtzeit:** Pro Collection wird eine Realtime-Subscription abonniert; bei
  Änderungen wird der passende TanStack-Query-Key invalidiert. Abhaken/Erledigen
  nutzt zusätzlich **optimistische Updates** für sofortiges Feedback.
- **Wiederkehrende Aufgaben** regenerieren sich beim Abschließen automatisch
  (nächste Instanz mit neuem Fälligkeitsdatum).
- **Login:** E-Mail + Passwort, ohne E-Mail-Bestätigung (kein Mailserver nötig).
