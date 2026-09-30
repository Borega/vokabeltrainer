# Plan: Grammatik üben

Stand: 30.09.2026 · Status: **Phase 1 und 2 umgesetzt** (siehe „Umsetzung“ am Ende von Abschnitt 4), Phase 3 offen

Der Vokabeltrainer soll um Grammatikübungen erweitert werden. Dieses Dokument fasst zusammen, was die
Forschung zum Grammatiklernen sagt, und leitet daraus einen Umsetzungsplan ab, der zur bestehenden
Architektur passt (Listen, Gruppen, FSRS-Planung, Lernen ohne Internet, Auswertung).

---

## 1. Was die Forschung sagt

### 1.1 Explizite Regel + Übung schlägt „nur Beispiele“

- **Explizite Instruktion wirkt stärker als implizite.** Das zeigen mehrere Metaanalysen übereinstimmend:
  Norris & Ortega (2000), Spada & Tomita (2010, für einfache *und* komplexe Strukturen) und Goo et al.
  (2015, 34 Studien). Die Effekte halten auch in verzögerten Tests.
- **Regel entdecken lassen ist mindestens so gut wie Regel vorsetzen** – wenn das Entdecken angeleitet ist
  (*guided induction*): kontrastierende Beispiele und eine gezielte Frage, dann die Regel. Cerezo, Caras &
  Leow (2016) zeigen das auch für computergestütztes Lernen ohne Lehrkraft.
- **Skill-Acquisition-Theorie** (DeKeyser 2007, 2015): Erst deklaratives Wissen (die Regel), dann wird es
  durch systematische Übung prozeduralisiert und automatisiert. Übung muss dabei **Form mit Bedeutung
  verbinden** – rein mechanische Drills, bei denen man den Satz nicht verstehen muss, bringen wenig
  (Wong & VanPatten 2003).

**Folgerung:** Jede Grammatik-Einheit beginnt mit einer kurzen, expliziten Regel (optional als angeleitetes
Entdecken). Die Übungssätze sind echte Sätze, bei denen die Bedeutung die Form bestimmt (z. B. Signalwörter
wie *since*, *yesterday*).

### 1.2 Erst verstehen, dann selbst bilden – aber das Bilden ist entscheidend

- Shintani (2015, Metaanalyse, 42 Experimente): *Processing Instruction* (Formen im Input erkennen und
  deuten) ist besser für das **Verstehen**; für das **selbst Bilden** ist Produktionsübung mindestens
  gleich gut und bei gleicher Regelerklärung sogar besser.
- Das passt zur bestehenden Lernleiter (Wiedererkennen vor Hervorbringen, Webb 2009; Nakata 2011).

**Folgerung:** Leiter auch für Grammatik – zuerst Auswählen/Erkennen, dann Lücke mit Grundform, dann
freiere Produktion (Umformen, Übersetzen, Satzbau). „Sicher“ heißt auch hier: selbst gebildet.

### 1.3 Feedback: erst zum Selbstkorrigieren anregen, dann erklären

- Korrekturfeedback wirkt insgesamt mittelstark und dauerhaft (Li 2010, Metaanalyse).
- Im Unterricht sind **Prompts** – Hinweise, die zur Selbstkorrektur anregen – wirksamer als bloßes
  Vorsagen der richtigen Form (*recasts*) (Lyster & Saito 2010).
- Am Computer führt **metalinguistisches Feedback mit Markierung der Fehlerstelle** zu den meisten
  Selbstkorrekturen (Heift 2004; Heift & Rimrott 2008); „intelligentes“ Feedback mit Regelerklärung
  schlägt reines richtig/falsch (Nagata 1993).

**Folgerung:** Bei einem Fehler zeigt die App nicht sofort die Lösung, sondern markiert die Fehlerstelle
und gibt einen Hinweis zur Regel (von der Lehrkraft für typische Fehler hinterlegt, sonst der Merksatz).
Erst nach dem zweiten Versuch kommen Lösung und Erklärung.

### 1.4 Verteilt wiederholen – der genaue Abstand ist zweitrangig

- Verteiltes Üben hilft auch bei Grammatik. Einige Studien finden Vorteile für längere Abstände
  (≥ 7 Tage: Bird 2010; Rogers 2015), andere für kürzere (Suzuki 2017; Suzuki & DeKeyser 2017), eine
  Klassenzimmerstudie mit jungen Lernenden kaum Unterschiede zwischen 3,5 und 7 Tagen (Kasprowicz,
  Marsden & Sephton 2019).

