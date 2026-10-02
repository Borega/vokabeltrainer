# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Zwei gleichwertige Gruppen an Schulen (Jahrgang 1–13), die über IServ bzw. einen OpenID-Connect-Anbieter angemeldet sind:

- **Schüler:innen** üben Vokabeln und Grammatik allein – in der Schule und zu Hause, häufig auf dem Schul-iPad als Home-Bildschirm-App, teils ohne Internet. Sie lernen in kurzen Runden („Heute fällig“, „Frei üben“), oft auf dem Handy oder Tablet, oft mit Kopfhörern.
- **Lehrkräfte** legen Listen an (Editor, CSV/Text-Import, KI-Prompt, Textsyntax für Grammatik), weisen sie Klassen und Kursen zu, teilen sie mit Kolleg:innen und werten den Lernstand der Gruppen aus (Kennzahlen, Verlauf, häufigste Fehler). Sie arbeiten am Rechner oder Tablet, meist zwischen Unterrichtsstunden.

Die Bedienoberfläche ist deutsch; gelernt werden beliebige Sprachen (Englisch, Französisch, Spanisch, Latein u. a.). Listen tragen ein Fach (Standard: Sprachen); Fachbegriffe aus Biologie, Geschichte u. a. werden als Begriff ↔ Bedeutung auf Deutsch gelernt.

## Product Purpose

Ein schlanker Vokabel- und Grammatiktrainer für Schulen. Lehrkräfte bringen ihren Stoff hinein, Schüler:innen behalten ihn dauerhaft: durch Abrufen statt Nachlesen und durch verteiltes Wiederholen (FSRS-Planung pro Wort und Richtung bzw. pro Grammatikregel). Erfolg heißt: Schüler:innen wiederholen rechtzeitig und wissen Gelerntes auch nach Wochen noch („sicher“); Lehrkräfte sehen ohne Mehraufwand, wer wo steht und welche Fehlvorstellung in der Klasse verbreitet ist.

## Positioning

Was ein Nachbarprodukt nicht wahrheitsgemäß von sich behaupten könnte (vom Nutzer bestätigt):

- **Datenschutz:** selbst gehostet, keine externen Dienste, CDNs oder Tracker, nur geräteeigene Sprachstimmen, keine KI in der App selbst.
- **Lernforschung:** Lernleiter (kennenlernen → auswählen → eintippen → Lückentext/Hören), FSRS-Planung, Abrufen vor Nachlesen, bei Grammatik explizite Regel plus gemischte Wiederholung; die Befunde sind im README und in `docs/grammatik-plan.md` belegt.
- **Schulanbindung:** Anmeldung, Klassen, Kurse und Lehrkraft-Rolle kommen aus IServ/OIDC; Lehrkräfte teilen und kopieren Listen untereinander.
- **Offline auf dem iPad:** Lernen ohne Internet, Antworten werden später mit ihrem Zeitpunkt übertragen.

## Operating Context

- Läuft als Docker-Container hinter einem HTTPS-Reverse-Proxy, Daten in SQLite; Image `ghcr.io/borega/vokabeltrainer`, Bau per GitHub Actions.
- Installierbare Web-App mit Service Worker und IndexedDB; Einrichtung einmal im Schul-WLAN, auf geteilten Geräten ohne „Angemeldet bleiben“.
- Sitzungen sind kurz und unterbrechbar (Pausenklingel, App im Hintergrund): Antworten dürfen nie verloren gehen.
- Geteilte Geräte: Gespeicherte Listen und wartende Antworten gehören zur jeweiligen Person.
- Oberfläche ohne Build-Schritt (Vanilla-JS-Module), Content-Security-Policy ohne Inline-Styles; Tests mit `node:test`.

## Capabilities and Constraints

- Vokabellisten und Grammatiklisten (Regeln mit Aufgaben: Lücke, Auswählen, Fehler finden, Satzbau, Umformen/Übersetzen); Listen werden Gruppen zugewiesen, freigegeben, kopiert; Jahrgangsstufe ist Pflichtfeld.
- Übungsarten: Lernleiter, Karteikarten, Eintippen, Auswählen, Lückentext, Hören; beide Richtungen; Sonderzeichen-Leiste für Französisch, Spanisch u. a.
- Auswertung für Lehrkräfte nur für die eigenen Listen und die zugewiesenen Gruppen; Klassenfehlerliste ohne Namen.
- Begriffe, die so in der Oberfläche stehen: Liste, Regel, Lernleiter, „Heute fällig“, „Frei üben“, „sicher“, „Fast!“, Merksatz.
- Keine Schulbuchinhalte (Urheberrecht); Inhalte stammen von den Lehrkräften.
- Offen: Nutzung der gespeicherten falschen Antworten ist mit der/dem Datenschutzbeauftragten der Schule abzustimmen.

## Brand Commitments

- Name „Vokabeltrainer“ (über `APP_NAME` pro Schule änderbar), Anmeldetext über `LOGIN_LABEL`.
- Vorhandenes Zeichen: „Aa“-Kachel als Logo und App-Icon (`public/favicon.svg`, `public/icon-*.png`).
- Lizenz PolyForm Noncommercial 1.0.0; der Hinweis „Required Notice“ muss mitgegeben werden.
- Stimme: deutsch, sachlich und direkt („Richtig!“, „Fast!“, „Weiter üben!“), gendergerecht mit Doppelpunkt („Schüler:innen“).
- Eine verbindliche Schul-Corporate-Identity gibt es nicht.

## Evidence on Hand

- README mit Funktionsumfang, Forschungsbelegen und Literatur; `docs/grammatik-plan.md` mit Herleitung der Grammatik-Umsetzung.
- Automatische Tests und eine laufende CI.
- Nicht vorhanden und nicht zu erfinden: Nutzerzahlen, Testimonials, Schulnamen, Preise, Lernerfolgsmessungen, Benchmarks.

## Product Principles

1. **Abrufen vor Nachlesen:** Jede Aufgabe fragt ab; Hilfe ist möglich, zählt aber als Hilfe.
2. **Nichts geht verloren:** Antworten sind sofort auf dem Gerät gesichert und werden übertragen, sobald es geht – auch offline und bei Unterbrechungen.
3. **Die Lehrkraft behält die Hoheit über den Stoff,** die App übernimmt Planung und Auswertung – ohne Zusatzaufwand und ohne fremde Dienste.
4. **Ehrliche Rückmeldung:** „sicher“ bedeutet selbst hervorgebracht; Fehler werden erklärt statt nur markiert.
5. **Datensparsam:** Es wird nur gespeichert, was Lernstand und Auswertung brauchen; Schüler:innen können ihren Stand zurücksetzen.

## Accessibility & Inclusion

Kein formaler Standard vorgegeben; Barrierefreiheit wird nach guter Praxis verfolgt: Tastaturbedienung, sichtbarer Fokus, ausreichender Kontrast in hellem und dunklem Modus, Screenreader-Beschriftungen, Sprachauszeichnung (`lang`) für Fremdsprachen, Rücksicht auf reduzierte Bewegung. Zielgeräte sind Touch-Geräte (iPad, Handy) und Rechner. Kinder und Jugendliche unterschiedlicher Lesekompetenz: kurze, klare Texte.
