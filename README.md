# 📋 Plan – Familien-Haushalts-App

Eine geräteübergreifende Haushalts-Organizer-App für Familien & WGs mit **Echtzeit-Synchronisation**, **Login** und **strikter Datentrennung pro Haushalt**. Alle Mitglieder teilen dieselben Daten – ändert jemand etwas, sehen es alle sofort.

**Funktionen:** Einkaufslisten · Aufgaben/Putzplan · Essensplanung · Budget/Rechnungen · In-App-Kalender mit abonnierbarem `.ics`-Feed.

- 🇩🇪 Oberfläche komplett auf Deutsch
- 🌗 Hell- & Dunkelmodus
- 📱 PWA – im Browser lauffähig und auf allen Geräten installierbar (mobile-first bis Desktop)
- ⚡ Echtzeit-Sync über mehrere Geräte
- 🔒 Row Level Security: jeder Haushalt sieht nur seine eigenen Daten

---

## Tech-Stack

| Bereich   | Technologie |
|-----------|-------------|
| Frontend  | React + TypeScript + Vite |
| Styling   | Tailwind CSS + Radix UI (shadcn-Stil) |
| Backend   | Supabase – Postgres, Auth, Realtime, RLS, Edge Function |
| State     | TanStack Query + Supabase-Realtime-Subscriptions (optimistische Updates) |
| Diagramme | Recharts |
| PWA       | `vite-plugin-pwa` |
| Routing   | React Router |

---

## Schnellstart

### 1. Supabase-Projekt anlegen

1. Konto auf [supabase.com](https://supabase.com) erstellen und ein neues Projekt anlegen (kostenloser Tarif genügt).
2. Im Dashboard unter **Project Settings → API** findest du:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

### 2. Datenbank-Schema einspielen

Öffne im Supabase-Dashboard den **SQL Editor**, füge den **kompletten Inhalt** von
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) ein und führe ihn aus.

Das legt alle Tabellen an, aktiviert **Row Level Security** mit passenden Policies, erstellt
Hilfsfunktionen (`create_household`, `redeem_invite`, `complete_task`) und aktiviert **Realtime**
für die relevanten Tabellen.