**Folgerung:** Die vorhandene FSRS-Planung lässt sich übernehmen. Es gibt keinen Beleg, dass Grammatik
einen grundsätzlich anderen Planer bräuchte.

### 1.5 Mischen statt Blöcke – aber nicht beim ersten Kontakt

- Gemischte Übung verschiedener Strukturen (*interleaving*) verbessert das langfristige Behalten von
  Grammatik (Nakata & Suzuki 2019, englische Zeiten).
- Pan et al. (2019, spanisches *pretérito* vs. *imperfecto*): In einer einzelnen Sitzung kein Vorteil,
  über mehrere Sitzungen hinweg aber deutlich bessere Ergebnisse eine Woche später.
- Der Grund: Beim Mischen muss man jedes Mal **entscheiden, welche Regel gilt** – genau das verlangt auch
  echte Sprache, und in geblockten Übungen fällt es weg.

**Folgerung:** Eine neue Regel wird zuerst für sich eingeführt und geübt (Block). In den Wiederholungen
(„Heute fällig“) kommen die Aufgaben verschiedener Regeln gemischt, vor allem verwechselbare Regeln
(*simple past* vs. *present perfect*).

### 1.6 Die Regel lernen, nicht den Satz

Wer immer denselben Satz übt, lernt irgendwann den Satz auswendig statt der Regel. Wechselnde Beispiele
fördern die Übertragung auf neue Sätze (*variability of practice*, Schmidt & Bjork 1992).

**Folgerung:** Geplant (FSRS) wird **pro Regel**, nicht pro Satz. Jede Wiederholung einer Regel nimmt
Sätze, die länger nicht dran waren. Die Lehrkraft sollte pro Regel genug Sätze anlegen (Richtwert ≥ 8).

### 1.7 Zusammenfassung der Leitlinien

| Prinzip | Beleg | Umsetzung |
|---|---|---|
| Explizite Regel, gern angeleitet entdeckt | Norris & Ortega 2000; Spada & Tomita 2010; Cerezo et al. 2016 | Regelkarte zu jeder Einheit, optional „Beispiele → Frage → Regel“ |
| Form mit Bedeutung verbinden | DeKeyser 2007; Wong & VanPatten 2003 | ganze Sätze mit Kontext, keine reinen Formentabellen als einzige Übung |
| Erkennen → Bilden | Shintani 2015 | Grammatik-Leiter |
| Prompt + Metasprache + Fehlerstelle | Lyster & Saito 2010; Heift 2004 | zweiter Versuch mit Hinweis, dann Lösung |
| Verteilt wiederholen | Bird 2010; Rogers 2015; Kasprowicz et al. 2019 | FSRS wie bei Vokabeln |
| Mischen in Wiederholungen | Nakata & Suzuki 2019; Pan et al. 2019 | Einführung geblockt, Wiederholung gemischt |
| Regel statt Satz lernen | Schmidt & Bjork 1992 | Planung pro Regel, wechselnde Sätze |
| Abrufen statt Nachlesen | Roediger & Karpicke 2006 (schon im README) | Regel erst nach der Antwort bzw. als Tipp (zählt dann als *hard*) |

---

## 2. Was die App können soll

### 2.1 Begriffe

- **Grammatikliste** – eine Liste mit `kind = 'grammar'`. Wird wie eine Vokabelliste Gruppen zugewiesen,
  geteilt, kopiert, offline geladen und ausgewertet.
- **Regel** (Einheit) – z. B. „Present perfect mit *since/for*“. Hat Titel, Merksatz (eine Zeile, Pflicht),
  Erklärung (kurzer Text, optional mit Beispielen) und Aufgaben.
- **Aufgabe** – ein Übungssatz zu einer Regel, in einer einfachen Textsyntax (siehe 2.3).

### 2.2 Aufgabentypen

| Typ | Was passiert | Leiterstufe |
|---|---|---|
| **Auswählen** | Satz mit Lücke, 2–4 Formen zur Wahl (die Ablenker sind typische Fehler) | neu, Anfang |
| **Lücke** | Form eintippen, Grundform in Klammern als Hinweis (`(live)`), mehrere Lücken pro Satz möglich | ab Anfang |
| **Fehler finden** | Ein falscher Satz steht vorausgefüllt im Eingabefeld und wird korrigiert | ab „lernt“ |
| **Satzbau** | Satzteile in die richtige Reihenfolge tippen/antippen (Wortstellung, Fragen, Nebensätze) | ab Anfang |
| **Umformen / Übersetzen** | Satz nach Anweisung umformen („ins Passiv“) oder aus dem Deutschen übersetzen; mehrere Lösungen zulässig | ab „lernt“ |

