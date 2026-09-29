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
    – und ob Schüler:innen die Abfrageart selbst wechseln dürfen (Standard: ja)
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

**Für alle**
- Darstellung hell, dunkel oder wie das Gerät (Knopf oben rechts, wird im Browser gemerkt)

**Für Schüler:innen**
- sehen nur Listen ihrer Gruppen
- Zwei Modi:
  - **Heute fällig** – verteiltes Wiederholen: Das Programm plant für jedes Wort, wann es wiederkommt
    (siehe unten). Die Startseite zeigt, wie viele Wörter heute fällig sind.
  - **Frei üben** – beliebige Wörter, unsichere zuerst (z. B. vor einem Test); zählt trotzdem für die Planung
- Abfrageart wählen, sofern erlaubt – z. B. sonst mit der Lernleiter, vor einem Test schnell mit Karteikarten
  (wird pro Liste gemerkt; für die Planung zählt jede Art wie oben beschrieben, Auswählen also nur als „mit Mühe“)
- Richtung wählen (sofern erlaubt), Rundengröße 10 / 20 / alle
- **Ton an/aus** (wird im Browser gemerkt): Wörter werden vorgelesen, dazu kommen Hörübungen.
  Über 🔊 lässt sich jedes Wort jederzeit anhören.
- Nicht gewusste Wörter kommen in derselben Runde nach wenigen Karten erneut, bis sie einmal sitzen
- Lernstand wird auf dem Server gespeichert und ist auf allen Geräten verfügbar
- **Lernen ohne Internet**, z. B. zu Hause mit dem Schul-iPad – siehe unten
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

## Lernen ohne Internet (iPad)

Für Schüler:innen, die nur in der Schule WLAN haben: Die App lädt bei jeder Verbindung alle zugewiesenen
Listen samt Lernstand auf das Gerät. Zu Hause wird damit weitergelernt – auch „Heute fällig“ stimmt, weil
das Gerät genauso plant wie der Server. Die Antworten bleiben auf dem Gerät, bis es wieder im Schul-WLAN
ist, und werden dann mit dem Zeitpunkt der Antwort übertragen. Oben rechts steht „Offline · 12 Antworten
warten“, solange etwas aussteht.

**Einrichten (einmal, in der Schule):** In Safari die Adresse öffnen, anmelden, dann Teilen →
„Zum Home-Bildschirm“. Danach die App über das Symbol öffnen. Das ist wichtig: Safari löscht gespeicherte
Daten von Webseiten, die sieben Tage nicht besucht wurden – bei Apps auf dem Home-Bildschirm nicht.

**Gut zu wissen**
- Anmelden geht nur mit Internet. Mit „Auf diesem Gerät angemeldet bleiben“ (Anmeldeseite, standardmäßig an)
  meldet sich die App danach selbst wieder an – auch wenn iOS das Sitzungs-Cookie beim Schließen der App
  verwirft –, und zwar `REMEMBER_DAYS` Tage lang (Standard 30) ab der IServ-Anmeldung. Danach einmal in der
  Schule neu anmelden; dabei werden auch Klasse und Kurse aktualisiert. Bis dahin gelernte Antworten gehen
  nicht verloren – sie werden nach der Anmeldung übertragen.
- Auf geteilten Geräten „angemeldet bleiben“ ausschalten, sonst ist die nächste Person im falschen Konto.
- Neue oder geänderte Listen kommen erst bei der nächsten Verbindung aufs Gerät.
- Ohne Internet gehen nur Startseite und Lernen. Listen bearbeiten, teilen und auswerten braucht Internet;
  eigene (nicht zugewiesene) Listen einer Lehrkraft sind offline nicht verfügbar.
- Geteilte Geräte: Gespeicherte Listen und wartende Antworten gehören zur jeweiligen Person. Beim Abmelden
  wird noch übertragen und die gespeicherten Listen werden vom Gerät gelöscht.
- Doppelt übertragene Antworten (z. B. WLAN bricht beim Senden ab) zählen nur einmal.
- Die Auswertung der Lehrkraft zeigt Offline-Lernen erst nach der Übertragung, dann aber mit den richtigen
  Tagen („zuletzt aktiv“, Verlauf).
- Technik: installierbare Web-App (Service Worker `public/sw.js` hält die Oberfläche vor, IndexedDB die
  Daten). Setzt HTTPS voraus. Nach einem Update holt sich die App die neue Version bei der nächsten Verbindung.

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

