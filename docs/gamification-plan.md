# Plan: Lernserie und Abzeichen

Stand: 01.10.2026 · Status: **Schritt 1 und 2 umgesetzt** (Lerntage, Tagesziel, Serie, Schalter pro Gruppe und Schule; Abzeichen), Schritt 3 (Klassenziel) offen

Der Vokabeltrainer soll um spielerische Elemente ergänzt werden: eine Lernserie (Streak), Abzeichen und
eine Tagesanzeige. Dieses Dokument fasst zusammen, was die Forschung zu Gamification im Unterricht sagt,
und leitet daraus einen Plan ab, der zu Produktprinzipien und Architektur passt (FSRS-Planung, Lernen ohne
Internet, Datensparsamkeit).

**Entschieden (01.10.2026):**
- Zielgruppe sind Schüler:innen ab 10 Jahren (Jahrgang 5–13); es gibt keine Sonderfassung für die Grundschule.
- Die Funktion ist **standardmäßig an**; Lehrkräfte können sie pro Gruppe abschalten, Betreiber:innen für
  die ganze Schule.
- Das **Tagesziel heißt: erledigen, was fällig ist** (mit Obergrenze, siehe 3.1).

---

## 1. Was die Forschung sagt

| Befund | Quelle | Folgerung |
|---|---|---|
| Kleine, aber echte Effekte: kognitiv g ≈ 0,49, motivational g ≈ 0,36, Verhalten g ≈ 0,25. In den methodisch strengsten Studien blieb nur der kognitive Effekt stabil. | Sailer & Homner (2020) | Keine Wunder erwarten; Wirkung hängt von der Gestaltung ab. |
| Motivationseffekt in K-12 g ≈ 0,65; Grundschule schwächer (≈ 0,31) als Sekundarstufe (≈ 1,0). | Metaanalyse zu K-12 (*Psychology in the Schools*) | Für Jahrgang 5–13 ist der Ansatz sinnvoll. |
| Erwartete, greifbare Belohnungen senken die intrinsische Motivation (d ≈ −0,3 bis −0,4); verbale, informierende Rückmeldung nicht. | Deci, Koestner & Ryan (1999) | Abzeichen als Rückmeldung zur Kompetenz, nicht als Bezahlung fürs Erscheinen. |
| Ein Kurs mit Abzeichen und Bestenliste hatte geringere intrinsische Motivation und schlechtere Prüfungsergebnisse; vermutet wird sozialer Vergleich. | Hanus & Fox (2015) | **Keine Bestenlisten.** |
| Gamification kann die Nutzung des Systems steigern und die Beschäftigung mit dem Stoff senken. | Übersicht zu negativen Effekten (arXiv 2305.08346) | Belohnt wird sinnvolles Lernen, nicht Anmelden oder Menge. |
| Nutzer:innen tricksen für Belohnungen (Duolingo); Jugendliche teilen Passwörter, um Streaks zu halten; lange Streaks kippen in Verlustangst. | Fallstudie zu Duolingo (arXiv 2203.16175); Studie zu Snapchat-Streaks (*Computers in Human Behavior Reports*) | Streak muss nachsichtig sein und darf nicht zum Selbstzweck werden. |

Hinweis: Die Zahlen stammen aus Zusammenfassungen und Kurzfassungen, nicht aus den Volltexten. Vor der
Übernahme in die README an den Originalen prüfen. Zu Streaks gibt es fast nur Herstellerangaben und
Korrelationen (z. B. von Duolingo); sie sind hier bewusst **nicht** als Beleg verwendet.

---

## 2. Leitlinien

1. **Belohnt wird, was FSRS braucht:** rechtzeitig wiederholen und sich nach Wochen noch erinnern, nicht
   Anmelden, nicht Menge.
2. **Rückmeldung zur Kompetenz, nicht zum Vergleich:** alles ist privat und bezieht sich auf das eigene Können.
3. **Informierend statt kontrollierend:** ruhige Rückmeldung, keine Druckmittel.
4. **Verlust abfedern:** eine verpasste Serie darf nicht alles entwerten.
5. **Lehrkraft behält die Hoheit:** pro Gruppe abschaltbar.

**Bewusst nicht umgesetzt:** Bestenlisten, Punkte und Level (XP), Leben/Herzen, Münzen und Shop, Streak-Reparatur
gegen Bezahlung, zufällige Belohnungen („Beutekisten“), Vergleich mit Mitschüler:innen, Push-Nachrichten.

---

## 3. Umsetzungsplan

### 3.1 Tagesziel und Lernserie