Phase 1 bringt **Auswählen** und **Lücke** – sie decken den größten Teil üblicher Schulbuchübungen ab und
lassen sich zuverlässig automatisch prüfen. Die übrigen Typen folgen in Phase 2.

### 2.3 Eingabe für Lehrkräfte: Textsyntax

Pro Regel ein Textfeld, eine Aufgabe pro Zeile – schnell zu tippen, leicht aus Arbeitsblättern zu
übernehmen und zu teilen. Angelehnt an die vorhandene Sternchen-Syntax für Lückentexte.

```
She *has lived* (live) here since 2010.
I *haven't seen|have not seen* (not see) him for weeks.
They {have known|knew|are knowing} each other since school.
! knew = Seit wann? Mit „since“ steht das present perfect.
! lived = Die Handlung dauert bis jetzt an – present perfect.
Fehler: He have worked here for ten years. → He has worked here for ten years.
Ordnen: I / have never been / to Spain
Übersetzen: Ich kenne sie seit drei Jahren. → I have known her for three years. | I've known her for three years.
```

- `*…*` Lücke zum Eintippen, `|` trennt zulässige Varianten; `(…)` direkt dahinter ist der Hinweis
  (Grundform). Prüfung wie bisher über `check.js` (Akzente, Groß-/Kleinschreibung, Klammern, Tippfehler).
- `{richtig|Ablenker|Ablenker}` Auswahl, die erste Form ist die richtige (wird gemischt angezeigt).
- `! falsch = Hinweis` in der Zeile darunter: gezieltes Feedback, wenn genau diese falsche Antwort kommt.
  Ohne Treffer erscheint der Merksatz der Regel.
- `Fehler:`, `Ordnen:`, `Übersetzen:`/`Umformen:` kommen in Phase 2 (der Parser erkennt sie schon in
  Phase 1 und meldet „ab Version … verfügbar“, statt sie falsch zu lesen).

Der Editor zeigt die Aufgaben live als Vorschau und meldet Syntaxfehler zeilengenau. Die Syntax wird in
einem gemeinsamen Modul geparst (`public/grammar.js`), das Server (Prüfung beim Speichern), Browser und
Tests nutzen – wie heute `check.js` und `exercises.js`.

### 2.4 Grammatik-Leiter und Ablauf einer Runde

| Stufe der Regel | Ablauf |
|---|---|
| **neu** | Regelkarte (Merksatz, Erklärung, 2–3 Beispiele mit hervorgehobener Form; optional erst Beispiele + Frage, dann Regel), danach 2 × Auswählen und 1–2 × Lücke dieser Regel (geblockt) |
| **Anfang** (< 3 Tage Stabilität) | Lücke, Auswählen nur als Ausweichlösung; gemischt mit anderen Regeln |
| **ab „lernt“** (≥ 3 Tage) | Lücke, Fehler finden, Satzbau, Umformen/Übersetzen im Wechsel; gemischt |

- **Heute fällig:** fällige Regeln (älteste zuerst), pro Regel 2 Aufgaben, alle Aufgaben der Runde
  gemischt. Neue Regeln höchstens eine pro Runde und **in der Reihenfolge der Lehrkraft** (nicht zufällig
  wie bei Vokabeln – Grammatik baut aufeinander auf).
- **Frei üben:** eine oder mehrere Regeln wählen, auch geblockt (z. B. vor einer Arbeit); zählt für die
  Planung wie bei Vokabeln.
- **Satzauswahl:** pro Regel die Aufgaben, die am längsten nicht dran waren; möglichst nicht derselbe Satz
  wie beim letzten Mal.
- **Nach der Antwort** wird der ganze richtige Satz gezeigt und – bei „Ton an“ – vorgelesen (vorhandene
  Sprachausgabe).
- **Nicht geschafft:** Später in derselben Runde kommt eine *andere* Aufgabe derselben Regel (nur wenn es
  keine gibt, dieselbe) – wie das Wiederholen nicht gewusster Wörter.

### 2.5 Feedback-Ablauf

1. **Richtig** → weiter (grün, ganzer Satz).
2. **Falsch, erster Versuch** → Fehlerstelle markieren (Wort-Diff zwischen Eingabe und nächster Lösung),
   Hinweis zeigen: passendes `!`-Feedback der Lehrkraft, sonst der Merksatz. Eingabe bleibt stehen, zweiter
   Versuch.