Die Datenbank (SQLite) liegt im Docker-Volume `vokabeltrainer-data` – dieses Volume gehört in die Datensicherung
(siehe [Aktualisieren und Datensicherung](#aktualisieren-und-datensicherung)).

**Portainer:** Stack-Vorlage und Variablen in [`deploy/portainer/`](deploy/portainer/).

**nginx:** fertige Konfiguration mit HTTPS (Let's Encrypt) und Installationsschritten in
[`deploy/nginx/vokabeltrainer.conf`](deploy/nginx/vokabeltrainer.conf).

Beispiel für Caddy (holt das Zertifikat automatisch):

```
vokabeln.meine-schule.de {
    reverse_proxy 127.0.0.1:3000
}
```

## Aktualisieren und Datensicherung

**Datenbank-Änderungen laufen automatisch.** Beim Start öffnet der Server die Datenbank, bevor er Anfragen
annimmt, und bringt sie auf den Stand der neuen Version (`PRAGMA user_version`, Migrationen in
[`src/db.js`](src/db.js)). Jede Migration läuft in einer Transaktion: Schlägt sie fehl, bleibt die Datenbank
unverändert, der Container beendet sich mit der Fehlermeldung im Log und startet neu. Es darf immer nur
**ein** Container auf das Volume zugreifen.

**Vor jedem Update sichern.** Die Datenbank läuft im WAL-Modus – neue Änderungen können noch in der Datei
`vokabeltrainer.sqlite-wal` stehen. Deshalb den Container vorher stoppen und das ganze Volume sichern:

```bash
# Name des Volumes herausfinden – Compose und Portainer setzen den Projekt- bzw. Stack-Namen davor
docker volume ls | grep vokabeltrainer-data
VOL=vokabeltrainer_vokabeltrainer-data   # anpassen

docker compose stop                      # bzw. in Portainer: Stack → Stop
docker run --rm -v "$VOL":/data -v "$PWD":/backup alpine \
  tar czf /backup/vokabeltrainer-$(date +%F).tgz -C /data .
```

**Update einspielen:**

```bash
docker compose pull && docker compose up -d   # bzw. in Portainer: Stack → „Pull and redeploy“
docker compose logs --tail 20 vokabeltrainer  # sollte „Vokabeltrainer läuft auf Port 3000“ zeigen
```

Danach kurz anmelden und prüfen, ob Listen und Lernstände da sind.

**Zurück zur vorherigen Version:** Container stoppen, Sicherung zurückspielen und die alte Version starten.
Statt `latest` dazu in `docker-compose.yml` einen festen Tag eintragen, z. B. `sha-<commit>`
(alle Tags unter *Packages* im GitHub-Repo).

```bash
docker compose stop
docker run --rm -v "$VOL":/data -v "$PWD":/backup alpine \
  sh -c 'rm -rf /data/* && tar xzf /backup/vokabeltrainer-<datum>.tgz -C /data'
docker compose up -d
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
| `SESSION_DAYS` | Dauer einer Anmeldung (Sitzungs-Cookie) | `7` |
| `REMEMBER_DAYS` | „Angemeldet bleiben“: so viele Tage nach der IServ-Anmeldung meldet sich die App selbst wieder an (0 = aus) | `30` |
| `FRAME_ANCESTORS` | Einbettung per iframe erlauben | `'self'` |

## Datenschutz

Gespeichert werden nur:
- eine pseudonyme Kennung vom Anmeldedienst (`sub`), der Anzeigename und die Gruppenmitgliedschaften
- die Wortlisten der Lehrkräfte
- je Schüler:in, Wort und Richtung: Lernstufe und Planungswerte, Anzahl richtig/falsch, Zeitpunkt der letzten Abfrage
- ein Verlauf der Antworten (Zeitpunkt, Bewertung, Übungsart) für die Auswertung
- bei „Angemeldet bleiben“: ein Geräteschlüssel (in der Datenbank nur als Hash), der nach `REMEMBER_DAYS` Tagen
  oder beim Abmelden verfällt

Auf dem Gerät speichert die App die zugewiesenen Listen mit dem eigenen Lernstand, noch nicht übertragene
Antworten und ggf. den Geräteschlüssel (für das Lernen ohne Internet). Beim Abmelden werden Listen, Lernstand
und Geräteschlüssel gelöscht. Antworten, die bis dahin nicht übertragen werden konnten, bleiben (nach
Rückfrage) auf dem Gerät und werden übertragen, sobald sich dieselbe Person dort wieder anmeldet.

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
  Lernleiter, Ablenker, Tipps, Lückentext) werden auch in den Tests genutzt, `speech.js` für die Aussprache.
  Offline: `schedule.js` (FSRS-Planung, auch vom Server genutzt), `offline.js` (Abgleich), `store.js`
  (IndexedDB), `sw.js` (Service Worker), `manifest.webmanifest`
- `test/` – Tests mit `node:test`

## Lizenz

[PolyForm Noncommercial 1.0.0](LICENSE) – kurz gefasst (verbindlich ist der Lizenztext):

- **Erlaubt** ist die Nutzung für nicht-kommerzielle Zwecke: privat sowie durch Schulen und andere
  Bildungseinrichtungen, auch mit eigenen Änderungen.
- **Namensnennung:** Wer die Software – verändert oder unverändert – weitergibt, muss den Lizenztext und den
  Hinweis `Required Notice: Copyright 2026 Sören Schröder – Vokabeltrainer (https://github.com/Borega/vokabeltrainer)`
  mitgeben.
- **Kommerzielle Nutzung** (z. B. Verkauf, Hosting als kostenpflichtiger Dienst, Einbau in kommerzielle
  Produkte) nur mit einer gesonderten Lizenz von Sören Schröder – Anfrage an
  [vokalbtrainer@filius.app](mailto:vokalbtrainer@filius.app).

Eingebundene Bibliotheken (z. B. express, openid-client, ts-fsrs) stehen unter ihren eigenen Lizenzen (MIT).