**Ein Tag gilt als erledigt,** wenn nach den Antworten des Tages nichts mehr fällig ist (Fälligkeit bis zum
Tagesende, Wörter und Grammatikregeln aller Listen mit eingeschalteter Lernserie) **oder** wenn an dem Tag
mindestens 25 fällige Einträge beantwortet wurden (neue Wörter und freies Üben zählen dafür nicht). Die Obergrenze
ist nötig, weil „Heute fällig“ nicht begrenzt ist: Nach den Ferien können mehrere hundert Einträge fällig sein, und
ein unerreichbares Ziel würde genau die bestrafen, die zurückkommen.

- Ist gar nichts fällig, **zählt der Tag nicht und bricht die Serie nicht.**
- Neue Wörter („neu“) und „Frei üben“ zählen nicht zum Ziel, ändern aber nichts daran.
- **Nachsicht:** Pro 7 Tage wird ein verpasster Tag automatisch überbrückt (ohne Kauf, ohne Klick).
  Wochenenden und Schulferien sind kein Problem, weil an Tagen ohne Fälliges nichts verloren geht.
- **Wichtigste Zahl: „Lerntage insgesamt“.** Sie wird nie zurückgesetzt. Bei einem Abbruch steht
  „Beste Serie: n“ neben dem Neustart.
- Keine Push-Nachrichten.

### 3.2 Abzeichen

Zwölf Abzeichen, alle an Können gebunden (Katalog in `src/badges.js`):

- „10 Wörter sicher“, „Liste gemeistert“ (alle Wörter sicher)
- „Nach 4 Wochen noch gewusst“ (genau das, was die Planung erreichen soll)
- „Fehler besiegt“ (falsch, am nächsten Tag richtig)
- „Erste Regel sicher“, „5 Regeln sicher“ (Grammatik)
- „7, 30, 100 Lerntage“
- „10, 50, 150 Wörter sicher“, „Beide Richtungen“ (10 Wörter in beiden Richtungen sicher)

Einige sind erst sichtbar, wenn man sie hat (nicht angekündigte Belohnungen untergraben die Motivation weniger).
Rückmeldung ruhig: ein kurzer Hinweis und eine Sammlungsseite, kein Dialog, kein Konfetti.

Abweichung vom Entwurf: Ein Knopf „Abzeichen zurücksetzen“ ist nicht umgesetzt. Die Schwellen („10 Wörter sicher“)
hängen am Lernstand und wären bei der nächsten Antwort sofort wieder erreicht; er würde nichts löschen, was Schüler:innen
löschen wollen. Wer seinen Lernstand zurücksetzt, behält erreichte Abzeichen; mit dem Konto werden sie gelöscht.

### 3.3 Tagesanzeige statt Anmeldebelohnung

Eine Anmeldebelohnung ist nicht belegt und belohnt das Falsche. Stattdessen füllt sich pro erledigtem
Tag ein Punkt in einer Wochenzeile (Anknüpfung an den Terrakotta-Punkt im App-Symbol).

### 3.4 Steuerung durch Lehrkräfte und Betreiber:innen

- Pro Gruppe ein Schalter „Lernserie und Abzeichen“ (Standard: an), für die ganze Schule per Umgebungsvariable.
- Später optional ein gemeinsames Klassenziel („Die Klasse hat 500 Wörter sicher“), ohne Namen, ohne Rangliste.
- Der Schalter ermöglicht eine einfache Erprobung: aktive Tage pro Woche vor und nach der Einführung vergleichen.
  Ergebnisse werden nicht vorab behauptet (siehe PRODUCT.md, „Evidence on Hand“).

---

## 4. Technik

- **Tag und Zeitzone:** Der Server speichert UTC. Der Tagesbeginn braucht eine Einstellung `TIMEZONE`
  (Standard `Europe/Berlin`), sonst stimmt die Serie um Mitternacht nicht.
- **Lerntage:** neue Tabelle `learning_days(user_id, day, answers, had_due, done, next_due)` (Migration 12). Das
  Tagesziel hängt vom aktuellen Stand der Fälligkeiten ab und lässt sich daher nicht allein aus `review_log` /
  `grammar_log` ableiten. Die Auswertung läuft serverseitig in `applyResults`, nachdem die Antworten eines Tages
  übernommen wurden. `answers` zählt nur **fällige** Einträge aus Listen mit Lernserie (nur sie zählen für die Obergrenze).
- **Offline:** Antworten tragen ihren Zeitpunkt (`at`). Bei verspäteter Übertragung werden die Tage nacheinander
  ausgewertet: Was an einem Tag fällig war, richtet sich nach dem Stand, den frühere Tage derselben Übertragung
  hinterlassen haben. Für vergangene Tage gilt bewusst großzügig: erledigt, wenn bis zum Tagesende nichts mehr
  fällig ist oder die Obergrenze erreicht wurde.
- **Abzeichen:** Tabelle `badges_earned(user_id, badge, earned_at)`. Neue Abzeichen kommen in der Antwort von
  `/results` zurück; bei Offline-Antworten erscheint der Hinweis beim Übertragen.