3. **Falsch, zweiter Versuch** → Lösung mit markiertem Unterschied, Merksatz und Link „Regel ansehen“.
4. **„Fast!“** (nur Tippfehler/Akzent) wie bei Vokabeln: zählt als *hard*, „Ich hatte recht“ möglich.
5. **📖 Regel** ist jederzeit abrufbar, zählt vor der Antwort aber als Hilfe (*hard*) – Abrufen soll
   Vorrang vor Nachlesen haben.

### 2.6 Bewertung für die Planung

Pro Aufgabe:

| Ergebnis | Bewertung |
|---|---|
| richtig beim ersten Versuch (Lücke, Fehler, Satzbau, Übersetzen) | *good* |
| richtig beim ersten Versuch (Auswählen) | *hard* – nur Wiedererkennen, wie bei Vokabeln |
| richtig nach Hinweis / nach Blick auf die Regel / „Fast!“ | *hard* |
| falsch | *again* |

Pro Regel und Runde werden die Aufgaben zu **einer** FSRS-Bewertung zusammengefasst: die schlechteste
Bewertung der Runde. Grund: Mehrere Bewertungen am selben Tag erhöhen die Stabilität kaum, ein einzelnes
*again* würde sie aber senken – eine Bewertung pro Regel und Runde hält die Planung sauber und
nachvollziehbar. Im Verlauf wird trotzdem jede Aufgabe einzeln gespeichert.

### 2.7 Auswertung für Lehrkräfte

- Wie bei Vokabeln: Kennzahlen, Verlauf, Tabelle pro Schüler:in – mit **Regeln** statt Wörtern.
- **Neu: Häufigste Fehler** pro Aufgabe (z. B. „*knew* – 9 ×“). Das zeigt, welche Fehlvorstellung in der
  Klasse verbreitet ist, und eignet sich direkt für die nächste Stunde. Aus häufigen Fehlern kann die
  Lehrkraft mit einem Klick eine `!`-Feedbackzeile anlegen.

### 2.8 Datenschutz

Neu gespeichert wird die **eingegebene falsche Antwort** (gekürzt auf 200 Zeichen) für die Fehlerauswertung.
Das ist eine Leistungsangabe wie die übrigen Lernstandsdaten: im README unter „Datenschutz“ ergänzen,
Löschung wie bisher (`RETENTION_DAYS`, Zurücksetzen durch Schüler:innen). Die Fehlerliste zeigt der
Lehrkraft nur Anzahlen je Antwort, in der Einzelansicht einer Schülerin/eines Schülers auch deren Antworten.
Weiterhin keine externen Dienste – auch keine KI zum Prüfen oder Erzeugen von Aufgaben.

---

## 3. Technische Umsetzung

### 3.1 Datenbank (Migration 9, `src/db.js`)

```sql
ALTER TABLE lists ADD COLUMN kind TEXT NOT NULL DEFAULT 'vocab';   -- 'vocab' | 'grammar', geprüft in api.js

CREATE TABLE rules (
  id           INTEGER PRIMARY KEY,
  list_id      INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  pos          INTEGER NOT NULL,
  title        TEXT NOT NULL,
  summary      TEXT NOT NULL,              -- Merksatz (Pflicht)
  explanation  TEXT NOT NULL DEFAULT '',   -- Erklärung, einfache Auszeichnung (*Form* hervorheben)
  discover     INTEGER NOT NULL DEFAULT 0  -- 1 = erst Beispiele + Frage, dann Regel
);
CREATE INDEX rules_list ON rules(list_id, pos);

CREATE TABLE items (
  id       INTEGER PRIMARY KEY,
  rule_id  INTEGER NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  pos      INTEGER NOT NULL,
  source   TEXT NOT NULL                   -- Aufgabe in Textsyntax inkl. !-Feedbackzeilen, geparst von grammar.js
);
CREATE INDEX items_rule ON items(rule_id, pos);

-- FSRS-Stand pro Schüler:in und Regel (gleiche Spalten wie progress, ohne direction)
CREATE TABLE rule_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id INTEGER NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  box INTEGER NOT NULL DEFAULT 0, right INTEGER NOT NULL DEFAULT 0, wrong INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT NOT NULL, stability REAL, difficulty REAL, due TEXT, state INTEGER,
  reps INTEGER NOT NULL DEFAULT 0, lapses INTEGER NOT NULL DEFAULT 0,
  scheduled_days INTEGER NOT NULL DEFAULT 0, last_review TEXT,
  PRIMARY KEY (user_id, rule_id)
);
CREATE INDEX rule_progress_due ON rule_progress(user_id, due);

-- Verlauf: jede Aufgabe einzeln (item_id bleibt leer, wenn die Aufgabe später gelöscht wurde)
CREATE TABLE grammar_log (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id    INTEGER NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  item_id    INTEGER REFERENCES items(id) ON DELETE SET NULL,
  grade      TEXT NOT NULL,
  exercise   TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 1,
  answer     TEXT,                         -- erste falsche Antwort, max. 200 Zeichen
  stability  REAL,                         -- Stabilität der Regel danach (nur beim Regel-Eintrag der Runde)
  at         TEXT NOT NULL,
  client_id  TEXT
);
CREATE INDEX grammar_log_rule ON grammar_log(rule_id, at);
CREATE INDEX grammar_log_user ON grammar_log(user_id, at);
CREATE UNIQUE INDEX grammar_log_client ON grammar_log(user_id, client_id) WHERE client_id IS NOT NULL;
```

