---
name: Vokabeltrainer
description: Ein schlanker Vokabel- und Grammatiktrainer für Schulen – ruhige Karten auf hellem oder dunklem Heftpapier, ein Tintenblau als einziger Akzent.
colors:
  tintenblau: "#2f6fde"
  auf-tintenblau: "#ffffff"
  heftpapier: "#f4f6fa"
  kartenweiss: "#ffffff"
  tinte: "#1c2330"
  bleistiftgrau: "#5f6b7d"
  linienblau: "#d9dfe8"
  markierblau: "#e8eefb"
  haken-gruen: "#17703b"
  haken-flaeche: "#e3f5ea"
  rotstift-rot: "#c23b3b"
  rotstift-flaeche: "#fbe7e7"
  marker-bernstein: "#9a6200"
  tintenblau-dunkel: "#5b8ff0"
  auf-tintenblau-dunkel: "#0b1220"
  heftpapier-dunkel: "#11151c"
  karte-dunkel: "#1a2029"
  tinte-dunkel: "#e7ebf2"
  bleistift-dunkel: "#9aa5b6"
  linie-dunkel: "#2d3645"
  markierblau-dunkel: "#243149"
  haken-gruen-dunkel: "#4cc27c"
  haken-flaeche-dunkel: "#173024"
  rotstift-rot-dunkel: "#f07a7a"
  rotstift-flaeche-dunkel: "#3a1d1f"
  marker-bernstein-dunkel: "#e0a84a"
typography:
  display:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "clamp(1.4rem, 5vw, 2.2rem)"
    fontWeight: 600
    lineHeight: 1.5
  headline:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 700
    lineHeight: 1.5
  title:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.06em"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  card: "16px"
  pill: "999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  panel: "1.25rem"
components:
  button:
    backgroundColor: "{colors.kartenweiss}"
    textColor: "{colors.tinte}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "40px"
  button-hover:
    backgroundColor: "{colors.kartenweiss}"
    textColor: "{colors.tinte}"
  button-primary:
    backgroundColor: "{colors.tintenblau}"
    textColor: "{colors.auf-tintenblau}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "40px"
  button-big:
    backgroundColor: "{colors.tintenblau}"
    textColor: "{colors.auf-tintenblau}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.5rem"
    height: "48px"
  button-small:
    backgroundColor: "{colors.kartenweiss}"
    textColor: "{colors.tinte}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.6rem"
    height: "32px"
  button-right:
    backgroundColor: "{colors.haken-flaeche}"
    textColor: "{colors.haken-gruen}"
    rounded: "{rounded.md}"
  button-wrong:
    backgroundColor: "{colors.rotstift-flaeche}"
    textColor: "{colors.rotstift-rot}"
    rounded: "{rounded.md}"
  chip:
    backgroundColor: "{colors.markierblau}"
    textColor: "{colors.tinte}"
    rounded: "{rounded.pill}"
    padding: "0.1rem 0.55rem"
  card:
    backgroundColor: "{colors.kartenweiss}"
    textColor: "{colors.tinte}"
    rounded: "{rounded.xl}"
    padding: "1rem"
  panel:
    backgroundColor: "{colors.kartenweiss}"
    textColor: "{colors.tinte}"
    rounded: "{rounded.xl}"
    padding: "{spacing.panel}"
  exercise:
    backgroundColor: "{colors.kartenweiss}"
    textColor: "{colors.tinte}"
    rounded: "{rounded.card}"
    padding: "1.5rem"
  input:
    backgroundColor: "{colors.kartenweiss}"
    textColor: "{colors.tinte}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.65rem"
  choice-button:
    backgroundColor: "{colors.kartenweiss}"
    textColor: "{colors.tinte}"
    rounded: "{rounded.lg}"
    padding: "0.7rem 1rem"
    height: "56px"
  choice-button-right:
    backgroundColor: "{colors.haken-flaeche}"
    textColor: "{colors.haken-gruen}"
  choice-button-wrong:
    backgroundColor: "{colors.rotstift-flaeche}"
    textColor: "{colors.rotstift-rot}"
  segmented-active:
    backgroundColor: "{colors.tintenblau}"
    textColor: "{colors.auf-tintenblau}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 0.9rem"
  gap-input:
    backgroundColor: "{colors.markierblau}"
    textColor: "{colors.tinte}"
    rounded: "{rounded.xs}"
    padding: "0.2rem 0.4rem"
