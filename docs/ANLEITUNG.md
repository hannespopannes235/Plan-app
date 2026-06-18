# 📋 Plan installieren – Schritt-für-Schritt-Anleitung für Einsteiger

Diese Anleitung führt dich **ohne Vorkenntnisse** durch die komplette Einrichtung:
die App läuft am Ende auf deiner **Synology DS218+** und lässt sich auf jedem
**Handy, Tablet und Computer** wie eine echte App nutzen.

Plan nutzt **PocketBase** als Backend – ein einziges, sehr sparsames Programm,
das Datenbank, Login und Echtzeit-Synchronisation mitbringt. Alles läuft in
**einem Docker-Container** auf deinem NAS. Es werden keine Cloud-Dienste benötigt.

> ⏱️ Zeitaufwand: ca. 30 Minuten. Du brauchst keinen Programmier-Hintergrund –
> nur Kopieren, Einfügen und Klicken.

---

## Inhalt

1. [Was du brauchst](#1-was-du-brauchst)
2. [Projektdateien auf den NAS laden](#2-projektdateien-auf-den-nas-laden)
3. [App im Container Manager starten](#3-app-im-container-manager-starten)
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

- Eine **Synology DS218+** mit **DSM 7.2** oder neuer (oben rechts → ⓘ zeigt die Version).
- Das Paket **Container Manager** (gibt es kostenlos im **Paket-Zentrum**).
- Die **Projektdateien** von Plan (dieser Ordner / dieses Repository).
- Einen Computer im selben Netzwerk wie das NAS.

> 💡 Die DS218+ hat 2 GB RAM – das reicht für PocketBase locker.

---

## 2. Projektdateien auf den NAS laden

1. Öffne **DSM** (die Weboberfläche deiner Synology) im Browser.
2. Starte die **File Station**.
3. Falls noch nicht vorhanden, lege im Bereich oben einen freigegebenen Ordner
   namens **`docker`** an (Container Manager nutzt ihn standardmäßig).
4. Erstelle darin einen Ordner **`plan`**. Der vollständige Pfad ist dann:
   ```
   /volume1/docker/plan
   ```
5. Lade **den kompletten Inhalt dieses Projekts** in diesen Ordner hoch
   (per File Station → „Hochladen", oder bequemer per Drag & Drop).

   Wichtig sind v. a. diese Dateien/Ordner:
   ```
   plan/
   ├── Dockerfile
   ├── docker-compose.yml
   ├── package.json
   ├── src/  …  (die App)
   ├── pb_migrations/   (Datenbank-Schema)
   └── pb_hooks/        (Server-Logik + Kalender)
   ```

> 🧑‍💻 **Schneller per Git (optional):** Wer mag, kann sich per SSH aufs NAS
> verbinden und `git clone <repo-url> /volume1/docker/plan` ausführen. Für die
> Anleitung ist das nicht nötig.

---

## 3. App im Container Manager starten

1. Öffne in DSM den **Container Manager**.
2. Gehe links auf **Projekt** und klicke **Erstellen**.
3. Fülle aus:
   - **Projektname:** `plan`
   - **Pfad:** klicke **Durchsuchen** und wähle `/volume1/docker/plan`.
   - **Quelle:** „docker-compose.yml verwenden" (wird automatisch erkannt).
4. Klicke **Weiter** und bestätige, bis der Bau startet.
5. Jetzt baut das NAS die App. **Das dauert beim ersten Mal 3–8 Minuten** –
   im Protokoll-Fenster läuft Text durch. Das ist normal.
6. Fertig, wenn im Protokoll steht:
   ```
   Server started at http://0.0.0.0:8090
   ```

> ✅ **Geschafft, wenn der Container „läuft"/„running" anzeigt.**
> Falls der Bau abbricht, schau in [Problembehebung](#12-problembehebung).

---

## 4. Erste Einrichtung (Admin-Konto)

PocketBase braucht einmalig ein **Administrator-Konto** (das ist die „Hausmeister"-
Zugang für die Datenbank – nicht dein normales App-Konto).

1. Öffne im Browser:
   ```
   http://NAS-IP:8090/_/
   ```
   Ersetze `NAS-IP` durch die Adresse deines NAS, z. B. `http://192.168.1.50:8090/_/`.
   (Die IP findest du in DSM unter Systemsteuerung → Netzwerk, oder in deinem Router.)
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

Wenn es eine neue Version von Plan gibt:
1. Neue Projektdateien nach `/volume1/docker/plan` hochladen
   (bzw. `git pull`, falls per Git geholt).
2. Container Manager → Projekt **plan** → **Erstellen / Build** (Image neu bauen).
3. Der Container startet automatisch neu. Deine Daten in `pb_data` bleiben erhalten.

---

## 12. Problembehebung

**Der Bau (Build) bricht ab / „failed".**
Meist zu wenig Arbeitsspeicher beim Bauen. Schließe andere DSM-Pakete kurz oder
versuche den Build erneut. Notfalls die App auf dem PC bauen (`npm install`,
`npm run build`) und den Ordner `dist` mit hochladen – dann den `Dockerfile`-
Build-Schritt überspringen (frag gern nach, ich helfe beim Anpassen).

**Seite nicht erreichbar unter `:8090`.**
- Läuft der Container? Container Manager → Container sollte „running" zeigen.
- Richtige NAS-IP benutzt? In DSM unter Systemsteuerung → Info-Center prüfen.
- Anderer Dienst belegt Port 8090? In `docker-compose.yml` z. B. auf `8095:8090`
  ändern und neu bauen; dann `http://NAS-IP:8095` nutzen.

**„Server started" steht nicht im Protokoll / Fehler beim Start.**
Schau im Container-Protokoll nach der ersten roten Zeile. Wenn dort etwas zu
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