Warum eigene Tabellen statt `words`/`progress` wiederverwenden: Regeln haben andere Felder, Aufgaben
gehören zu Regeln statt direkt zur Liste, und die Planung läuft ohne Richtung. Über `lists.kind` bleiben
Gruppen, Teilen, Kopieren, Jahrgang, Sprachfilter und Offline-Download aber für beide Arten gleich.

`RETENTION_DAYS` und „Lernstand zurücksetzen“ müssen die neuen Tabellen mit erfassen.

### 3.2 Gemeinsames Modul `public/grammar.js`

Reine Funktionen, im Browser und in den Tests genutzt, vom Server zur Prüfung beim Speichern:

- `parseItem(source)` → `{ type, parts, gaps: [{ answers, hint }], options?, feedback: Map, … }` oder
  `{ error, line }`
- `checkGaps(item, inputs, settings)` → pro Lücke richtig/fast/falsch (nutzt `normalize`/`variants`/
  Tippfehler-Erkennung aus `check.js`)
- `diffWords(given, expected)` → Wortbereiche zum Markieren der Fehlerstelle
- `feedbackFor(item, answer, rule)` → gezieltes `!`-Feedback oder Merksatz
- `pickGrammarExercise({ level, item, random })` und `pickItems(rule, history, n)` (am längsten nicht
  gesehen, nicht derselbe wie zuletzt)
- `gradeFor(exercise, { correct, attempts, helped, almost })` und `roundGrade(grades)` (schlechteste)

### 3.3 API (`src/api.js`)

- `parseListBody` verzweigt nach `kind`: Vokabeln wie bisher, Grammatik mit `rules: [{ id?, title,
  summary, explanation, discover, items: [{ id?, source }] }]`. Limits analog zu `MAX_WORDS` (z. B. 100
  Regeln, 2000 Aufgaben). IDs bleiben beim Bearbeiten erhalten – wie `writeList` es für Wörter macht –,
  damit Lernstand und Fehlerstatistik nicht verloren gehen.
- `listDetail` liefert bei Grammatik `rules` (mit `items`) und `rule_progress` statt `words`/`progress`,
  außerdem pro Aufgabe den Zeitpunkt der letzten eigenen Bearbeitung (für die Satzauswahl, auch offline).
- `applyResults` bekommt einen zweiten Zweig für Einträge der Form
  `{ list_id, rule_id, grade, items: [{ item_id, exercise, grade, attempts, answer }], at, id }` –
  eine FSRS-Bewertung pro Regel, `grammar_log`-Zeilen pro Aufgabe. Duplikatschutz über `client_id` wie
  bisher. `/results` (offline) und `/lists/:id/results` funktionieren für beide Arten.
- `/lists/:id/stats` und `/stats/students/:uid` rechnen bei Grammatik über `rule_progress`/`grammar_log`;
  neu `errors: [{ item_id, answer, count }]` (Top-Fehler pro Aufgabe).
- Kopieren (`/lists/:id/copy`) kopiert Regeln und Aufgaben mit.
- `myProgressSummary`/Startseite: fällige Regeln zählen wie fällige Wörter („3 Regeln fällig“).

### 3.4 Oberfläche (`public/app.js`)

`app.js` hat schon 1 780 Zeilen. Grammatik kommt deshalb in eigene Dateien:

