# Vokabeltrainer

Ein schlanker Vokabeltrainer für Schulen. Lehrkräfte legen Wortlisten an (im Editor oder per CSV-Import)
und weisen sie Klassen bzw. Kursen zu. Schüler:innen lernen mit der **Lernleiter**, deren Aufgaben mit
dem Lernstand jedes Worts schwerer werden (kennenlernen → auswählen → eintippen → Lückentext und Hörübung),
oder wahlweise nur mit **Karteikarten**, **Eintippen** oder **Auswählen** – in beide Richtungen.

Die Anmeldung läuft über **OpenID Connect**, z. B. über das Single-Sign-On von **IServ**.
Gruppen (Klassen/Kurse) und die Rolle „Lehrkraft“ werden direkt aus IServ übernommen.

## Funktionen

**Für Lehrkräfte**
- Listen im Browser-Editor anlegen und bearbeiten (Enter springt in die nächste Zeile)
- CSV-Import und -Export (Semikolon, Komma oder Tab; Kopfzeile wie `Englisch;Deutsch` wird erkannt).
  Spalten: Wort A, Wort B, optional Notiz und Beispielsatz
- Pro Wort optional ein **Beispielsatz**: Kommt das Wort darin vor, wird daraus ein Lückentext.
  Gebeugte Formen mit Sternchen markieren: `Yesterday I *went* home.`
- Pro Liste festlegen:
  - Abfrage als **Lernleiter** (empfohlen, Standard für neue Listen), **Karteikarten**, **Eintippen** oder **Auswählen**
  - beim Eintippen: Groß-/Kleinschreibung und Akzente/Umlaute beachten – ja/nein
  - Standard-Richtung (A → B, B → A, gemischt) und ob Schüler:innen sie wechseln dürfen
- Liste einer oder mehreren IServ-Gruppen zuweisen
- Listen **für Kolleg:innen freigeben** (freiwillig, pro Liste): Andere Lehrkräfte finden sie unter
  „Geteilte Listen“, können sie ausprobieren und eine eigene Kopie anlegen, die sie frei bearbeiten und
  ihren Gruppen zuweisen. Das Original bleibt unverändert, Lernstände werden nicht geteilt.
- **Auswertung** pro Liste und Gruppe:
  - Kennzahlen: Schüler:innen, aktiv in den letzten 7 Tagen, Ø sicher, Ø geübt, heute fällig
  - Verlauf der letzten 8 Wochen: Ø sicher und Abfragen pro Woche (Diagramm und Tabelle)
  - Tabelle pro Schüler:in (sortierbar): sicher, geübt, fällig, richtig/falsch, zuletzt aktiv
  - Einzelansicht per Klick auf den Namen: Lernstand jedes Worts in beiden Richtungen
  - schwierigste Wörter der Gruppe und Export als CSV

**Für Schüler:innen**
- sehen nur Listen ihrer Gruppen
- Zwei Modi:
  - **Heute fällig** – verteiltes Wiederholen: Das Programm plant für jedes Wort, wann es wiederkommt
    (siehe unten). Die Startseite zeigt, wie viele Wörter heute fällig sind.
  - **Frei üben** – beliebige Wörter, unsichere zuerst (z. B. vor einem Test); zählt trotzdem für die Planung
- Richtung wählen (sofern erlaubt), Rundengröße 10 / 20 / alle
- **Ton an/aus** (wird im Browser gemerkt): Wörter werden vorgelesen, dazu kommen Hörübungen.
  Über 🔊 lässt sich jedes Wort jederzeit anhören.
- Nicht gewusste Wörter kommen in derselben Runde nach wenigen Karten erneut, bis sie einmal sitzen
- Lernstand wird auf dem Server gespeichert und ist auf allen Geräten verfügbar
- Tastatur: Leertaste = umdrehen, 1 / ← = nicht gewusst, 2 / → = gewusst, 3 / ↑ = leicht, Enter = prüfen / weiter;
  beim Auswählen 1–4

## Übungsarten

| Übung | Was passiert | Wozu |
|---|---|---|
| **Kennenlernen** | Neues Wort mit Übersetzung, Notiz und Beispielsatz ansehen; abgefragt wird es ein paar Karten später | erster Kontakt, ohne zu raten |
| **Auswählen** | Aus vier Antworten der Liste die richtige wählen; die falschen sehen der richtigen möglichst ähnlich (Verb zu Verb, Nomen mit Artikel …) | Wiedererkennen – leichter als selbst hervorbringen |
| **Eintippen** | Übersetzung eintippen, automatisch geprüft; **💡 Tipp** zeigt den ersten Buchstaben jedes Worts, dann jeweils einen mehr | selbst hervorbringen, mit Hilfe nach Bedarf |
| **Lückentext** | Das Wort im Beispielsatz ergänzen, die Übersetzung steht als Hinweis dabei | Gebrauch im Zusammenhang |
| **Hören** | Das Wort wird vorgelesen (nur bei „Ton an“), die Übersetzung eintippen | Aussprache und Hörverstehen |
| **Karteikarten** | Umdrehen und selbst einschätzen; Tipp: die Antwort vorher laut sagen | schnell, aber auf Selbsteinschätzung angewiesen |

