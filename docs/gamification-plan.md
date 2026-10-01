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
| Kleine, aber echte Effekte: kognitiv g = 0,49, motivational g = 0,36, Verhalten g = 0,25. In den methodisch strengsten Studien blieb nur der kognitive Effekt stabil. Wettbewerb zusammen mit Zusammenarbeit wirkte besonders auf das Verhalten. | Sailer & Homner (2020) | Keine Wunder erwarten; Wirkung hängt von der Gestaltung ab. Für Schritt 3 spricht ein gemeinsames Ziel statt Rangliste. |
| Motivationseffekt in K-12 g = 0,65 (41 Effekte, sehr uneinheitlich); je Schulstufe verschieden (Sekundarstufe g ≈ 1,0, High School ≈ 0,8, Grundschule geringer); bei extrinsischer Motivation (0,71) etwas größer als bei intrinsischer (0,64). | Kurnaz & Koçtürk (2025) | Für Jahrgang 5–13 ist der Ansatz sinnvoll; weil vor allem die extrinsische Motivation steigt, braucht es die Schutzmaßnahmen. |
| Erwartete, greifbare Belohnungen senken die intrinsische Motivation (Wahlverhalten: d = −0,40 / −0,36 / −0,28 für Belohnungen fürs Mitmachen / Fertigwerden / Leistung), bei Kindern stärker als bei Studierenden. Unerwartete Belohnungen wirkten nicht (d = 0,01). Positive Rückmeldung wirkte (d = 0,33 im Wahlverhalten, 0,31 im Interesse), bei Kindern aber nicht im Wahlverhalten. | Deci, Koestner & Ryan (1999) | Nichts Greifbares; Abzeichen als Rückmeldung zum Können; einige unangekündigt. Auch leistungsabhängige Belohnungen untergruben das Wahlverhalten: ein Restrisiko, das wir mit Abschaltbarkeit und ohne Vergleich begrenzen. |
| Gegenposition: Negative Effekte vor allem bei interessanten Aufgaben, wenn die Belohnung greifbar, angekündigt und nur lose an die Leistung gebunden ist. | Cameron, Banko & Pierce (2001) | Symbolische, an sicheres Können gebundene Abzeichen liegen eher außerhalb. Für digitale Abzeichen nicht belegt. |
| Ein Kurs mit Abzeichen (Pflicht) und Bestenliste hatte nach 16 Wochen weniger intrinsische Motivation, Zufriedenheit und Empowerment, dazu schlechtere Ergebnisse in der Abschlussprüfung. Zwei Kurse, nicht zufällig zugeteilt; vermutet werden sozialer Vergleich, fehlende Wahl, nachlassende Neuheit. | Hanus & Fox (2015) | **Keine Bestenlisten**, keine Pflicht, abschaltbar. |
| Verlieren im Wettbewerb, im reinen Spielen und im Herdenverhalten (Duolingo, Foren und 15 Interviews). | Hadi Mogavi et al. (2022) | Kein Wettbewerb, kein Vergleich; Ziele hängen am Lernen. |
| Übersicht über 87 Arbeiten: Am häufigsten sind Abzeichen, Bestenlisten, Wettbewerbe und Punkte mit unerwünschten Wirkungen verbunden (fehlende Wirkung, schlechtere Leistung, Motivationsprobleme, Schummeln). | Almeida et al. (2023) | Abzeichen sind keine harmlose Zugabe: nur fürs Können, nicht für Menge oder Anmelden. |

Hinweis: Die Zahlen stammen aus den Kurzfassungen der Arbeiten, bei Deci et al. aus dem Volltext; Hanus & Fox und die
K-12-Metaanalyse sind aus Zusammenfassungen zu den Kurzfassungen übernommen. Zu Streaks gibt es kaum unabhängige Studien:
Dass die Serie nachsichtig ist, ist eine Gestaltungsentscheidung und keine Folgerung aus einer Studie. Herstellerangaben und
Korrelationen (etwa von Duolingo) sind bewusst **nicht** als Beleg verwendet. Eine zuvor erwogene Quelle zu Snapchat-Streaks
wurde entfernt, weil ihre Befunde nicht geprüft werden konnten.

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

- Almeida, C., Kalinowski, M., Uchoa, A., & Feijó, B. (2023). Negative effects of gamification in education software: Systematic mapping and practitioner perceptions. arXiv:2305.08346.
- Cameron, J., Banko, K. M., & Pierce, W. D. (2001). Pervasive negative effects of rewards on intrinsic motivation: The myth continues. *The Behavior Analyst, 24*(1), 1–44.
- Deci, E. L., Koestner, R., & Ryan, R. M. (1999). A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation. *Psychological Bulletin, 125*(6), 627–668.
- Hadi Mogavi, R., Guo, B., Zhang, Y., Haq, E.-U., Hui, P., & Ma, X. (2022). When gamification spoils your learning: A qualitative case study of gamification misuse in a language-learning app. arXiv:2203.16175.
- Hanus, M. D., & Fox, J. (2015). Assessing the effects of gamification in the classroom: A longitudinal study on intrinsic motivation, social comparison, satisfaction, effort, and academic performance. *Computers & Education, 80*, 152–161.
- Kurnaz, F., & Koçtürk, M. (2025). A meta-analysis of gamification's impact on student motivation in K-12 education. *Psychology in the Schools*. https://onlinelibrary.wiley.com/doi/10.1002/pits.70056
- Sailer, M., & Homner, L. (2020). The gamification of learning: A meta-analysis. *Educational Psychology Review, 32*(1), 77–112.