- `public/grammar-editor.js` – Editor: Regeln als aufklappbare Abschnitte (Titel, Merksatz, Erklärung,
  Aufgaben-Textfeld mit Live-Vorschau und Fehlermeldungen), Reihenfolge per ↑/↓, Import/Export als
  Textdatei.
- `public/grammar-learn.js` – Lernansicht: Regelkarte, Aufgaben, Feedback-Ablauf, Rundensteuerung.
  Wiederverwendet werden Sonderzeichen-Leiste, Sprachausgabe, Tastaturkürzel und die Offline-Warteschlange.
- In `app.js` nur die Weichen: „Neue Liste“ → Auswahl *Vokabeln* / *Grammatik*, Kennzeichnung auf den
  Listenkarten, Router für Editor/Lernen/Auswertung, Filter „Art“ unter „Geteilte Listen“.

### 3.5 Offline

`/offline` liefert Grammatiklisten mit; `store.js` speichert sie wie Vokabellisten, `schedule.js` plant
Regeln genauso (Zeile ohne `direction`). Die Warteschlange überträgt Grammatik-Einträge über das
bestehende `/results`. Der Service Worker muss die neuen JS-Dateien vorhalten (`sw.js`).

### 3.6 Tests (`node:test`)

- `test/grammar.test.js`: Parser (alle Syntaxelemente, Fehlermeldungen mit Zeile), Prüfung mehrerer
  Lücken, Varianten und optionale Teile, Diff, Feedback-Zuordnung, Satzauswahl, Bewertung und
  Rundenbewertung.
- `test/api.test.js`: Grammatikliste anlegen/bearbeiten (IDs bleiben), Rechte (nur zugewiesen sichtbar),
  Ergebnisse inkl. Duplikate und Offline-Zeitstempel, Kopieren, Statistik mit Fehlerliste, Zurücksetzen.
- Migrationstest: bestehende Datenbank mit Stand 8 → 9, Vokabellisten unverändert (`kind = 'vocab'`).

---

## 4. Phasen

### Phase 1 – Kern (MVP) ✅ umgesetzt

1. Migration 9, `kind` in Listen-API und Editor-Auswahl
2. `grammar.js`: Parser für Lücke und Auswählen inkl. `!`-Feedback, Prüfung, Diff, Bewertung + Tests
3. Grammatik-Editor mit Vorschau
4. Lernansicht: Regelkarte, Auswählen, Lücke, zweistufiges Feedback, Planung pro Regel, Mischen in
   „Heute fällig“, „Frei üben“
5. Ergebnisse/Offline/Startseite, Auswertung (Kennzahlen, Tabelle, Einzelansicht)
6. README: Abschnitt „Grammatik“ (Funktionen, Syntax, Forschung), Datenschutz ergänzen

Ergebnis: Lehrkräfte können z. B. „Present perfect vs. simple past“ oder „passé composé mit *être*“
anlegen, zuweisen und auswerten; Schüler:innen üben verteilt, gemischt und mit Feedback.

### Phase 2 – Mehr Aufgabentypen und Fehlerauswertung ✅ umgesetzt

1. Fehler finden, Satzbau, Umformen/Übersetzen
2. „Häufigste Fehler“ in der Auswertung, `!`-Feedback per Klick daraus anlegen
3. Regel entdecken lassen (`discover`): Beispiele → Frage → Regel

### Phase 3 – Ausbau (nach Rückmeldung aus dem Unterricht) – offen

- **Formengenerator** für regelmäßige Konjugationen (Französisch/Spanisch), der aus Verb + Zeit Aufgaben
  erzeugt – spart viel Tipparbeit, erzeugt aber nur Formen; die Lehrkraft ergänzt Kontextsätze.
- **Verknüpfung mit Vokabellisten**: markierte gebeugte Formen in Beispielsätzen (`*went*`) als
  Grammatikaufgaben anbieten.
- **Tempo-Runde** für sichere Regeln (Automatisierung, DeKeyser) – nur freiwillig, ohne Einfluss auf die
  Planung, da Zeitdruck für manche Schüler:innen demotivierend ist.
- Startpakete zum Teilen (von Lehrkräften erstellt; keine Schulbuchinhalte wegen Urheberrecht).

### Umsetzung: Entscheidungen und Abweichungen vom Entwurf