- **Schalter:** Spalte oder Tabelle pro Gruppe, abgefragt wie die Gruppenzuweisung der Listen.
- **Datenschutz:** nur eigene Daten, nur für die Schüler:in sichtbar. Die Lehrkraft-Auswertung bleibt wie sie ist.
  Lerntage und Abzeichen gehören zum Konto (`ON DELETE CASCADE`).
- **Oberfläche:** Serie neben „Heute fällig“ auf der Startseite, Sammlungsseite für Abzeichen. Gestaltung nach
  DESIGN.md: SVG statt Emoji, `prefers-reduced-motion` beachten, Texte kurz und sachlich.
- **Tests:** Serienlogik als reine Funktion (wie `schedule.js`), Tests mit `node:test`.

### Umsetzung Schritt 1

- `src/streak.js`: Serie, Tageszeiten (mit Zeitumstellung) und Woche als reine Funktionen (`test/streak.test.js`).
- Migration 12: `learning_days` und `group_settings`. Ein Tag zählt als frei, wenn an ihm nichts fällig war (`had_due`);
  `next_due` (erste Fälligkeit nach der letzten Antwort) macht Tage ohne Antworten bis dahin frei.
- `src/api.js`: `GET /api/streak`, `PUT /api/group-settings`; `POST /results` liefert zusätzlich `streak` (mit `reached`,
  wenn das Tagesziel heute erreicht wurde). Die Auswertung läuft in derselben Transaktion wie die Antworten.
- Oberfläche: `public/streak-ui.js` (Wochenpunkte auf der Startseite, Schalter für Lehrkräfte, Hinweis beim Erreichen).
- Entscheidung gegenüber dem Entwurf: Auch Üben ohne Fälliges zählt nicht, damit eine einzelne Antwort pro Tag keine
  Serie erzeugt. Eine Person mit mehreren Gruppen zählt nur Listen aus Gruppen, in denen die Lernserie an ist.

### Umsetzung Schritt 2

- `src/badges.js`: Katalog, Schwellen und Sammlung als reine Funktionen (`test/badges.test.js`).
- Migration 13: `badges_earned(user_id, badge, earned_at)`. Der Fortschritt wird bei Bedarf aus dem Lernstand gerechnet
  (`badgeStats` in `src/api.js`, nur aus Listen mit Lernserie).
- Vergeben wird nach den Antworten in derselben Transaktion (`awardBadges`). Ereignisse einer Übertragung: ein Wort nach
  ≥ 28 Tagen gewusst, ein am Vortag oder früher falsches Wort richtig. Nachträglich übertragene Antworten zählen mit ihrem Zeitpunkt.
- `POST /results` liefert zusätzlich `badges` (neu erreicht); `GET /api/badges` die Sammlung; `GET /api/streak` die Zahlen.
- Oberfläche: `public/badges-ui.js`, Seite `#/badges`; ein Schalter pro Gruppe für Lernserie **und** Abzeichen.
- Sicher wird ein Wort erst nach mehreren Antworten an verschiedenen Tagen (Stabilität ≥ 14 Tage): ein einzelnes „leicht“
  genügt nicht. Rückdatierte Antworten reichen dafür auch nicht, denn eine Antwort zählt nie vor der letzten bekannten.

### Reihenfolge

1. Lerntage, Tagesziel und Serie (klein; zeigt früh, ob es trägt)
2. Abzeichen
3. Schalter pro Gruppe und Schule, später Klassenziel

> Der Schalter pro Gruppe kam schon mit Schritt 1, weil die Funktion standardmäßig an ist.

---

## 5. Literatur

- Deci, E. L., Koestner, R., & Ryan, R. M. (1999). A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation. *Psychological Bulletin, 125*(6), 627–668.
- Hanus, M. D., & Fox, J. (2015). Assessing the effects of gamification in the classroom: A longitudinal study on intrinsic motivation, social comparison, satisfaction, effort, and academic performance. *Computers & Education, 80*, 152–161.
- Sailer, M., & Homner, L. (2020). The gamification of learning: a meta-analysis. *Educational Psychology Review, 32*(1), 77–112.
- A meta-analysis of gamification's impact on student motivation in K-12 education. *Psychology in the Schools*. https://onlinelibrary.wiley.com/doi/10.1002/pits.70056
- Negative effects of gamification in education software: systematic mapping and practitioner perceptions. arXiv:2305.08346.
- When gamification spoils your learning: a qualitative case study of gamification misuse in a language-learning app. arXiv:2203.16175.
- Snapchat streaks: how are these forms of gamified interactions associated with problematic smartphone use and fear of missing out among early adolescents? https://www.sciencedirect.com/science/article/pii/S2772503023000476