---

# Design System: Vokabeltrainer

## Overview

**Creative North Star: "Das gepflegte Schulheft"**

Die Oberfläche ist ein ordentlich geführtes Heft: heller Grund wie Heftpapier, weiße Karten mit dünner Linie, ein einziges tintenblaues Schreibgerät für alles, was Aufmerksamkeit verdient. Regeln, Beispiele und Übungen folgen einander in klarer Reihenfolge; nichts springt, nichts blinkt. Bewertet wird wie mit dem Lehrerstift – ein Haken in Grün, eine Korrektur in Rot, ein Marker in Bernstein –, nie wie in einem Spiel. Das Produkt verzichtet bewusst auf Punkte, Serien, Konfetti, Ranglisten und Zeitdruck; das System tut es ebenso.

Die Oberfläche richtet sich an Kinder und Jugendliche ebenso wie an Lehrkräfte, die zwischen zwei Stunden Listen pflegen. Deshalb ist der Ton ruhig, sachlich und ermutigend: kurze deutsche Sätze („Richtig!“, „Fast!“, „Weiter üben!“), große Druckflächen auf dem iPad, der Stoff steht im Mittelpunkt, nicht das Werkzeug. Dichte entsteht nur dort, wo Lehrkräfte sie brauchen (Editor, Auswertung); die Lernansicht bleibt eine einzige Karte pro Aufgabe. Schriften kommen vom Gerät, nichts wird von fremden Servern geladen.

**Key Characteristics:**
- Ein Akzent (Tintenblau), Bewertung über Farbe und Rand statt über Schatten.
- Helles und dunkles Heftpapier sind gleichwertig; beide folgen dem Gerät, per Knopf überschreibbar.
- Weiße Karten mit 1-px-Linie und Haarschatten, großzügige Rundung (12–16 px), Auswahl-Schalter und Chips vollrund.
- Eine Spalte, schmal (640 px) beim Lernen, breit (1100 px) beim Verwalten.
- System-Schrift, eine Schrift in drei Größen-Rollen; Fremdsprachen bekommen `lang`.
- Bewegung nur als Rückmeldung (Fortschrittsbalken, Karte umdrehen) und abschaltbar.

## Colors

Zurückhaltende Palette aus kühlem Heftpapier, weißen Karten und einem einzigen Blau; Grün, Rot und Bernstein tauchen nur als Bewertung auf. Jede Farbe gibt es in zwei Fassungen (hell/dunkel) mit gleicher Rolle; die dunklen Werte stehen in der Kopfzeile mit dem Zusatz „-dunkel“.