Phase 1 und 2 sind vollständig gebaut (Migration 9, `public/grammar.js`, Editor, Lernansicht, Auswertung, Offline,
Tests, README). Phase 3 wartet, wie vorgesehen, auf Rückmeldungen aus dem Unterricht. Beim Bauen haben sich
folgende Festlegungen ergeben:

- **Tippfehler-Toleranz strenger als bei Vokabeln.** In einer Grammatikübung ist ein „Tippfehler“ oft die falsche
  Form (*knew ↔ know* ist ein Buchstabe Abstand, *lived → live* ebenfalls). „Fast!“ gibt es deshalb nur für
  Akzent, Groß-/Kleinschreibung, zwei vertauschte Buchstaben oder einen ausgelassenen/doppelten Buchstaben mitten
  im Wort (nie am Wortanfang oder -ende: *here ↔ there*). Kommas und Anführungszeichen zählen nicht.
- **Hinweise:** Eine `!`-Zeile ohne `=` gilt als allgemeiner Hinweis für jede falsche Antwort der Aufgabe. Bei
  mehreren passenden Hinweisen gewinnt der genaueste (gleiche Antwort vor „kommt als Wort vor“, dann der längere
  Schlüssel). Reihenfolge: passender Hinweis → allgemeiner Hinweis → Merksatz.
- **Auswählen aus Lückenaufgaben:** Eine Lückenaufgabe mit genau einer Lücke wird auch zur Auswahl, wenn ihre
  `!`-Hinweise falsche Antworten nennen – diese werden die Ablenker („typische Fehler“). Umgekehrt wird eine
  Auswahl nie zur Lücke, weil ohne Grundform mehrere richtige Antworten möglich wären.
- **Stufenleiter:** Fehler finden, Umformen und Übersetzen kommen erst ab Stufe 2; fehlt eine freie Aufgabe für die
  geplante Art, nimmt die Runde eine passende andere Art (auf den unteren Stufen nie eine schwerere) oder hat
  weniger Aufgaben. Nach einem Fehler auf Stufe 0–1 ist die Wiederholung eine Auswahl (Erleichterung).
- **Regelkarte:** Beispielsätze stammen aus den Aufgaben der Regel (bei < 6 Aufgaben nur zum Entdecken) und kommen
  in der Einführung nicht gleich als Aufgabe dran. Die Frage beim Entdecken steht in der Erklärung als Zeile mit
  `?` am Anfang (sonst ein Standardtext).
- **Eine Bewertung pro Regel und Runde** wird gesendet, sobald alle Aufgaben der Regel in der Runde beantwortet
  sind; beim Beenden oder Verlassen der Runde und beim Wechsel der App in den Hintergrund gehen die schon beantworteten
  Aufgaben ebenfalls raus, auch eine schon abgeschickte, aber noch nicht mit „Weiter“ bestätigte Antwort (dann ist „Ich hatte
  recht“ nicht mehr möglich; der Rest der Regel bekommt eine zweite Bewertung). Wiederholungen nach Fehlern zählen nicht.
- **Speichern im Editor:** Aufgaben werden beim Bearbeiten wiedererkannt (gleicher Text, sonst ähnlichste
  Zeile mit derselben Hauptlösung und ≥ 60 % gleichen Wörtern; bei einer Auswahl zählt die richtige Form), sodass Lernstand und Fehlerstatistik erhalten bleiben. Der Textdatei-Import hängt Regeln nur an und
  ersetzt nichts. Jede Regel braucht einen Titel, einen Merksatz und mindestens eine Aufgabe.
- **Hinweis per Klick:** `POST /api/lists/:id/feedback` legt `! Antwort = Hinweis` unter der Aufgabe an (oder ersetzt
  den Hinweis zur selben Antwort). Antworten mit `|` oder `=` lassen sich so nicht anlegen (im Editor eintragen).
- **Offene Fragen (Abschnitt 5) wurden wie vorgeschlagen entschieden:** alle Sprachen ohne Sonderbehandlung
  (Latein später), Planung pro Regel, falsche Antworten werden gespeichert (vor dem Einsatz mit der/dem
  Datenschutzbeauftragten abstimmen – README, „Datenschutz“), keine gemischten Listen.
- **Technik:** Geteilte Hilfen aus `app.js` liegen jetzt in `ui.js` und `stats-ui.js` (unverändert verschoben);
  `app.js` enthält nur die Weichen. Der Migrationstest spielt auch den Sprung von Stand 8 auf 9 durch.

---

## 5. Offene Fragen

