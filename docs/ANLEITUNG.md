# 📋 Plan installieren – Schritt-für-Schritt-Anleitung für Einsteiger

Diese Anleitung führt dich **ohne Vorkenntnisse** durch die komplette Einrichtung:
die App läuft am Ende auf deiner **Synology DS218+** und lässt sich auf jedem
**Handy, Tablet und Computer** wie eine echte App nutzen.

Plan nutzt **PocketBase** als Backend – ein einziges, sehr sparsames Programm,
das Datenbank, Login und Echtzeit-Synchronisation mitbringt. Alles läuft in
**einem Docker-Container** auf deinem NAS. Es werden keine Cloud-Dienste benötigt.

> ⏱️ Zeitaufwand: ca. 30–40 Minuten. Du brauchst keinen Programmier-Hintergrund –
> nur Kopieren, Einfügen und Klicken.

---

## Inhalt

1. [Was du brauchst](#1-was-du-brauchst)
2. [Projektdateien auf den NAS laden](#2-projektdateien-auf-den-nas-laden)
3. [SSH aktivieren und App starten](#3-ssh-aktivieren-und-app-starten)
4. [Erste Einrichtung (Admin-Konto)](#4-erste-einrichtung-admin-konto)
5. [App im Browser öffnen & dein Konto anlegen](#5-app-im-browser-öffnen--dein-konto-anlegen)
6. [Auf dem Handy installieren](#6-auf-dem-handy-installieren)
7. [Familie/WG einladen](#7-familiewg-einladen)
8. [Kalender abonnieren](#8-kalender-abonnieren)
9. [Von unterwegs erreichbar machen (HTTPS)](#9-von-unterwegs-erreichbar-machen-https)
10. [Backups einrichten](#10-backups-einrichten)
11. [Updates einspielen](#11-updates-einspielen)
12. [Problembehebung](#12-problembehebung)

---

## 1. Was du brauchst

- Eine **Synology DS218+** mit **DSM 7.1.1** (Version oben rechts → ⓘ prüfen).
- Das Paket **Docker** aus dem **Paket-Zentrum** (kostenlos, dazu gleich mehr).
- Die **Projektdateien** von Plan (dieser Ordner / dieses Repository).
- Einen Computer im selben Netzwerk wie das NAS.

> 💡 Die DS218+ hat 2 GB RAM – das reicht für PocketBase locker aus.

> ℹ️ **DSM 7.1.1 nutzt das Paket „Docker"** (nicht „Container Manager", das erst
> ab DSM 7.2 verfügbar ist). Die Bedienung unterscheidet sich etwas, funktioniert
> aber genauso gut.

---

## 2. Projektdateien auf den NAS laden

### 2a. Docker-Paket installieren

1. Öffne **DSM** (die Weboberfläche deiner Synology) im Browser.
2. Starte das **Paket-Zentrum** (das blaue Einkaufskorb-Symbol).
3. Suche nach **Docker**, klicke auf das Paket und dann auf **Installieren**.
4. Warte bis die Installation abgeschlossen ist (~1 Min.).

### 2b. Projektordner anlegen und Dateien hochladen

1. Starte die **File Station** in DSM.
2. Falls noch nicht vorhanden, lege einen freigegebenen Ordner **`docker`** an
   (Klick auf das **+**-Symbol ganz oben links in der Ordnerliste).
3. Erstelle darin einen Unterordner **`plan`**. Der vollständige Pfad ist dann:
   ```
   /volume1/docker/plan
   ```
4. Lade **den kompletten Inhalt dieses Projekts** in diesen Ordner hoch
   (File Station → Ordner `plan` öffnen → oben **Hochladen** → Dateien auswählen).

   Wichtig sind v. a. diese Dateien/Ordner:
   ```
   plan/
   ├── Dockerfile
   ├── docker-compose.yml
   ├── package.json
   ├── src/             (die App)
   ├── pb_migrations/   (Datenbank-Schema)
   └── pb_hooks/        (Server-Logik + Kalender)
   ```

> 🧑‍💻 **Schneller per Git (optional):** Wer SSH hat (nächster Abschnitt), kann
> direkt `git clone <repo-url> /volume1/docker/plan` ausführen. Für die
> Anleitung ist das nicht nötig.

---

## 3. SSH aktivieren und App starten

Die App wird über die **Kommandozeile (SSH)** gestartet – das klingt technisch,
ist aber eine Sache von wenigen Befehlen. Folge einfach den Schritten.

### 3a. SSH in DSM aktivieren

1. DSM → **Systemsteuerung** → **Terminal & SNMP**.
2. Häkchen bei **SSH-Dienst aktivieren** setzen. Port bleibt auf `22`.
3. Auf **Anwenden** klicken.

### 3b. SSH-Verbindung öffnen

**Auf dem Mac / Linux:**
1. Öffne das Programm **Terminal** (Spotlight → „Terminal").
2. Tippe folgenden Befehl ein (ersetze `NAS-IP` durch die IP deines NAS):
   ```
   ssh admin@NAS-IP
   ```
   z. B. `ssh admin@192.168.1.50`
3. Bestätige mit `yes`, wenn du gefragt wirst, ob du verbinden willst.
4. Gib dein **DSM-Passwort** ein (du siehst keine Zeichen beim Tippen – das ist normal).

**Auf Windows:**
1. Öffne **PowerShell** oder **Eingabeaufforderung** (Windows-Taste → suche „PowerShell").
2. Tippe:
   ```
   ssh admin@NAS-IP
   ```
   z. B. `ssh admin@192.168.1.50`
3. Bestätige mit `yes` und gib dein DSM-Passwort ein.

> ℹ️ Funktioniert das nicht, weil `ssh` nicht gefunden wird? Installiere
> **PuTTY** (putty.org), trage dort die NAS-IP ein und klicke „Open".

**Ergebnis:** Du siehst eine Zeile wie `admin@DiskStation:~$` – du bist drin.

### 3c. App bauen und starten

Gib diese Befehle **nacheinander** ein und drücke nach jedem Enter:

```bash
sudo -i
```
*(Gibt dir Admin-Rechte; dein DSM-Passwort wird nochmals abgefragt.)*

```bash
cd /volume1/docker/plan
```
*(Wechselt in den Projektordner.)*

> ⚠️ **Wichtig:** Prüfe mit `ls`, dass hier die Datei `docker-compose.yml` liegt.
> Beim Hochladen landen die Dateien oft versehentlich in einem **Unterordner**
> (z. B. `Plan-app-main`). Steht in der Liste nur ein Ordnername statt der
> Projektdateien, wechsle hinein, bevor du weitermachst:
> ```bash
> cd /volume1/docker/plan/Plan-app-main   # Name an deine Ausgabe anpassen
> ```

```bash
mkdir -p pb_data
```
*(Legt den Daten-Ordner an. Docker auf der Synology erstellt ihn nicht von selbst –
ohne diesen Schritt bricht der Start mit „Bind mount failed … does not exists" ab.)*

```bash
docker-compose up -d --build
```
*(Baut die App und startet den Container im Hintergrund.)*

**Das dauert beim ersten Mal 5–15 Minuten** – Docker lädt Pakete herunter und
baut die App. Die Ausgabe zeigt laufend Fortschritt. Am Ende erscheint:

```
Creating plan ... done
```

Warte auf diese Zeile, dann ist alles fertig.

### 3d. Läuft der Container?

Prüfe es mit:
```bash
docker ps
```
Du siehst eine Zeile mit `plan` und dem Status **Up** – alles gut!

Den Container-Status siehst du auch in DSM unter **Docker** (das Programm aus
dem Paket-Zentrum) → Reiter **Container** → dort steht `plan` mit grünem Punkt.

> ✅ **Fertig!** Du kannst das SSH-Fenster jetzt schließen. Der Container läuft
> weiter, auch nach einem NAS-Neustart.

---

## 4. Erste Einrichtung (Admin-Konto)

PocketBase braucht einmalig ein **Administrator-Konto** (das ist der „Hausmeister"-
Zugang für die Datenbank – nicht dein normales App-Konto).

1. Öffne im Browser:
   ```
   http://NAS-IP:8090/_/
   ```
   Ersetze `NAS-IP` durch die Adresse deines NAS, z. B. `http://192.168.1.50:8090/_/`.
   (Die IP findest du in DSM unter Systemsteuerung → Info-Center, oder in deinem Router.)
2. Lege beim ersten Aufruf **E-Mail + Passwort** für den Admin fest. **Gut merken!**
3. Das Datenbank-Schema (Einkaufslisten, Aufgaben, …) wird **automatisch** angelegt –
   du musst hier nichts weiter einstellen.

> 🔐 Dieses Admin-Konto brauchst du im Alltag nicht. Es ist nur für Wartung/Backup.

---

## 5. App im Browser öffnen & dein Konto anlegen

1. Öffne im Browser:
   ```
   http://NAS-IP:8090
   ```
   (Diesmal **ohne** `/_/` am Ende.) Es erscheint der **Plan**-Anmeldebildschirm. 🎉
2. Klicke **Registrieren** und lege dein persönliches Konto an
   (Name, E-Mail, Passwort mit mind. 8 Zeichen).
   > E-Mail-Bestätigung ist **nicht** nötig – du bist sofort angemeldet.
3. Klicke **Haushalt erstellen** und gib ihm einen Namen (z. B. „Familie Müller").
4. Lege in den **Einstellungen** deine Farbe und dein Emoji fest, damit alle
   sehen, wem was gehört.

**Fertig – die App läuft!** Jetzt nur noch aufs Handy bringen.

---

## 6. Auf dem Handy installieren

Plan ist eine **PWA**: Sie installiert sich direkt aus dem Browser, ganz ohne
App Store. Voraussetzung: Das Handy ist im **selben WLAN** wie das NAS
(für unterwegs siehe [Abschnitt 9](#9-von-unterwegs-erreichbar-machen-https)).

### iPhone / iPad (Safari)
1. Öffne in **Safari**: `http://NAS-IP:8090`
2. Tippe unten auf das **Teilen-Symbol** (Quadrat mit Pfeil nach oben).
3. Wähle **„Zum Home-Bildschirm"**.
4. Tippe **„Hinzufügen"**. Plan liegt jetzt als App-Symbol auf dem Home-Bildschirm.

### Android (Chrome)
1. Öffne in **Chrome**: `http://NAS-IP:8090`
2. Tippe oben rechts auf die **drei Punkte** (⋮).
3. Wähle **„App installieren"** bzw. **„Zum Startbildschirm hinzufügen"**.
4. Bestätige. Plan erscheint als App im App-Menü.

### Computer (Chrome/Edge)
In der Adressleiste erscheint rechts ein **Installieren-Symbol** (Bildschirm mit Pfeil) –
anklicken, fertig.

> 📱 Die App öffnet sich danach im Vollbild wie eine normale App. Änderungen, die
> jemand auf einem Gerät macht, erscheinen **sofort** auf allen anderen.

> 💡 **Volle App-Erfahrung nur mit HTTPS.** Über `http://NAS-IP:8090` funktioniert
> die App vollständig, und „Zum Home-Bildschirm" klappt auch. Die **Offline-Nutzung**
> und automatische App-Updates im Hintergrund (der sogenannte „Service Worker")
> aktivieren sich aber erst, wenn du die App über eine **HTTPS-Adresse** öffnest.
> Wer das möchte, richtet einmalig [Variante B in Abschnitt 9](#9-von-unterwegs-erreichbar-machen-https)
> ein und installiert die App dann über `https://deinname.synology.me`.

---

## 7. Familie/WG einladen

1. Gehe in der App auf **Einstellungen → Einladen**.
2. Klicke **„Neuen Einladungs-Code erstellen"**. Es erscheint ein Code wie `7F3KQM`.
3. Gib den Code an deine Mitbewohner:innen weiter (WhatsApp, Zettel, …).
4. Die anderen:
   - öffnen `http://NAS-IP:8090` (oder eure Domain) auf ihrem Gerät,
   - **registrieren** sich,
   - wählen **„Einem Haushalt beitreten"** und geben den Code ein.
5. Ab sofort teilt ihr alle dieselben Listen, Aufgaben, Termine und Ausgaben.

---

## 8. Kalender abonnieren

So landen Aufgaben, Mahlzeiten und Rechnungs-Fälligkeiten automatisch in eurem
gewohnten Kalender (Google/Apple):

1. In der App auf **Kalender** gehen.
2. Oben die **Kalender-URL** kopieren (Knopf mit dem Kopier-Symbol).
   Sie sieht so aus: `http://NAS-IP:8090/ics/xxxxxxxx`
3. **Google Kalender:** Andere Kalender → **Per URL** → URL einfügen.
   **Apple Kalender:** Ablage → **Neues Kalenderabonnement** → URL einfügen.

> 🔄 Der Kalender aktualisiert sich von selbst (je nach Anbieter alle paar Stunden).
> Für den Zugriff von unterwegs muss das NAS von außen erreichbar sein
> (siehe nächster Abschnitt).

---

## 9. Von unterwegs erreichbar machen (HTTPS)

Im Heim-WLAN funktioniert alles über `http://NAS-IP:8090`. Damit die App auch
**unterwegs** läuft (und damit Kalender-Abos zuverlässig sind), gibt es zwei Wege:

### Variante A – Sicher & ohne Internet-Freigabe: VPN (empfohlen für Anfänger)
1. DSM → **Paket-Zentrum** → **VPN Server** installieren.
2. VPN einrichten (z. B. OpenVPN) und auf dem Handy die Synology-App
   **„VPN Plus"** oder eine OpenVPN-App nutzen.
3. Unterwegs VPN einschalten → das Handy ist „virtuell zuhause" und erreicht
   `http://NAS-IP:8090` wie gewohnt.

→ Kein Port im Router öffnen, kein eigenes Zertifikat nötig. Am sichersten.

> ℹ️ Auch mit VPN bleibt die Adresse `http://NAS-IP:8090` – die volle PWA mit
> Offline-Funktion (Service Worker) gibt es nur über HTTPS, also über Variante B.

### Variante B – Eigene Adresse mit HTTPS (für den Dauerbetrieb)
1. **DDNS einrichten:** DSM → Systemsteuerung → **Externer Zugriff → DDNS** →
   Synology-Adresse anlegen (z. B. `deinname.synology.me`).
2. **Ports freigeben:** im Router Port **443** auf das NAS weiterleiten.
3. **Reverse Proxy:** DSM → Systemsteuerung → **Anmeldeportal → Erweitert →
   Reverse Proxy → Erstellen:**
   - Quelle: HTTPS, Hostname `deinname.synology.me`, Port `443`
   - Ziel: HTTP, Hostname `localhost`, Port `8090`
   - Im Reiter **„Eigene Kopfzeile" → „WebSocket erstellen"** aktivieren
     (wichtig für die Echtzeit-Synchronisation).
4. **Zertifikat:** DSM → Systemsteuerung → **Sicherheit → Zertifikat →
   Hinzufügen → Let's Encrypt** mit deiner DDNS-Domain. HTTPS wird automatisch verlängert.
5. Du erreichst Plan jetzt unter `https://deinname.synology.me`.
   Installiere die App auf dem Handy am besten gleich über **diese** Adresse.
   Über HTTPS aktiviert sich automatisch der **Service Worker** – damit
   funktioniert die App auch offline und aktualisiert sich im Hintergrund.

> 🔒 Sicherheits-Tipp: Aktiviere in DSM die Firewall und (für den Admin-Zugang
> `/_/`) die 2-Faktor-Authentifizierung.

---

## 10. Backups einrichten

Alle Daten liegen in **einem** Ordner:
```
/volume1/docker/plan/pb_data
```

So sicherst du ihn automatisch:
1. DSM → **Paket-Zentrum** → **Hyper Backup** installieren.
2. Neue Sicherungsaufgabe → Ziel z. B. externe USB-Festplatte oder zweiter Ordner.
3. Als Quelle den Ordner `docker/plan/pb_data` auswählen.
4. Zeitplan einstellen (z. B. täglich nachts).

> 💾 Zum Wiederherstellen einfach den gesicherten `pb_data`-Ordner zurückspielen.

---

## 11. Updates einspielen

Bei einer neuen Version gibt es drei Wege – vom umständlich bis vollautomatisch.
**Deine Daten in `pb_data` bleiben bei allen Wegen erhalten.**

### Weg A – Dateien manuell hochladen (ohne Git)
Funktioniert immer, ist aber fehleranfällig (man vergisst leicht eine Datei):
1. Geänderte Projektdateien per **File Station** nach `/volume1/docker/plan`
   hochladen (überschreiben).
2. Per SSH neu bauen:
   ```bash
   sudo -i
   cd /volume1/docker/plan
   docker-compose up -d --build
   ```

### Weg B – Update per Git (empfohlen) 🟢
Einmalige Einrichtung, danach ist jedes Update **ein einziger Befehl**.

**Einmalig einrichten** (holt das Projekt sauber als Git-Kopie):
1. Per SSH verbinden und Git installieren bzw. prüfen:
   ```bash
   sudo -i
   git --version    # zeigt eine Versionsnummer? Dann ist Git schon da.
   ```
   Fehlt Git, im **Paket-Zentrum** das Paket **Git Server** installieren
   (es bringt den `git`-Befehl mit).
2. **Wichtig – Daten sichern**, falls schon Daten drin sind:
   ```bash
   cd /volume1/docker
   cp -r plan/pb_data /volume1/docker/pb_data_backup    # Sicherheitskopie
   ```
3. Alten Ordner durch eine Git-Kopie ersetzen und Daten zurücklegen:
   ```bash
   cd /volume1/docker
   mv plan plan_alt
   git clone <REPO-URL> plan
   cp -r plan_alt/pb_data plan/pb_data    # vorhandene Daten übernehmen
   ```
   *(`<REPO-URL>` ist die Adresse dieses Repositorys.)*
4. Einmal bauen:
   ```bash
   cd /volume1/docker/plan
   mkdir -p pb_data
   docker-compose up -d --build
   ```
5. Läuft alles, kannst du `plan_alt` löschen: `rm -rf /volume1/docker/plan_alt`.

**Ab jetzt updaten** – das ist alles:
```bash
sudo sh /volume1/docker/plan/update.sh
```
Das mitgelieferte Skript `update.sh` holt die neueste Version (`git pull`),
baut den Container neu und räumt alte Images auf.

### Weg C – Updates automatisieren (Aufgabenplaner) 🤖
So aktualisiert sich Plan z. B. **jeden Sonntagnacht** von selbst (setzt Weg B voraus):

1. DSM → **Systemsteuerung** → **Aufgabenplaner**.
2. **Erstellen → Geplante Aufgabe → Benutzerdefiniertes Skript**.
3. Reiter **Allgemein:**
   - Aufgabe: `Plan aktualisieren`
   - Benutzer: **root**
4. Reiter **Zeitplan:** z. B. **wöchentlich, Sonntag, 03:00 Uhr**.
5. Reiter **Aufgabeneinstellungen:**
   - Optional **„Details per E-Mail senden"** anhaken (du bekommst das Protokoll zugeschickt).
   - **Befehl ausführen:**
     ```bash
     sh /volume1/docker/plan/update.sh
     ```
6. Speichern. Fertig – Plan hält sich nun selbst aktuell.

> ⚠️ **Hinweis zur Automatik:** Ein automatischer Rebuild braucht kurz mehr
> Arbeitsspeicher und CPU. Plane ihn nachts, wenn das NAS nichts anderes tut.
> Wer lieber die Kontrolle behält, lässt Weg C weg und führt `update.sh` einfach
> bei Bedarf von Hand aus (Weg B).

---

## 12. Problembehebung

**Docker nicht im Paket-Zentrum zu finden.**
Suche genau nach „Docker" (mit großem D). Falls nicht verfügbar: DSM-Version
prüfen (DSM 7.x sollte Docker unterstützen), oder DSM aktualisieren.

**`docker-compose` Befehl nicht gefunden (nach `sudo -i`).**
Das Docker-Paket installiert `docker-compose` normalerweise automatisch. Falls nicht:
```bash
docker compose up -d --build
```
(ohne Bindestrich – neuere Docker-Versionen nutzen `docker compose` statt `docker-compose`).

**Der Bau (Build) bricht ab / läuft sehr lange.**
Meist zu wenig Arbeitsspeicher beim Bauen. Schließe andere DSM-Pakete kurz.
Notfalls die App auf dem PC bauen und das fertige `dist`-Verzeichnis mitliefern:
```bash
# auf dem PC (nicht dem NAS):
npm install && npm run build
# dann dist/ auf /volume1/docker/plan/dist hochladen
```
Melde dich, wenn du Hilfe beim Anpassen brauchst.

**„Bind mount failed: '/volume1/docker/plan/pb_data' does not exists".**
Docker auf der Synology legt den Daten-Ordner nicht automatisch an. Einmalig
erstellen und neu starten:
```bash
cd /volume1/docker/plan
mkdir -p pb_data
docker-compose up -d --build
```

**Seite nicht erreichbar unter `:8090`.**
- Läuft der Container? DSM → **Docker** → **Container** → `plan` sollte grün sein.
- Richtige NAS-IP benutzt? In DSM unter Systemsteuerung → Info-Center prüfen.
- Anderer Dienst belegt Port 8090? In `docker-compose.yml` den Port auf z. B.
  `8095:8090` ändern und neu bauen; dann `http://NAS-IP:8095` nutzen.

**Protokoll/Logs anschauen.**
Entweder in DSM → Docker → Container → `plan` → Reiter **Protokoll**, oder
per SSH:
```bash
docker logs plan
```
Wenn dort etwas zu „migration" steht, kopiere mir die Meldung.

**„Server started" erscheint nicht im Protokoll / Fehler beim Start.**
Schau nach der ersten roten Zeile im Protokoll. Wenn dort etwas zu
„migration" steht, kopiere mir die Meldung – das Schema lässt sich schnell anpassen.

**Änderungen erscheinen nicht sofort auf anderen Geräten (Echtzeit).**
- Bei Zugriff über die HTTPS-Domain: im Reverse Proxy **WebSocket aktivieren**
  (siehe Abschnitt 9, Variante B, Schritt 3).
- Die App holt Daten auch ohne Echtzeit beim erneuten Öffnen nach.

**Passwort vergessen (App-Konto).**
Im Admin-UI (`/_/`) unter **Collections → users** kann der Admin das Konto
bearbeiten oder ein neues Passwort setzen.

**E-Mails / Magic-Link.**
Diese Installation nutzt bewusst **nur Passwort-Login** ohne E-Mail-Versand –
das ist am einfachsten und braucht keinen Mailserver.

---

Viel Freude mit **Plan**! Bei Fragen oder Wünschen einfach melden. 💛