**Lernleiter:** Die Aufgabe richtet sich nach der Stufe des Worts in der jeweiligen Richtung:

| Stufe | Aufgabe |
|---|---|
| neu | kennenlernen, dann auswählen (ist das Wort in der Gegenrichtung schon bekannt: gleich auswählen) |
| Anfang (Stabilität < 3 Tage) | eintippen, Tipps auf Wunsch |
| ab „lernt“ (≥ 3 Tage) | eintippen, abwechselnd auch als Lückentext (wenn ein passender Beispielsatz da ist) oder als Hörübung (bei „Ton an“) |

Die Idee dahinter: Aufgaben, die gerade noch lösbar sind, bringen am meisten (*desirable difficulties*,
Bjork 1994; *retrieval effort*, Pyc & Rawson 2009). Wiedererkennen kommt vor dem selbst Hervorbringen
(Webb 2009; Nakata 2011). Auswählen mit plausiblen Ablenkern ist echtes Abrufen (Little et al. 2012),
schrittweise Hinweise helfen beim Erinnern (Finley et al. 2011). Lückensätze kommen erst, wenn die
Schreibweise eines Worts sitzt – vorher lenken Satzaufgaben eher ab (Barcroft 2004). Wechselnde
Stimmen verbessern das Lernen der Aussprache (Barcroft & Sommers 2005), lautes Aussprechen das
Behalten (*production effect*, MacLeod et al. 2010).

**Aussprache und Datenschutz:** Vorgelesen wird mit der Sprachausgabe des Browsers. Es werden nur
Stimmen verwendet, die auf dem Gerät selbst laufen – Online-Stimmen (z. B. „Google …“ in Chrome), die den
Text an den Anbieter schicken würden, bleiben außen vor. Hat das Gerät keine passende Stimme, gibt es
keinen Ton und keine Hörübungen. Die Sprache ergibt sich aus der Sprachbezeichnung der Liste
(„Englisch“ → britisches Englisch, „Englisch (USA)“ → amerikanisches; ein Code wie `fr-CA` geht auch).
Latein und Altgriechisch werden nicht vorgelesen.

**Prüfregeln beim Eintippen**
- Mehrere richtige Lösungen mit `;` oder `|` trennen: `big; large`
- Teile in Klammern sind optional: `(to) go` akzeptiert `go` und `to go`
- Leerzeichen und `.` `!` `?` am Ende zählen nicht
- Kleine Tippfehler werden als „Fast!“ angezeigt (zählen als falsch, mit „Ich hatte recht“ korrigierbar)

## Wie die Wiederholungsplanung funktioniert

Der Trainer nutzt zwei gut belegte Lerneffekte: **Abrufen statt Wiederlesen** (*testing effect*,
Roediger & Karpicke 2006) und **verteiltes Wiederholen** (*spacing effect*, Cepeda et al. 2006/2008).
Beide gelten in der Übersicht von Dunlosky et al. (2013) als die wirksamsten Lerntechniken.

Geplant wird mit [FSRS](https://github.com/open-spaced-repetition/ts-fsrs) (Free Spaced Repetition
Scheduler, auch in Anki im Einsatz). Für jedes Wort und jede Richtung werden *Stabilität* (wie lange es
voraussichtlich behalten wird) und *Schwierigkeit* geschätzt. Ein Wort wird fällig, wenn es nur noch mit
etwa 90 % Wahrscheinlichkeit gewusst würde:

| Antwort | Bewertung | Folge |
|---|---|---|
| nicht gewusst / falsch | *again* | morgen wieder fällig, Stabilität sinkt |
| Tippfehler („Fast!“) | *hard* | zählt als falsch, kommt etwas früher wieder |
| richtig ausgewählt | *hard* | nur wiedererkannt – Abstand wächst langsamer |
| richtig mit Tipp | *hard* | gewusst, aber mit Hilfe |
| gewusst / richtig (auch Lückentext, Hören) | *good* | Abstand wächst (z. B. 3 → 12 → 50 Tage) |
| leicht (Karteikarten) | *easy* | Abstand wächst stärker |

Dass Auswählen nur als *hard* zählt, ist Absicht: „Sicher“ soll weiterhin heißen, dass ein Wort selbst
hervorgebracht werden kann. In Listen mit „Auswählen“ dauert es deshalb länger, bis Wörter als sicher
gelten. Welche Übung zu einer Antwort gehörte, wird im Verlauf mitgespeichert.

Mehrfaches Wiederholen am selben Tag erhöht die Stabilität kaum – Pauken bringt kurzfristig etwas,
für die Planung zählt aber das Behalten über Tage. „Sicher“ in der Auswertung heißt: Das Wort würde
auch in zwei Wochen noch mit mindestens 90 % Wahrscheinlichkeit gewusst.

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
- `public/` – Oberfläche ohne Build-Schritt (Vanilla JS); `check.js`, `csv.js` und `exercises.js` (Übungsarten,
  Lernleiter, Ablenker, Tipps, Lückentext) werden auch in den Tests genutzt, `speech.js` für die Aussprache
- `test/` – Tests mit `node:test`

## Lizenz

MIT