1. **Sprachen:** Zunächst Englisch, Französisch, Spanisch? Latein bräuchte eigene Aufgabentypen (Formen
   bestimmen, Übersetzen ins Deutsche) – eher später.
2. **Planung pro Regel** statt pro Satz – einverstanden? (Alternative: pro Aufgabe planen und nur in der
   Anzeige zu Regeln zusammenfassen; einfacher, lernt aber eher Sätze auswendig.)
3. **Falsche Antworten speichern** für die Fehlerauswertung – mit der/dem Datenschutzbeauftragten
   vereinbar? Sonst nur Zähler ohne Antworttext.
4. **Gemischte Listen** (Vokabeln und Grammatik in einer Liste) – bewusst nicht vorgesehen; zwei Listen
   derselben Lektion lassen sich gemeinsam zuweisen. Braucht es mehr?

---

## Literatur

- Bird, S. (2010). Effects of distributed practice on the acquisition of second language English syntax.
  *Applied Psycholinguistics, 31*, 635–650.
- Cerezo, L., Caras, A., & Leow, R. P. (2016). The effectiveness of guided induction versus deductive
  instruction on the development of complex Spanish *gustar* structures. *Studies in Second Language
  Acquisition, 38*, 265–291.
- DeKeyser, R. (2007). Skill acquisition theory. In B. VanPatten & J. Williams (Hrsg.), *Theories in
  Second Language Acquisition* (S. 97–113). Erlbaum.
- Goo, J., Granena, G., Yilmaz, Y., & Novella, M. (2015). Implicit and explicit instruction in L2 learning:
  Norris & Ortega (2000) revisited and updated. In P. Rebuschat (Hrsg.), *Implicit and Explicit Learning
  of Languages* (S. 443–482). Benjamins.
- Heift, T. (2004). Corrective feedback and learner uptake in CALL. *ReCALL, 16*(2), 416–431.
- Heift, T., & Rimrott, A. (2008). Learner responses to corrective feedback for spelling errors in CALL.
  *System, 36*(2), 196–213.
- Kasprowicz, R. E., Marsden, E., & Sephton, N. (2019). Investigating distribution of practice effects for
  the learning of foreign language verb morphology in the young learner classroom. *The Modern Language
  Journal, 103*(3), 580–606.
- Li, S. (2010). The effectiveness of corrective feedback in SLA: A meta-analysis. *Language Learning,
  60*(2), 309–365.
- Lyster, R., & Saito, K. (2010). Oral feedback in classroom SLA: A meta-analysis. *Studies in Second
  Language Acquisition, 32*(2), 265–302.
- Nagata, N. (1993). Intelligent computer feedback for second language instruction. *The Modern Language
  Journal, 77*(3), 330–339.
- Nakata, T., & Suzuki, Y. (2019). Mixing grammar exercises facilitates long-term retention: Effects of
  blocking, interleaving, and increasing practice. *The Modern Language Journal, 103*(3), 629–647.
- Norris, J. M., & Ortega, L. (2000). Effectiveness of L2 instruction: A research synthesis and
  quantitative meta-analysis. *Language Learning, 50*(3), 417–528.
- Pan, S. C., Tajran, J., Lovelett, J., Osuna, J., & Rickard, T. C. (2019). Does interleaved practice
  enhance foreign language learning? The effects of training schedule on Spanish verb conjugation skills.
  *Journal of Educational Psychology, 111*(7), 1172–1188.
- Rogers, J. (2015). Learning second language syntax under massed and distributed conditions. *TESOL
  Quarterly, 49*(4), 857–866.
- Schmidt, R. A., & Bjork, R. A. (1992). New conceptualizations of practice. *Psychological Science,
  3*(4), 207–217.
- Shintani, N. (2015). The effectiveness of processing instruction and production-based instruction on L2
  grammar acquisition: A meta-analysis. *Applied Linguistics, 36*(3), 306–325.
- Spada, N., & Tomita, Y. (2010). Interactions between type of instruction and type of language feature:
  A meta-analysis. *Language Learning, 60*(2), 263–308.
- Suzuki, Y. (2017). The optimal distribution of practice for the acquisition of L2 morphology.
  *Language Learning, 67*(3), 512–545.
- Suzuki, Y., & DeKeyser, R. (2017). Effects of distributed practice on the proceduralization of
  morphology. *Language Teaching Research, 21*(2), 166–188.
- Wong, W., & VanPatten, B. (2003). The evidence is IN: Drills are OUT. *Foreign Language Annals, 36*(3),
  403–423.
