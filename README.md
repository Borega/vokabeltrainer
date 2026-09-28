# Vokabeltrainer

Ein schlanker Vokabeltrainer für Schulen. Lehrkräfte legen Wortlisten an (im Editor oder per CSV-Import)
und weisen sie Klassen bzw. Kursen zu. Schüler:innen lernen mit **Karteikarten** (umdrehen und selbst
einschätzen) oder durch **Eintippen** mit automatischer Prüfung – in beide Richtungen.

Die Anmeldung läuft über **OpenID Connect**, z. B. über das Single-Sign-On von **IServ**.
Gruppen (Klassen/Kurse) und die Rolle „Lehrkraft“ werden direkt aus IServ übernommen.

## Funktionen

**Für Lehrkräfte**
- Listen im Browser-Editor anlegen und bearbeiten (Enter springt in die nächste Zeile)
- CSV-Import und -Export (Semikolon, Komma oder Tab; Kopfzeile wie `Englisch;Deutsch` wird erkannt)
- Pro Liste festlegen:
  - Abfrage als **Karteikarten** oder **Eintippen**
  - beim Eintippen: Groß-/Kleinschreibung und Akzente/Umlaute beachten – ja/nein
  - Standard-Richtung (A → B, B → A, gemischt) und ob Schüler:innen sie wechseln dürfen
- Liste einer oder mehreren IServ-Gruppen zuweisen
- Listen **für Kolleg:innen freigeben** (freiwillig, pro Liste): Andere Lehrkräfte finden sie unter
  „Geteilte Listen“, können sie ausprobieren und eine eigene Kopie anlegen, die sie frei bearbeiten und
  ihren Gruppen zuweisen. Das Original bleibt unverändert, Lernstände werden nicht geteilt.
- **Auswertung** je Gruppe: wie viele Wörter jede:r sicher kann, richtig/falsch, zuletzt aktiv, schwierigste Wörter

**Für Schüler:innen**
- sehen nur Listen ihrer Gruppen
- Richtung wählen (sofern erlaubt), Rundengröße 10 / 20 / alle
- Lernkartei-Prinzip (Leitner): unsichere Wörter kommen zuerst, falsche Wörter werden in der Runde wiederholt
- Lernstand wird auf dem Server gespeichert und ist auf allen Geräten verfügbar
- Tastatur: Leertaste = umdrehen, ← / → = nicht gewusst / gewusst, Enter = prüfen / weiter

**Prüfregeln beim Eintippen**
- Mehrere richtige Lösungen mit `;` oder `|` trennen: `big; large`
- Teile in Klammern sind optional: `(to) go` akzeptiert `go` und `to go`
- Leerzeichen und `.` `!` `?` am Ende zählen nicht
- Kleine Tippfehler werden als „Fast!“ angezeigt (zählen als falsch, mit „Ich hatte recht“ korrigierbar)

## Installation (Docker)

Voraussetzungen: ein Server mit Docker und ein Reverse-Proxy mit HTTPS (z. B. Caddy, nginx, Traefik).

```bash
mkdir vokabeltrainer && cd vokabeltrainer
curl -O https://raw.githubusercontent.com/Borega/vokabeltrainer/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/Borega/vokabeltrainer/main/.env.example
# .env anpassen (siehe unten), dann:
docker compose up -d
```

Die Datenbank (SQLite) liegt im Docker-Volume `vokabeltrainer-data` – dieses Volume gehört in die Datensicherung.

**Portainer:** Stack-Vorlage und Variablen in [`deploy/portainer/`](deploy/portainer/).

