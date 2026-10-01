# Vokabeltrainer

Ein schlanker Vokabeltrainer für Schulen. Lehrkräfte legen Wortlisten an (im Editor oder per CSV-Import)
und weisen sie Klassen bzw. Kursen zu. Schüler:innen lernen mit der **Lernleiter**, deren Aufgaben mit
dem Lernstand jedes Worts schwerer werden (kennenlernen → auswählen → eintippen → Lückentext und Hörübung),
oder wahlweise nur mit **Karteikarten**, **Eintippen** oder **Auswählen** – in beide Richtungen.
Dazu gibt es **Grammatiklisten** mit Regeln und Aufgaben (Lücke, Auswählen, Fehler finden, Satzbau,
Umformen/Übersetzen), geplant pro Regel – siehe [Grammatik](#grammatik).

Die Anmeldung läuft über **OpenID Connect**, z. B. über das Single-Sign-On von **IServ**.
Gruppen (Klassen/Kurse) und die Rolle „Lehrkraft“ werden direkt aus IServ übernommen.

## Funktionen

**Für Lehrkräfte**
- **Vokabellisten und Grammatiklisten** anlegen („+ Neue Vokabelliste“, „+ Neue Grammatikliste“) – zur Grammatik
  siehe [unten](#grammatik)
- Listen im Browser-Editor anlegen und bearbeiten (Enter springt in die nächste Zeile), mit Werkzeugleiste:
  **✱ Lücke** (Wort im Beispielsatz markieren – automatisch oder die Auswahl), **( ) optional**, **; Alternative**,
  Sonderzeichen der Sprache (é, ñ, ā …) und **Alle Lücken setzen**. Sätze, aus denen noch kein Lückentext wird,
  sind rot umrandet.
- **Mit KI erstellen** (siehe unten): fertigen Prompt kopieren, Antwort der KI einfügen, Vorschau prüfen, übernehmen
- Import von Dateien und eingefügtem Text: CSV (Semikolon, Komma, Tab), aus Excel kopierte Tabellen,
  Markdown-Tabellen, Zeilen wie `dog – Hund` oder `1. to go = gehen`; Kopfzeile wie `Englisch;Deutsch` wird
  erkannt. Spalten: Wort A, Wort B, optional Notiz und Beispielsatz. Export als CSV
- Pro Wort optional ein **Beispielsatz**: Kommt das Wort darin vor, wird daraus ein Lückentext.
  Gebeugte Formen mit Sternchen markieren: `Yesterday I *went* home.`
- Pro Liste festlegen:
  - die **Sprachen** aus einer Auswahlliste (Schulfremdsprachen, Deutsch und Herkunftssprachen für DaZ) und bei zwei
    verschiedenen Sprachen, welche davon **gelernt wird** (siehe unten „Deutsch: Deutschunterricht und DaZ“)
  - Abfrage als **Lernleiter** (empfohlen, Standard für neue Listen), **Karteikarten**, **Eintippen** oder **Auswählen**
    – und ob Schüler:innen die Abfrageart selbst wechseln dürfen (Standard: ja)
  - beim Eintippen: Groß-/Kleinschreibung und Akzente/Umlaute beachten – ja/nein
  - Standard-Richtung (A → B, B → A, gemischt) und ob Schüler:innen sie wechseln dürfen
- Liste einer oder mehreren IServ-Gruppen zuweisen
- Listen **für Kolleg:innen freigeben** (freiwillig, pro Liste): Andere Lehrkräfte finden sie unter
  „Geteilte Listen“, können sie ausprobieren und eine eigene Kopie anlegen, die sie frei bearbeiten und
  ihren Gruppen zuweisen. Das Original bleibt unverändert, Lernstände werden nicht geteilt.
- Pro Liste die **Jahrgangsstufe** (1–13) angeben – Pflichtfeld; ältere Listen bekommen sie beim nächsten Speichern.
  Unter „Geteilte Listen“ lässt sich nach **Art** (Vokabeln/Grammatik), **Sprache** und **Jahrgang** filtern und nach
  Änderungsdatum, Jahrgang oder Titel sortieren; die Auswahl wird im Browser gemerkt.
- **Auswertung** pro Liste und Gruppe:
  - Kennzahlen: Schüler:innen, aktiv in den letzten 7 Tagen, Ø sicher, Ø geübt, heute fällig
  - Verlauf der letzten 8 Wochen: Ø sicher und Abfragen pro Woche (Diagramm und Tabelle)
  - Tabelle pro Schüler:in (sortierbar): sicher, geübt, fällig, richtig/falsch, zuletzt aktiv
  - Einzelansicht per Klick auf den Namen: Lernstand jedes Worts in beiden Richtungen
  - schwierigste Wörter der Gruppe und Export als CSV
  - bei Grammatik mit Regeln statt Wörtern, dazu **häufigste Fehler** (siehe [Grammatik](#grammatik))

**Für alle**
- Darstellung hell, dunkel oder wie das Gerät (Knopf oben rechts, wird im Browser gemerkt)

**Für Schüler:innen**
- sehen nur Listen ihrer Gruppen
- Zwei Modi:
  - **Heute fällig** – verteiltes Wiederholen: Das Programm plant für jedes Wort (bei Grammatik: jede Regel), wann
    es wiederkommt (siehe unten). Die Startseite zeigt, wie viele Wörter und Regeln heute fällig sind.
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
(„Englisch“ → britisches Englisch, „Englisch (amerikanisch)“ → amerikanisches; Französisch und Spanisch immer europäisch, siehe unten).
Ältere Listen mit frei eingetippter Bezeichnung (z. B. „Englisch (USA)“ oder `en-AU`) behalten sie, bis die Lehrkraft
im Editor eine Sprache aus der Auswahl wählt.
Latein und Altgriechisch werden nicht vorgelesen.

**Prüfregeln beim Eintippen**
- Mehrere richtige Lösungen mit `;` oder `|` trennen: `big; large`
- Teile in Klammern sind optional: `(to) go` akzeptiert `go` und `to go`
- Endungen der weiblichen Form: `bueno/a`, `trabajador, -a`, `heureux, -euse` akzeptieren die Grundform und die
  abgeleitete Form (`buena`, `trabajadora`, `heureuse`). Für ganz verschiedene Formen `;` nehmen: `rojo; roja`
- Leerzeichen und `.` `!` `?` `…` am Ende zählen nicht, die spanischen `¿` `¡` nirgends
- Kleine Tippfehler werden als „Fast!“ angezeigt (zählen als falsch, mit „Ich hatte recht“ korrigierbar); stimmen nur
  Akzente bzw. Groß-/Kleinschreibung nicht, steht das dabei

**Französisch, Spanisch und andere Sprachen**
- Unter dem Eingabefeld erscheint eine **Sonderzeichen-Leiste** mit den Zeichen, die in den Wörtern der Liste
  vorkommen und auf der deutschen Tastatur fehlen (z. B. é, è, ç, œ bzw. á, ñ, ¿, ¡). Antippen fügt das Zeichen ein, die
  Bildschirmtastatur bleibt offen.
- Artikel gehören zur Lösung, wenn das Genus mitgelernt werden soll (`le chien`, `la casa`); optional mit Klammern:
  `(le) chien`. Bei Wörtern mit `l'` die Genus-Angabe in die Notiz schreiben (`l'arbre` – Notiz „m“).
- „Akzente beachten“ sollte für Französisch und Spanisch an bleiben; fehlt nur ein Akzent, zeigt die App das an.
- Aussprache: Französisch aus Frankreich (fr-FR) und Spanisch aus Spanien (es-ES) – nie eine kanadische bzw.
  lateinamerikanische Stimme. Hat ein Gerät keine passende Stimme, gibt es für diese Sprache keinen Ton.

## Listen mit KI erstellen

Viele Listen entstehen mit einer KI. Damit das ohne Nacharbeit klappt, erzeugt der Editor unter
**„✨ Mit KI erstellen oder Text einfügen“** einen passenden Prompt:

1. Oben Titel, Sprachen und Jahrgang eintragen, im Import-Bereich Thema und Anzahl – der Prompt passt sich an.
2. **Prompt kopieren** und in die KI eurer Schule einfügen. Er enthält keine personenbezogenen Daten.
3. Die Antwort komplett einfügen – Einleitungs- und Schlusssätze der KI werden ignoriert. Die Vorschau zeigt,
   was erkannt wurde; dann **Übernehmen** oder **Anhängen**.
4. Kurz prüfen: rot umrandete Beispielsätze mit **✱ Lücke** nacharbeiten (Wort im Satz auswählen, antippen).

Der Prompt verlangt CSV mit Semikolon und den Spalten Wort, Bedeutung, Notiz, Beispielsatz: Nomen mit Artikel,
Verben im Infinitiv, Alternativen mit `|`, optionale Teile in Klammern, weibliche Formen als `bueno/a`,
Beispielsätze passend zum Jahrgang mit markierter Lücke. Liefert die KI stattdessen eine Tabelle oder eine
Liste mit Gedankenstrichen, wird das ebenfalls erkannt. KI-Listen können Fehler enthalten – vor dem Freigeben
bitte gegenlesen.

**Deutsch: Deutschunterricht und DaZ**
- **Deutschunterricht** (Begriffe, Fremdwörter, Fachwortschatz): auf beiden Seiten „Deutsch“ wählen. Seite A ist dann
  der **Begriff**, Seite B die **Bedeutung** (Erklärung oder Synonym) – so heißen die Seiten auch beim Lernen. Der
  KI-Prompt fragt entsprechend nach Begriffen mit kurzer Erklärung.
- **DaZ / Deutsch als Fremdsprache**: „Deutsch“ und die Herkunftssprache wählen (z. B. Türkisch, Arabisch, Ukrainisch)
  und bei **Gelernt wird** „Deutsch“ einstellen. Danach richten sich Lückentexte (Beispielsätze auf Deutsch),
  Aussprache und Hörübungen (deutsche Stimme) sowie der KI-Prompt. Ohne diese Einstellung gilt wie bisher die nicht
  deutsche Seite als gelernte Sprache.
- Unter „Geteilte Listen“ filtert **Sprache** nach der gelernten Sprache: „Deutsch“ zeigt Listen für den
  Deutschunterricht, DaZ-Listen und deutsche Grammatik – nicht jede Englisch-↔-Deutsch-Liste.
- **Deutsche Grammatik**: Grammatikliste mit Sprache „Deutsch“; „Groß-/Kleinschreibung beachten“ ist dann
  voreingestellt. Ein falscher Umlaut oder ß gilt beim Eintippen als falsch, nicht als „Fast!“ – *konnte* statt
  *könnte* ist eine andere Form. In einer Auswahl dürfen sich die Formen nur im Umlaut oder in der Groß- und
  Kleinschreibung unterscheiden: `Wenn ich fliegen {könnte|konnte|kann}, …`, `Beim {Essen|essen} redet man nicht.`
  „Fehler finden“ eignet sich dagegen nicht für reine Rechtschreibfehler (Groß/klein, ß/ss) – dafür Lücke oder Auswahl
  nehmen.

## Grammatik

Neben Vokabellisten gibt es **Grammatiklisten**: Eine Liste besteht aus **Regeln** (z. B. „Present perfect mit
*since* und *for*“), jede mit Merksatz, Erklärung und Aufgaben. Beim Anlegen wählt die Lehrkraft
**+ Neue Vokabelliste** oder **+ Neue Grammatikliste**. Grammatiklisten werden wie Vokabellisten Gruppen zugewiesen,
für Kolleg:innen freigegeben, kopiert (mit Regeln und Aufgaben), offline geladen und ausgewertet; unter „Geteilte
Listen“ lässt sich nach **Art** filtern. Weil Grammatik aufeinander aufbaut, kommen neue Regeln in der Reihenfolge
der Lehrkraft dran.

### Mitgelieferte Vorlagen

Die App bringt fertige Grammatiklisten für **Englisch**, **Deutsch**, **Französisch** und **Spanisch** mit (je 14 Themen, siehe
[`vorlagen/grammatik/`](vorlagen/grammatik/)). Sie stehen beim Start automatisch unter „Geteilte Listen“, markiert als
**Vorlage**: Lehrkräfte probieren sie aus und legen mit **Kopieren** eine eigene Liste an, die sie anpassen und ihren
Gruppen zuweisen. Die Vorlagen selbst gehören niemandem – niemand kann sie ändern oder löschen, Schüler:innen sehen sie
nicht. Ändert sich eine Vorlagendatei, wird die Vorlage beim nächsten Start aktualisiert; bereits angelegte Kopien
bleiben, wie sie sind. Mit `TEMPLATES=false` werden die Vorlagen nicht angeboten.

### Aufgaben schreiben

Pro Regel ein Textfeld, **eine Aufgabe pro Zeile** – schnell zu tippen und leicht aus Arbeitsblättern zu übernehmen.
Der Editor zeigt die Aufgaben live als Vorschau und meldet Fehler zeilengenau; beim Speichern prüft der Server mit
demselben Code. Die Werkzeugleiste fügt die Bausteine ein (auch Sonderzeichen der Sprache).

```
She *has lived* (live) here since 2010.
I *haven’t seen|have not seen* (not see) him for weeks.
They {have known|knew|are knowing} each other since school.
! knew = Seit wann? Mit „since“ steht das present perfect.
! lived = Die Handlung dauert bis jetzt an – present perfect.
Fehler: He have worked here for ten years. → He has worked here for ten years.
Ordnen: I / have never been / to Spain
Übersetzen: Ich kenne sie seit drei Jahren. → I have known her for three years. | I’ve known her for three years.
Umformen: Ins Passiv: They built the house. → The house was built.
```

| Aufgabe | Schreibweise |
|---|---|
| **Lücke** zum Eintippen | `*Form*` – `\|` trennt gültige Varianten, `(Grundform)` direkt dahinter ist der Hinweis, `(…)` in der Lücke ist optional; mehrere Lücken pro Satz möglich |
| **Auswählen** | `{richtig\|falsch\|falsch}` – die erste Form ist richtig (wird gemischt), 2 bis 4 Formen; die falschen sollten typische Fehler sein |
| **Fehler finden** | `Fehler: falscher Satz → richtiger Satz` – der falsche Satz steht im Eingabefeld und wird korrigiert |
| **Satzbau** | `Ordnen: Teil / Teil / Teil` – die Teile erscheinen gemischt und werden in die richtige Reihenfolge getippt; weitere gültige Reihenfolgen mit `\|` |
| **Übersetzen** / **Umformen** | `Übersetzen: Deutscher Satz → Lösung \| andere Lösung`, `Umformen: Anweisung und Satz → Lösung` |
| **Hinweis** | `! falsche Antwort = Hinweis` in der Zeile darunter (`\|` für mehrere falsche Antworten); ohne `=` gilt der Hinweis für jede falsche Antwort |

Regeln haben außerdem: **Merksatz** (eine Zeile, Pflicht – erscheint als Hinweis, wenn es keinen besseren gibt),
**Erklärung** (kurzer Text; `*Sternchen*` heben Formen hervor; eine Zeile mit `?` am Anfang ist die Frage beim
Entdecken) und die Option **Regel entdecken lassen** (erst Beispiele und eine Frage, dann die Regel). Regeln lassen
sich mit ↑/↓ umsortieren; **Import und Export als Textdatei** (`## Titel`, `Merksatz:`, `Erklärung:`, `Aufgaben:`)
erleichtern das Übernehmen aus Dokumenten. Beim Bearbeiten bleibt die Verknüpfung zu Lernstand und Fehlerstatistik
erhalten, solange eine Aufgabe erkennbar dieselbe ist. Richtwert: mindestens 8 Aufgaben pro Regel – mit
wechselnden Sätzen lernen Schüler:innen die Regel statt die Sätze.

Geprüft wird wie bei Vokabeln (Groß-/Kleinschreibung und Akzente je nach Listeneinstellung), Kommas und
Anführungszeichen zählen nicht. Bei **Tippfehlern ist die Prüfung strenger**: Nur vertauschte oder ausgelassene
Buchstaben mitten im Wort gelten als „Fast!“ – eine andere Form (*knew* statt *know*, *live* statt *lived*) ist in
der Grammatik kein Tippfehler, sondern der Fehler, um den es geht.

### Ablauf für Schüler:innen

| Stufe der Regel | Ablauf |
|---|---|
| **neu** | Regelkarte (Merksatz, Erklärung, Beispiele mit hervorgehobener Form; bei „Entdecken“ erst die Beispiele mit Frage), danach 2 × Auswählen und 2 × Lücke dieser Regel – im Block |
| **Anfang** (< 3 Tage Stabilität) | vor allem Lücke und Satzbau, gemischt mit anderen Regeln; Auswählen nur als Erleichterung nach einem Fehler |
| **ab „lernt“** (≥ 3 Tage) | Lücke, Fehler finden, Satzbau, Umformen/Übersetzen im Wechsel, gemischt |

- **Heute fällig:** fällige Regeln (älteste zuerst, 3 / 5 / 10 pro Runde), je 2 Aufgaben, alle Aufgaben der Runde
  gemischt. Dazu höchstens **eine neue Regel** als geschlossener Block vorweg.
- **Frei üben:** eine oder mehrere Regeln wählen, gemischt oder nach Regeln geordnet (z. B. vor einer Arbeit);
  zählt für die Planung wie bei Vokabeln.
- Pro Regel kommen die Aufgaben dran, die am längsten nicht dran waren – nicht zweimal hintereinander derselbe Satz.
- Nach der Antwort steht der **ganze richtige Satz** da und wird bei „Ton an“ vorgelesen.
- **Nicht geschafft:** Später in derselben Runde kommt eine *andere* Aufgabe derselben Regel (nur wenn es keine gibt,
  dieselbe).

**Feedback in zwei Stufen:** Bei einer falschen Antwort zeigt die App nicht gleich die Lösung, sondern markiert die
Fehlerstelle (falsche Lücke, falsche Wörter, falsch stehende Satzteile) und gibt einen **Hinweis** – den der
Lehrkraft zu genau dieser falschen Antwort, sonst den Merksatz. Die Eingabe bleibt stehen: zweiter Versuch. Erst
danach folgen die Lösung mit markiertem Unterschied, der Merksatz und „📖 Regel ansehen“. Bei „Fast!“ zählt die
Antwort als „mit Mühe“, „Ich hatte recht“ ist möglich.

**📖 Regel** lässt sich jederzeit aufrufen – *vor* der Antwort zählt das aber als Hilfe (die Aufgabe gilt dann als
„mit Mühe gewusst“), damit Abrufen Vorrang vor Nachlesen behält.

### Bewertung für die Planung

| Ergebnis einer Aufgabe | Bewertung |
|---|---|
| richtig beim ersten Versuch (Lücke, Fehler finden, Satzbau, Umformen/Übersetzen) | *good* |
| richtig beim ersten Versuch beim Auswählen | *hard* – nur Wiedererkennen, wie bei Vokabeln |
| richtig nach Hinweis, nach Blick auf die Regel vor der Antwort oder „Fast!“ | *hard* |
| falsch (auch nach dem zweiten Versuch) | *again* |

Geplant wird **pro Regel, nicht pro Satz** – sonst würde irgendwann der Satz auswendig gelernt statt der Regel.
Pro Regel und Runde zählt **eine** Bewertung: die schlechteste der Runde. Mehrere Bewertungen am selben Tag
erhöhen die Stabilität kaum, ein einzelnes *again* würde sie aber senken. Im Verlauf wird trotzdem jede Aufgabe
einzeln gespeichert. Beim Beenden oder Verlassen einer Runde – und wenn die App in den Hintergrund geht – werden die schon beantworteten Aufgaben übernommen, auch eine abgeschickte, aber noch nicht mit „Weiter“ bestätigte (dann entfällt „Ich hatte recht“; für den Rest der Regel gibt es eine zweite Bewertung).

### Auswertung für Lehrkräfte

Wie bei Vokabeln (Kennzahlen, Verlauf, Tabelle pro Schüler:in, CSV-Export, Einzelansicht) – mit Regeln statt Wörtern.
Dazu: **Schwierigste Regeln** und **Häufigste Fehler** pro Aufgabe („*knew* – 9 ×“): Das zeigt, welche Fehlvorstellung
in der Klasse verbreitet ist, und eignet sich direkt für die nächste Stunde. Die Klassenliste zeigt nur Anzahlen je
Antwort, **ohne Namen**; die falschen Antworten einer Person stehen nur in deren Einzelansicht. Mit **Hinweis
anlegen** wird aus einem häufigen Fehler ein `! Antwort = Hinweis` unter der Aufgabe.

### Wissenschaftliche Grundlagen der Grammatik

Die Gestaltung folgt dem Forschungsstand zum Grammatiklernen; die ausführliche Herleitung steht in
[docs/grammatik-plan.md](docs/grammatik-plan.md).

| Befund | Umsetzung |
|---|---|
| Explizite Regel plus Übung wirkt stärker als „nur Beispiele“; angeleitetes Entdecken ist mindestens so gut (Norris & Ortega 2000; Spada & Tomita 2010; Cerezo et al. 2016) | Regelkarte zu jeder Regel, optional „Beispiele → Frage → Regel“ |
| Übung muss Form mit Bedeutung verbinden (DeKeyser 2007; Wong & VanPatten 2003) | ganze Sätze mit Signalwörtern statt reiner Formentabellen |
| Erst erkennen, dann selbst bilden (Shintani 2015) | neue Regeln: erst Auswählen, dann Lücke; „sicher“ heißt selbst gebildet |
| Hinweise, die zum Selbstkorrigieren anregen, und Markierung der Fehlerstelle wirken besser als Vorsagen (Lyster & Saito 2010; Heift 2004; Nagata 1993) | zweiter Versuch mit Hinweis, danach erst die Lösung |
| Verteiltes Wiederholen (Bird 2010; Rogers 2015; Kasprowicz et al. 2019) | FSRS wie bei Vokabeln |
| Gemischtes Üben verbessert das langfristige Behalten, aber nicht beim ersten Kontakt (Nakata & Suzuki 2019; Pan et al. 2019) | Einführung im Block, Wiederholungen gemischt |
| Wechselnde Beispiele fördern die Übertragung (Schmidt & Bjork 1992) | Planung pro Regel, Sätze wechseln |
| Abrufen statt Nachlesen (Roediger & Karpicke 2006) | Regel vor der Antwort zählt als Hilfe |

**Bewusst nicht vorgesehen:** Vokabeln und Grammatik in einer Liste (zwei Listen derselben Lektion lassen sich
gemeinsam zuweisen), Tempo-Runden mit Zeitdruck sowie KI zum Prüfen oder Erzeugen von Aufgaben in der App selbst.

**Literatur (Grammatik)**
- Bird, S. (2010). Effects of distributed practice on the acquisition of second language English syntax. *Applied Psycholinguistics, 31*, 635–650.
- Cerezo, L., Caras, A., & Leow, R. P. (2016). The effectiveness of guided induction versus deductive instruction on the development of complex Spanish *gustar* structures. *Studies in Second Language Acquisition, 38*, 265–291.
- DeKeyser, R. (2007). Skill acquisition theory. In B. VanPatten & J. Williams (Hrsg.), *Theories in Second Language Acquisition* (S. 97–113). Erlbaum.
- Heift, T. (2004). Corrective feedback and learner uptake in CALL. *ReCALL, 16*(2), 416–431.
- Kasprowicz, R. E., Marsden, E., & Sephton, N. (2019). Investigating distribution of practice effects for the learning of foreign language verb morphology in the young learner classroom. *The Modern Language Journal, 103*(3), 580–606.
- Lyster, R., & Saito, K. (2010). Oral feedback in classroom SLA: A meta-analysis. *Studies in Second Language Acquisition, 32*(2), 265–302.
- Nagata, N. (1993). Intelligent computer feedback for second language instruction. *The Modern Language Journal, 77*(3), 330–339.
- Nakata, T., & Suzuki, Y. (2019). Mixing grammar exercises facilitates long-term retention: Effects of blocking, interleaving, and increasing practice. *The Modern Language Journal, 103*(3), 629–647.
- Norris, J. M., & Ortega, L. (2000). Effectiveness of L2 instruction: A research synthesis and quantitative meta-analysis. *Language Learning, 50*(3), 417–528.
- Pan, S. C., Tajran, J., Lovelett, J., Osuna, J., & Rickard, T. C. (2019). Does interleaved practice enhance foreign language learning? The effects of training schedule on Spanish verb conjugation skills. *Journal of Educational Psychology, 111*(7), 1172–1188.
- Rogers, J. (2015). Learning second language syntax under massed and distributed conditions. *TESOL Quarterly, 49*(4), 857–866.
- Schmidt, R. A., & Bjork, R. A. (1992). New conceptualizations of practice. *Psychological Science, 3*(4), 207–217.
- Shintani, N. (2015). The effectiveness of processing instruction and production-based instruction on L2 grammar acquisition: A meta-analysis. *Applied Linguistics, 36*(3), 306–325.
- Spada, N., & Tomita, Y. (2010). Interactions between type of instruction and type of language feature: A meta-analysis. *Language Learning, 60*(2), 263–308.
- Wong, W., & VanPatten, B. (2003). The evidence is IN: Drills are OUT. *Foreign Language Annals, 36*(3), 403–423.

## Lernen ohne Internet (iPad)

Für Schüler:innen, die nur in der Schule WLAN haben: Die App lädt bei jeder Verbindung alle zugewiesenen
Listen (Vokabeln und Grammatik) samt Lernstand auf das Gerät. Zu Hause wird damit weitergelernt – auch „Heute fällig“ stimmt, weil
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

Bei Grammatik gilt dasselbe je **Regel** statt je Wort und Richtung (siehe [Grammatik](#grammatik)).

Mehrfaches Wiederholen am selben Tag erhöht die Stabilität kaum – Pauken bringt kurzfristig etwas,
für die Planung zählt aber das Behalten über Tage. „Sicher“ in der Auswertung heißt: Das Wort würde
auch in zwei Wochen noch mit mindestens 90 % Wahrscheinlichkeit gewusst.

## Wissenschaftliche Grundlagen

Die App setzt die Befunde um, die für das Vokabellernen am besten belegt sind. Übersicht:

| Befund | Umsetzung in der App |
|---|---|
| **Abrufen statt Wiederlesen** (*testing effect*): Wer sich selbst abfragt, behält deutlich mehr als beim erneuten Lesen (Roediger & Karpicke 2006; Karpicke & Roediger 2008). | Jede Übung ist eine Abfrage; auch neue Wörter werden kurz nach dem Kennenlernen abgefragt. |
| **Verteiltes Wiederholen** (*spacing effect*): Wiederholungen über Tage verteilt schlagen Pauken, der optimale Abstand wächst mit der Behaltensdauer (Cepeda et al. 2006, 2008; Kornell 2009). | Planung mit FSRS: jedes Wort kommt wieder, wenn es nur noch zu ~90 % gewusst würde. |
| **Wiederholen bis zum Erfolg, über mehrere Tage** (*successive relearning*; Rawson & Dunlosky 2011). | Falsche Wörter kommen in derselben Runde wieder, bis sie einmal sitzen, und am nächsten Tag erneut. |
| **Gezielte Schwierigkeit** (*desirable difficulties*): Aufgaben, die gerade noch lösbar sind, bringen am meisten; schwierigeres erfolgreiches Abrufen stärkt das Gedächtnis mehr (Bjork 1994; Pyc & Rawson 2009). | Lernleiter: kennenlernen → auswählen → eintippen → Lückentext/Hören, je nach Stufe des Worts. |
| **Erst erkennen, dann selbst hervorbringen**: Rezeptives und produktives Lernen stärken je eigene Wissensarten; Karteikarten-Software sollte beides abdecken (Webb 2009; Nakata 2011). | Auswählen für neue Wörter, danach Eintippen; beide Richtungen wählbar. |
| **Auswählen kann echtes Abrufen sein**, wenn die falschen Antworten plausibel sind; Rückmeldung verhindert, dass Falsches hängen bleibt (Little et al. 2012; Butler & Roediger 2008). | Ablenker aus derselben Liste, ähnlich in Länge und Wortart (Artikel, *to*); sofortige Rückmeldung mit Lösung. |
| **Schrittweise Hinweise** helfen beim Erinnern (Finley et al. 2011). | Tipp-Knopf: erster Buchstabe, dann mehr; mit Tipp gelöst zählt als „mit Mühe“. |
| **Selbsteinschätzung ist unzuverlässig**: Lernende überschätzen, was sie können (Kornell & Bjork 2008). | Objektive Prüfung beim Eintippen/Auswählen; Auswählen zählt nur als „mit Mühe“, damit „sicher“ aussagekräftig bleibt. |
| **Kontext** unterstützt Bedeutung und Gebrauch; Aufgaben mit mehr Beteiligung (*involvement load*) werden besser behalten (Webb 2008; Laufer & Hulstijn 2001). Aber: Satzaufgaben lenken ab, solange die Wortform neu ist (Barcroft 2004). | Lückentexte aus Beispielsätzen – erst ab Stufe 2, wenn die Schreibweise sitzt. |
| **Aussprache** gehört zum Wortwissen (Nation 2013); lautes Aussprechen verbessert das Behalten (*production effect*, MacLeod et al. 2010); wechselnde Stimmen helfen beim Lernen neuer Wörter (Barcroft & Sommers 2005). | Vorlesen mit wechselnden Gerätestimmen, Hörübungen; Karteikarten fordern auf, die Antwort laut zu sagen. |

**Bewusst nicht umgesetzt**
- **Zuordnungs- und Memory-Spiele, Buchstabensalat:** kaum echtes Abrufen, eher Motivation – würden die Planung
  verfälschen.
- **„Lerntypen“** (visuell, auditiv …): Für das Anpassen des Unterrichts an Lerntypen gibt es keine belastbaren
  Belege (Pashler et al. 2008).
- **Wortfelder gebündelt einführen** (alle Farben auf einmal): Neue, ähnliche Wörter stören sich gegenseitig
  (Tinkham 1993; Nation 2000). Tipp für Lehrkräfte: Listen lieber thematisch gemischt als nach Wortfeldern.
- **Spracherkennung im Browser:** In Chrome gehen die Aufnahmen an Google – an Schulen nicht vertretbar.

**Mögliche Erweiterungen**
- **Problemwörter und Eselsbrücken:** Schlüsselwort-Methode wirkt kurzfristig gut (Atkinson & Raugh 1975), wird
  aber schneller vergessen (Wang et al. 1992) – sinnvoll gezielt für oft vergessene Wörter.
- **Bilder für konkrete Nomen:** Befunde gemischt (Carpenter & Olson 2012); erfordert Bild-Upload.

**Literatur**
- Atkinson, R. C., & Raugh, M. R. (1975). An application of the mnemonic keyword method to the acquisition of a Russian vocabulary. *Journal of Experimental Psychology: Human Learning and Memory, 1*(2), 126–133.
- Barcroft, J. (2004). Effects of sentence writing in second language lexical acquisition. *Second Language Research, 20*(4), 303–334.
- Barcroft, J., & Sommers, M. S. (2005). Effects of acoustic variability on second language vocabulary learning. *Studies in Second Language Acquisition, 27*(3), 387–414.
- Bjork, R. A. (1994). Memory and metamemory considerations in the training of human beings. In J. Metcalfe & A. P. Shimamura (Hrsg.), *Metacognition: Knowing about knowing* (S. 185–205). MIT Press.
- Butler, A. C., & Roediger, H. L. (2008). Feedback enhances the positive effects and reduces the negative effects of multiple-choice testing. *Memory & Cognition, 36*(3), 604–616.
- Carpenter, S. K., & Olson, K. M. (2012). Are pictures good for learning new vocabulary in a foreign language? Only if you think they are not. *Journal of Experimental Psychology: Learning, Memory, and Cognition, 38*(1), 92–101.
- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin, 132*(3), 354–380.
- Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T., & Pashler, H. (2008). Spacing effects in learning: A temporal ridgeline of optimal retention. *Psychological Science, 19*(11), 1095–1102.
- Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). Improving students' learning with effective learning techniques. *Psychological Science in the Public Interest, 14*(1), 4–58.
- Finley, J. R., Benjamin, A. S., Hays, M. J., Bjork, R. A., & Kornell, N. (2011). Benefits of accumulating versus diminishing cues in recall. *Journal of Memory and Language, 64*(4), 289–298.
- Karpicke, J. D., & Roediger, H. L. (2008). The critical importance of retrieval for learning. *Science, 319*(5865), 966–968.
- Kornell, N. (2009). Optimising learning using flashcards: Spacing is more effective than cramming. *Applied Cognitive Psychology, 23*(9), 1297–1317.
- Kornell, N., & Bjork, R. A. (2008). Optimising self-regulated study: The benefits—and costs—of dropping flashcards. *Memory, 16*(2), 125–136.
- Laufer, B., & Hulstijn, J. (2001). Incidental vocabulary acquisition in a second language: The construct of task-induced involvement. *Applied Linguistics, 22*(1), 1–26.
- Little, J. L., Bjork, E. L., Bjork, R. A., & Angello, G. (2012). Multiple-choice tests exonerated, at least of some charges: Fostering test-induced learning and avoiding test-induced forgetting. *Psychological Science, 23*(11), 1337–1344.
- MacLeod, C. M., Gopie, N., Hourihan, K. L., Neary, K. R., & Ozubko, J. D. (2010). The production effect: Delineation of a phenomenon. *Journal of Experimental Psychology: Learning, Memory, and Cognition, 36*(3), 671–685.
- Nakata, T. (2011). Computer-assisted second language vocabulary learning in a paired-associate paradigm: A critical investigation of flashcard software. *Computer Assisted Language Learning, 24*(1), 17–38.
- Nation, I. S. P. (2000). Learning vocabulary in lexical sets: Dangers and guidelines. *TESOL Journal, 9*(2), 6–10.
- Nation, I. S. P. (2013). *Learning vocabulary in another language* (2. Aufl.). Cambridge University Press.
- Pashler, H., McDaniel, M., Rohrer, D., & Bjork, R. (2008). Learning styles: Concepts and evidence. *Psychological Science in the Public Interest, 9*(3), 105–119.
- Pyc, M. A., & Rawson, K. A. (2009). Testing the retrieval effort hypothesis: Does greater difficulty correctly recalling information lead to higher levels of memory? *Journal of Memory and Language, 60*(4), 437–447.
- Rawson, K. A., & Dunlosky, J. (2011). Optimizing schedules of retrieval practice for durable and efficient learning: How much is enough? *Journal of Experimental Psychology: General, 140*(3), 283–302.
- Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. *Psychological Science, 17*(3), 249–255.
- Tinkham, T. (1993). The effect of semantic clustering on the learning of second language vocabulary. *System, 21*(3), 371–380.
- Wang, A. Y., Thomas, M. H., & Ouellette, J. A. (1992). Keyword mnemonic and retention of second-language vocabulary words. *Journal of Educational Psychology, 84*(4), 520–528.
- Webb, S. (2008). The effects of context on incidental vocabulary learning. *Reading in a Foreign Language, 20*(2), 232–245.
- Webb, S. (2009). The effects of receptive and productive learning of word pairs on vocabulary knowledge. *RELC Journal, 40*(3), 360–376.
- Ye, J., Su, J., & Cao, Y. (2022). A stochastic shortest path algorithm for optimizing spaced repetition scheduling. In *Proceedings of the 28th ACM SIGKDD Conference on Knowledge Discovery and Data Mining* (S. 4381–4390). – Grundlage von FSRS.

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
| `TEMPLATES` | mitgelieferte Grammatik-Vorlagen unter „Geteilte Listen“ anbieten (`false` entfernt sie) | `true` |
| `SESSION_DAYS` | Dauer einer Anmeldung (Sitzungs-Cookie) | `7` |
| `REMEMBER_DAYS` | „Angemeldet bleiben“: so viele Tage nach der IServ-Anmeldung meldet sich die App selbst wieder an (0 = aus) | `30` |
| `FRAME_ANCESTORS` | Einbettung per iframe erlauben | `'self'` |

## Datenschutz

Gespeichert werden nur:
- eine pseudonyme Kennung vom Anmeldedienst (`sub`), der Anzeigename und die Gruppenmitgliedschaften
- die Wortlisten der Lehrkräfte
- je Schüler:in, Wort und Richtung: Lernstufe und Planungswerte, Anzahl richtig/falsch, Zeitpunkt der letzten Abfrage
- ein Verlauf der Antworten (Zeitpunkt, Bewertung, Übungsart) für die Auswertung
- bei Grammatik je Schüler:in und Regel der Lernstand, im Verlauf jede Aufgabe einzeln und – für die Fehlerauswertung –
  die **eingegebene falsche Antwort** beim ersten Versuch (gekürzt auf 200 Zeichen). Das ist eine Leistungsangabe wie
  die übrigen Lernstandsdaten; sie wird wie diese gelöscht (`RETENTION_DAYS`, Zurücksetzen durch die Schüler:innen).
  Die Fehlerliste der Lehrkraft zeigt nur Anzahlen je Antwort, in der Einzelansicht einer Person auch deren Antworten.
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
Es werden keine externen Dienste, CDNs oder Tracker eingebunden – auch keine KI zum Prüfen oder Erzeugen von Aufgaben.

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
  Grammatik: `grammar.js` (Aufgaben-Syntax, Prüfung, Hinweise, Rundenplanung, Bewertung – läuft im Browser, auf dem
  Server beim Speichern und in den Tests), `grammar-editor.js`, `grammar-learn.js`, `grammar-stats.js`;
  gemeinsame Bausteine: `ui.js`, `stats-ui.js`.
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