### Primary
- **Tintenblau** (#2f6fde hell, #5b8ff0 dunkel): der einzige Akzent. Haupt-Knopf, Logo-Kachel, Links, Fortschritt der Lernleiter, ausgewählter Schalter, Fokusring (45 % Deckkraft), hervorgehobene Formen im Satz (`.form`), Lücken-Unterstrich. Text darauf: Weiß (#ffffff) bzw. fast Schwarz (#0b1220) im Dunkeln.

### Secondary
- **Haken-Grün** (#17703b hell, #4cc27c dunkel) mit **Haken-Fläche** (#e3f5ea / #173024): richtig beantwortet, sicher gelernt (Fortschrittsbalken), „Neue Regel“-Hinweis, freigegebene Liste.
- **Rotstift-Rot** (#c23b3b hell, #f07a7a dunkel) mit **Rotstift-Fläche** (#fbe7e7 / #3a1d1f): falsch, Fehlerstelle im Satz, Löschen, Pflichtfehler im Editor.
- **Marker-Bernstein** (#9a6200 hell, #e0a84a dunkel), als 18 %-Tönung hinterlegt: Hinweis, „heute fällig“, Offline-Anzeige, „Fast!“, Wiederholung.

### Neutral
- **Heftpapier** (#f4f6fa hell, #11151c dunkel): Seitengrund.
- **Kartenweiß** (#ffffff hell, #1a2029 dunkel): Karten, Panels, Eingabefelder, Schalter.
- **Tinte** (#1c2330 hell, #e7ebf2 dunkel): Fließtext und Überschriften.
- **Bleistiftgrau** (#5f6b7d hell, #9aa5b6 dunkel): Nebentext, Beschriftungen, Tabellenköpfe.
- **Linienblau** (#d9dfe8 hell, #2d3645 dunkel): Ränder, Trennlinien, leere Fortschrittsbalken.
- **Markierblau** (#e8eefb hell, #243149 dunkel): Chips, Merksatz-Fläche, Lücken-Hintergrund, Tastenkürzel-Kacheln.

### Named Rules
**The One Ink Rule.** Tintenblau ist der einzige Akzent und trägt nur Handlung und Fokus: Knopf, Link, Auswahl, Fortschritt. Es erscheint auf höchstens einem Zehntel einer Seite; Grün, Rot und Bernstein gehören ausschließlich der Bewertung.

**The Red Pencil Rule.** Rotstift-Rot markiert, was falsch ist – nie Dekoration und nie Warnung vor etwas Harmlosem. Wo etwas nur bald fällig oder nützlich ist, gilt Marker-Bernstein.

**The Tint-Not-Shade Rule.** Zustände entstehen aus derselben Farbe als Fläche (Haken-Fläche, Rotstift-Fläche, 18 %-Bernstein), nicht aus dunkleren Abstufungen oder Verläufen.

## Typography

**Display Font:** System-Schrift (`system-ui`, `-apple-system`, „Segoe UI“, Roboto, sans-serif)
**Body Font:** dieselbe System-Schrift
**Label/Mono Font:** `ui-monospace`, SFMono-Regular, Menlo, Consolas – nur für Tipp-Muster („t _ g _“), den KI-Prompt und die Aufgaben-Syntax im Grammatik-Editor

**Character:** Eine einzige Gerätestimme, die auf jedem Schul-iPad, Chromebook und Handy vertraut aussieht und keine Schrift von einem fremden Server braucht. Hierarchie entsteht aus Größe und Gewicht, nicht aus zweiter Schrift.

### Hierarchy
- **Display** (600, `clamp(1.4rem, 5vw, 2.2rem)`, 1.5): das abgefragte Wort auf der Lernkarte; bricht an jeder Stelle um.
- **Headline** (700, 1.6rem, 1.5; 1.35rem unter 640 px): Seitentitel („Meine Listen“, Listentitel, Ergebnis).
- **Title** (700, 1.15rem / 1.05rem, 1.5): Abschnitte und Kartentitel.
- **Body** (400, 16 px, 1.5): Fließtext, Eingaben (Eingabefeld beim Antworten 1.2rem), Sätze in Übungen (`clamp(1.15rem, 3.5vw, 1.5rem)`).
- **Label** (400, 0.8rem, Laufweite 0.06em, Großbuchstaben): Sprachkennzeichnung über dem Wort („ENGLISCH“); Nebentext und Tabellenköpfe 0.875rem bzw. 0.85rem in Bleistiftgrau.

### Zwischenstufen
Kleine, wiederkehrende Abstufungen innerhalb der Rollen – sie sind Teil des Systems und keine Ausreißer:
- **1.1rem:** Marke, Tipp-Muster, Hören-Knopf, Lösungszeile.
- **1.05rem:** großer Knopf, Auswahl-Antwort, Diff-Zeile, Satzteil, Darstellungs-Knopf.
- **0.95rem:** Notiz, Beispielsatz, Aufgabenanweisung, Beispiele der Regelkarte.
- **1.3rem** Punktzahl, **1.5rem** Kennzahl-Wert, **0.85rem** Syntax-Code im Editor.
- **Icon-Zeichen** (🔊, ✕, Darstellung): 1.15–1.3rem, folgen der Symbolgröße, nicht der Textrolle.
- **Diagramm-Beschriftung** (SVG): 10 px und 11 px.

### Named Rules
**The One Voice Rule.** Eine Schrift für alles. Monospace nur, wo Zeichen gezählt oder Syntax gelesen wird; keine Webfonts, keine Icon-Fonts.

**The Mark-The-Form Rule.** Die gesuchte Form im Satz ist fett und tintenblau (`.form`); der Rest des Satzes bleibt ruhig. So lernt das Auge, worauf es ankommt.

## Layout

Eine Spalte auf Heftpapier, zentriert. Verwaltungsseiten (Startseite, Editor, Auswertung) laufen bis 1100 px Breite; Lernen, Einstellungen vor der Runde und Ergebnis sind auf 640 px begrenzt, damit die Aufgabe im Blick bleibt. Die Startseite ordnet Karten in einem Raster (Mindestbreite 290 px, Abstand 1 rem); Formulare nutzen zwei gleich breite Spalten, die unter 640 px zu einer werden. Abstände folgen einem Rhythmus aus 0.25 / 0.5 / 0.75 / 1 / 1.25 / 1.5 rem; Panels haben 1.25 rem Innenabstand, Karten 1 rem, Übungskarten 1.5 rem.

Die Kopfzeile (Logo, Status, Darstellung, Name, Abmelden) klebt oben; die Speichern-Leiste im Editor klebt unten, die Werkzeugleiste des Editors direkt unter der Kopfzeile. Unter 640 px werden Tabellen-Nebenspalten ausgeblendet, Auswahlraster einspaltig, Karteikarten niedriger (230 px). Touch-Ziele: Haupt-Knöpfe 40–48 px hoch, Auswahl-Antworten 56 px, Satzteile und Vorlese-Knopf mindestens 44 px. Auf Touch-Geräten (`pointer: coarse`) wachsen auch kleine Knöpfe und Sonderzeichen-Tasten auf 44 px; am Rechner bleiben sie mit 32 bzw. 40 px dicht.

## Elevation & Depth

Flach mit Haarschatten. Karten und Panels liegen durch eine 1-px-Linie und einen kaum sichtbaren Schatten auf dem Heftpapier; Hervorhebung läuft über Farbe und Rand, nicht über Höhe. Im Dunkeln entfällt der weiche Teil des Schattens (nur 1 px, 40 % Schwarz). Einzige echte Höhe: die Kopfzeile (klebt mit Linie darunter), die Speichern-Leiste und die Toast-Meldung.

### Shadow Vocabulary
- **Haarschatten hell** (`box-shadow: 0 1px 3px rgb(20 30 50 / 8%), 0 4px 16px rgb(20 30 50 / 6%)`): Karten, Panels, Übungskarten, Toast.
- **Haarschatten dunkel** (`box-shadow: 0 1px 3px rgb(0 0 0 / 40%)`): dieselben Flächen im dunklen Modus.
- **Fokusring** (`outline: 3px solid color-mix(in srgb, var(--primary) 45%, transparent); outline-offset: 2px`): jedes bedienbare Element bei Tastatur-Fokus.

### Named Rules
**The Border-Before-Shadow Rule.** Eine Fläche hebt sich zuerst durch ihre Linie ab, erst dann durch den Haarschatten. Kein Element bekommt einen stärkeren Schatten, um „wichtiger“ zu wirken.

**The Answer-Colors-The-Card Rule.** Nach einer Antwort färbt sich der Rand der Übungskarte grün, rot oder bernsteinfarben (2 px); Eingabe- und Antwortfelder nehmen die zugehörige Fläche an. Das ist die gesamte Belohnungs- und Fehlermechanik.

## Shapes

Weiche, aber ruhige Rundung, die mit der Bedeutung wächst: kleinste Details 4 px (Fokus-Umriss der Sortier-Köpfe, obere Ecken der Lücke im Satz), kleine Steuerelemente 6–8 px (Knöpfe, Felder, Sonderzeichen-Tasten, Logo-Kachel), Auswahl-Antworten und Optionsfelder 10 px, Karten und Panels 12 px, Übungs- und Karteikarten 16 px, Chips, Segment-Schalter und Fortschrittsbalken vollrund (999 px). Rahmen sind durchgehend 1 px in Linienblau; nur die Antwort-Zustände und der gestrichelte Platzhalter im Satzbau-Feld nutzen 2 px. Die Karteikarte dreht sich in 3D um die senkrechte Achse (0.45 s); bei reduzierter Bewegung entfällt die Drehanimation.

## Components

### Buttons
- **Shape:** sanft gerundet (8 px), Mindesthöhe 40 px; `big` 48 px, `small` 32 px.
- **Default:** Kartenweiß mit 1-px-Linie und Tinte als Text; beim Hover färbt sich nur die Linie tintenblau.
- **Primary:** Tintenblau gefüllt, weißer Text; Hover hellt um 8 % auf (`brightness(1.08)`).
- **Ghost / Danger:** Ghost transparent; Danger behält den Rand und färbt Text (und beim Hover den Rand) in Rotstift-Rot.
- **Bewertung:** Richtig/Falsch/Leicht sind getönte Flächen in Grün, Rot bzw. Markierblau mit Rand in der Textfarbe.
- **Focus / Disabled:** Fokusring wie oben; deaktiviert mit 60 % Deckkraft.

### Chips
- **Style:** vollrund, Markierblau-Fläche, Text in Tinte, 0.8rem; Sonderformen: Bernstein (fällig/offline), Grün (freigegeben/neu), gestrichelt (nicht gesetzt), Tintenblau-Tönung (Grammatik).
- **State:** reine Kennzeichnung, nie bedienbar.

### Cards / Containers
- **Corner Style:** 12 px (Listenkarten, Panels), 16 px (Übungs- und Karteikarten).
- **Background:** Kartenweiß bzw. Karte-dunkel; Hinweisflächen in Markierblau oder Seitengrund.
- **Shadow Strategy:** Haarschatten, siehe Elevation.
- **Border:** 1 px Linienblau; Zustände 2 px in Bewertungsfarbe.
- **Internal Padding:** 1 rem (Karte), 1.25 rem (Panel), 1.5 rem (Übungskarte).

### Inputs / Fields
- **Style:** 1-px-Linie, Kartenweiß, 8 px Rundung, Schrift erbt; Antwortfeld beim Lernen größer (1.2rem, Innenabstand .7rem .9rem).
- **Focus:** Fokusring in Tintenblau.
- **Error / Disabled:** Falsch färbt das Feld in Rotstift-Fläche; nach der Antwort ist das Feld schreibgeschützt und grün oder rot getönt.
- **Lücke im Satz** (`gap-input`): unterstrichenes Inline-Feld in Markierblau, Breite nach der Länge der Lösung, Zustandsfarbe am Unterstrich.

### Navigation
- **Style:** Kopfzeile mit Logo-Kachel „Aa“ (32 px, Tintenblau, 8 px Rundung) und Name links, rechts Offline-/Warte-Anzeige, Darstellungs-Knopf (☀/🌙/🌓) und Person mit Abmelden. Kein Menü; jede Seite hat oben rechts einen „Zurück“-Knopf.
- **Mobile:** Name der Person bricht um, der Rollen-Chip entfällt.

### Auswahl-Schalter (Segmented)
Vollrunde Knöpfe in einer Zeile, aktiv: Tintenblau gefüllt. Für Modus, Richtung, Anzahl, Ton, Reihenfolge; `role="radiogroup"`.

### Auswahl-Antwort (Choice)
Große Kachel (56 px, 10 px Rundung) mit Tastenkürzel-Kachel links (1–4, Markierblau). Nach der Antwort: richtige Kachel grün getönt und fett, falsche rot getönt, übrige auf 65 % gedimmt.

### Übungskarte
Die Aufgabe ist immer eine Karte (16 px Rundung, 2-px-Rand, 1.5 rem Innenabstand) mit Sprachlabel, dem Wort oder Satz groß, Antwortfeld, Sonderzeichen-Leiste und Rückmeldung darunter. Bei Grammatik kommt oben eine Zeile mit Aufgabentyp-Chip, Regeltitel und „📖 Regel“; Fehlerstellen sind rot wellig unterstrichen (`word-wrong`), korrigierte Stellen grün und fett (`word-fix`).

### Auswertung
Kennzahl-Kacheln (Linie, 10 px), Diagramme als Linie und Säulen in Tintenblau ohne Füllverlauf, sortierbare Tabellen mit Fortschrittsbalken in Haken-Grün und Stufen-Chips (neu → gefestigt) in zunehmend dichter Tintenblau-Tönung.

### Editor (Lehrkräfte)
Dichte Formulare in Panels; Werkzeugleiste klebt unter der Kopfzeile; Grammatik-Regeln sind aufklappbare Panels mit Aufgaben-Textfeld in Monospace, Live-Vorschau und zeilengenauen Fehlern in Rotstift-Rot.

## Do's and Don'ts

### Do:
- **Do** Farben und Maße über die Variablen (`--primary`, `--surface`, `--border`, `--right`, `--wrong`, `--warn`, `--chip`, `--radius`, `--shadow`) setzen, damit hell und dunkel identisch funktionieren; beide Blöcke bleiben gleich.
- **Do** Zustandsfarben nur auf die Kopfzeile der Rückmeldung („Richtig!“, „Leider falsch.“) legen, nie auf Hinweise oder den Merksatz; Text auf Zustandsflächen braucht mindestens 4,5 : 1.
- **Do** Bewertung über Rand und Fläche zeigen (2 px Rand in Haken-Grün, Rotstift-Rot oder Bernstein, dazu die getönte Fläche) – Farbe nie als einziges Zeichen: immer auch Text („Richtig!“, „Leider falsch.“) und Symbol.
- **Do** Breite und Dichte an der Aufgabe ausrichten: 640 px beim Lernen, 1100 px beim Verwalten.
- **Do** jedes Element – auch Links und Zusammenfassungen – mit Fokusring, Tastaturbedienung und `aria`-Beschriftung ausstatten und den Fokus nach dem Neuzeichnen einer Ansicht (z. B. Satzbau) an eine sinnvolle Stelle setzen; Fremdsprachentext mit `lang` auszeichnen; Bewegung bei `prefers-reduced-motion` abschalten.
- **Do** Breiten und Farben per CSSOM setzen (`element.style.width`), nicht per `style`-Attribut – die Content-Security-Policy erlaubt keine Inline-Styles.
- **Do** kurze, direkte deutsche Sätze schreiben und gendergerecht mit Doppelpunkt („Schüler:innen“).

### Don't:
- **Don't** Gamification einführen: keine Punkte, Serien, Abzeichen, Konfetti, Ranglisten, Zeitdruck (das Produkt verzichtet darauf bewusst; Tempo-Runden sind ausgeschlossen).
- **Don't** einen zweiten Akzent neben Tintenblau einführen; Grün, Rot, Bernstein bleiben der Bewertung vorbehalten.
- **Don't** stärkere Schatten, Verläufe, Glas-Effekte oder farbige Seitenstreifen an Karten nutzen, um etwas wichtiger zu machen.
- **Don't** Schriften, Icons, Skripte oder Bilder von fremden Servern laden (Datenschutz-Zusage, CSP `default-src 'self'`).
- **Don't** Emojis als Hauptsymbole für Bewertung einsetzen; sie sind Zusatz zu Text (🔊, 📖, 🔔, ✓/✗ an Knöpfen).
- **Don't** Fehler nur rot färben: falsche Stellen werden markiert und erklärt, nicht bestraft.