**nginx:** fertige Konfiguration mit HTTPS (Let's Encrypt) und Installationsschritten in
[`deploy/nginx/vokabeltrainer.conf`](deploy/nginx/vokabeltrainer.conf).

Beispiel für Caddy (holt das Zertifikat automatisch):

```
vokabeln.meine-schule.de {
    reverse_proxy 127.0.0.1:3000
}
```

## Anbindung an IServ

1. In IServ als Admin: **Verwaltung → System → Single-Sign-On → Hinzufügen**
   ([IServ-Doku](https://doku.iserv.de/manage/system/sso/))
   - **Name:** Vokabeltrainer
   - **Vertrauenswürdig:** ja (sonst müssen Nutzer:innen bei jeder Anmeldung zustimmen)
   - **Redirect-URI:** `https://vokabeln.meine-schule.de/auth/callback`
   - **Grant-Typ:** Authorization Code
   - **Scopes:** `openid`, `profile`, `iserv:groups`, `iserv:roles`
   - optional: Zugriff auf bestimmte Gruppen/Rollen beschränken
2. Client-ID und Client-Secret in die `.env` eintragen:
   ```
   BASE_URL=https://vokabeln.meine-schule.de
   OIDC_ISSUER=https://meine-schule.de
   OIDC_CLIENT_ID=…
   OIDC_CLIENT_SECRET=…
   ```
3. **Lehrkraft-Erkennung prüfen:** Einmalig `OIDC_LOG_CLAIMS=true` setzen, neu starten und als Lehrkraft
   anmelden. Im Log (`docker compose logs`) erscheinen die übermittelten Gruppen und Rollen. Passend dazu
   `TEACHER_ROLES` bzw. `TEACHER_GROUPS` setzen (Standard: Rolle `ROLE_TEACHER`/`Lehrer` oder Gruppe `lehrer`).
   Danach `OIDC_LOG_CLAIMS` wieder ausschalten.

Laut Erfahrungsberichten muss die SSO-Konfiguration in IServ teils erst durch den IServ-Support
aktiviert werden (Neustart von Diensten).

### Andere Anbieter

Jeder OpenID-Connect-Anbieter funktioniert (Keycloak, Microsoft Entra ID, Moodle mit OIDC-Plugin …).
`OIDC_SCOPES`, `OIDC_GROUPS_CLAIM` und `OIDC_ROLES_CLAIM` entsprechend anpassen und `LOGIN_LABEL` ändern.
Gruppen dürfen als Liste von Strings, als Objekte (`{id|act, name}`) oder als Map übermittelt werden.

## Konfiguration

Alle Einstellungen stehen kommentiert in [`.env.example`](.env.example).

| Variable | Bedeutung | Standard |
|---|---|---|
| `BASE_URL` | Öffentliche Adresse der App | `http://localhost:3000` |
| `OIDC_ISSUER` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | OIDC-Anbieter | – |
| `OIDC_SCOPES` | angefragte Scopes | `openid profile iserv:groups iserv:roles` |
| `OIDC_GROUPS_CLAIM` / `OIDC_ROLES_CLAIM` | Claims mit Gruppen und Rollen | `iserv:groups` / `iserv:roles` |
| `TEACHER_ROLES` / `TEACHER_GROUPS` | wer als Lehrkraft gilt | `ROLE_TEACHER,teacher,lehrer` / `lehrer` |
| `HIDDEN_GROUPS` | Gruppen, die bei der Zuweisung ausgeblendet werden | `alle,lehrer,schueler,schüler` |
| `RETENTION_DAYS` | inaktive Konten nach so vielen Tagen löschen (0 = nie) | `400` |
| `SESSION_DAYS` | Dauer einer Anmeldung | `7` |
| `FRAME_ANCESTORS` | Einbettung per iframe erlauben | `'self'` |

## Datenschutz

Gespeichert werden nur:
- eine pseudonyme Kennung vom Anmeldedienst (`sub`), der Anzeigename und die Gruppenmitgliedschaften
- die Wortlisten der Lehrkräfte
- je Schüler:in, Wort und Richtung: Kästchen der Lernkartei, Anzahl richtig/falsch, Zeitpunkt der letzten Abfrage

Lehrkräfte sehen den Lernstand der Schüler:innen aus den Gruppen, denen sie eine Liste zugewiesen haben.
Das sind Leistungsdaten – bitte den Einsatz mit der/dem Datenschutzbeauftragten der Schule abstimmen und
die Schüler:innen informieren. Konten ohne Anmeldung innerhalb von `RETENTION_DAYS` Tagen werden automatisch
samt Lernstand gelöscht. Schüler:innen können ihren Lernstand je Liste selbst zurücksetzen.
Es werden keine externen Dienste, CDNs oder Tracker eingebunden.

## Entwicklung

Benötigt Node.js ≥ 24 (nutzt das eingebaute `node:sqlite`).

```bash
npm install
echo "DEV_LOGIN=true" > .env   # Test-Anmeldung ohne OIDC
npm run dev                    # http://localhost:3000
npm test
```

Aufbau:
- `src/` – Express-Server: OIDC-Login (`auth.js`), REST-API (`api.js`), SQLite (`db.js`), Sessions (`session.js`)
- `public/` – Oberfläche ohne Build-Schritt (Vanilla JS); `check.js` und `csv.js` werden auch in den Tests genutzt
- `test/` – Tests mit `node:test`

## Lizenz

MIT