> Alternativ mit der [Supabase CLI](https://supabase.com/docs/guides/cli):
> ```bash
> supabase link --project-ref <dein-ref>
> supabase db push
> ```

### 3. E-Mail-Auth konfigurieren

Unter **Authentication → Providers → Email** ist E-Mail/Passwort standardmäßig aktiv.
- Zum schnellen Ausprobieren kannst du **„Confirm email"** vorübergehend deaktivieren.
- Unter **Authentication → URL Configuration** die **Site URL** auf `http://localhost:5173`
  setzen (für Magic-Links / Bestätigungslinks).

### 4. Umgebungsvariablen setzen

```bash
cp .env.example .env
```

`.env` öffnen und die beiden Werte aus Schritt 1 eintragen:

```env
VITE_SUPABASE_URL=https://dein-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=dein-anon-key
```

### 5. Installieren & starten

```bash
npm install
npm run dev
```

App läuft auf **http://localhost:5173**.

---

## Erste Schritte in der App

1. **Registrieren** (E-Mail + Passwort oder Magic-Link).
2. **Haushalt erstellen** – du wirst Eigentümer:in.
3. Unter **Einstellungen → Einladen** einen **Einladungs-Code** erzeugen und teilen.
   Andere registrieren sich und geben den Code beim Onboarding ein → sie teilen jetzt eure Daten.
4. Profil anpassen (Name, **Farbe & Avatar**), damit auf einen Blick erkennbar ist, wem was gehört.
5. Loslegen: Einkaufslisten, Aufgaben, Essensplan, Budget – Änderungen erscheinen bei allen in Echtzeit.

---

## Kalender abonnieren (`.ics`)

Pro Haushalt gibt es eine **abonnierbare Kalender-URL** (zu finden unter **Kalender**), die
Aufgaben-Fälligkeiten, Mahlzeiten und Rechnungs-Fälligkeiten zusammenführt. Einmal in Google-/
Apple-Kalender als „Kalender per URL abonnieren" eintragen → Termine erscheinen dort und
aktualisieren sich automatisch.

Die URL wird von einer **Supabase Edge Function** bereitgestellt
([`supabase/functions/ics`](supabase/functions/ics/index.ts)) und über ein geheimes, pro Haushalt
zufälliges `ics_token` abgesichert (kein Login im Kalender-Client nötig).

### Edge Function deployen

```bash
# Supabase CLI installieren: https://supabase.com/docs/guides/cli
supabase functions deploy ics --no-verify-jwt --project-ref <dein-ref>
```

Die Function nutzt `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` – beide werden von Supabase
automatisch als Secrets bereitgestellt. Falls deine Edge-Function-Domain abweicht, kannst du sie
über `VITE_ICS_BASE_URL` in der `.env` überschreiben.

---

## Als PWA installieren

Nach `npm run build && npm run preview` (oder im Deployment) bietet der Browser „Installieren" an.
Auf dem Handy: Teilen → „Zum Home-Bildschirm". Die App-Shell funktioniert offline; Schreibvorgänge
benötigen eine Verbindung zu Supabase.

---

## Deployment

- **Frontend:** Vercel oder Netlify. Build-Command `npm run build`, Output-Verzeichnis `dist`.
  Die beiden `VITE_*`-Variablen als Environment Variables hinterlegen.
- **Backend:** Supabase (Migration + Edge Function wie oben).

Wichtig: Nach dem Deployment die **Site URL** und **Redirect URLs** in Supabase auf die
Produktions-Domain anpassen.

---

## Projektstruktur

```
.
├── supabase/
│   ├── migrations/0001_init.sql   # Schema + RLS-Policies + Funktionen + Realtime
│   ├── functions/ics/index.ts     # Edge Function: abonnierbarer .ics-Feed
│   └── config.toml                # Supabase-CLI-Konfiguration (optional)
├── scripts/gen-icons.mjs          # Erzeugt die PWA-Icons (ohne externe Tools)
├── src/
│   ├── components/                # UI-Primitives (shadcn-Stil), Layout, Avatar …
│   ├── hooks/                     # useAuth, useHousehold, useTheme, useRealtime
│   ├── lib/                       # Supabase-Client, Query-Client, Utils, Konstanten
│   ├── pages/                     # Dashboard, Einkauf, Aufgaben, Essen, Budget, Kalender, Einstellungen
│   ├── types/                     # Domänen-Typen (Spiegel des SQL-Schemas)
│   ├── App.tsx                    # Routing + Auth-/Onboarding-Gating
│   └── main.tsx                   # Provider-Setup
├── .env.example
└── vite.config.ts                 # inkl. PWA-Konfiguration
```

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

## Architektur-Entscheidungen & Annahmen

- **Sicherheit / RLS:** Jede inhaltliche Tabelle hat `household_id`. Eine `SECURITY DEFINER`-Funktion
  `is_household_member()` verhindert Rekursion in den Policies. Haushalt erstellen und Einladung
  einlösen laufen über atomare RPCs (`create_household`, `redeem_invite`), damit der Ersteller
  zuverlässig als Mitglied eingetragen wird, ohne die Policies aufzuweichen.
- **Echtzeit:** Pro Tabelle wird ein Realtime-Channel gefiltert nach `household_id` abonniert; bei
  Änderungen wird der passende TanStack-Query-Key invalidiert. Abhaken/Erledigen nutzt zusätzlich
  **optimistische Updates** für sofortiges Feedback.
- **Wiederkehrende Aufgaben** regenerieren sich serverseitig: `complete_task()` markiert die Instanz
  als erledigt und legt – bei Wiederholung – automatisch die nächste offene Instanz an.
- **Kalender-Feed** bewusst als read-only `.ics` (robust, kein OAuth nötig). Bidirektionale
  Google-Sync wäre die spätere Kür-Erweiterung.
- **Magic-Link & Passwort** werden beide unterstützt; das Profil (`profiles`) wird per Trigger bei
  Registrierung automatisch angelegt.
