---
name: Vokabeltrainer
description: Ein schlanker Vokabel- und Grammatiktrainer für Schulen – weiche Karten auf warmem Sand, ein Oliv aus dem Schullogo als Grundton, ein Terrakotta als einziger Akzent.
colors:
  terrakotta: "#9c4a27"
  auf-terrakotta: "#fbf8f1"
  sand: "#efeadf"
  leinen: "#fbf8f1"
  waldtinte: "#2a3322"
  salbeigrau: "#5a6350"
  sandlinie: "#dcd5c5"
  salbei: "#e4ebbd"
  moos: "#55671f"
  auf-moos: "#fbf8f1"
  moos-hell: "#e4ebbd"
  wachstum-gruen: "#3f6b2c"
  wachstum-flaeche: "#e1ecc6"
  ton-rot: "#9e3b3b"
  ton-rot-flaeche: "#f2dcdc"
  ocker: "#8a5a14"
  terrakotta-dunkel: "#e39a74"
  auf-terrakotta-dunkel: "#1c140f"
  sand-dunkel: "#171b12"
  leinen-dunkel: "#21271a"
  waldtinte-dunkel: "#eceedc"
  salbeigrau-dunkel: "#adb59b"
  sandlinie-dunkel: "#394029"
  salbei-dunkel: "#2f3822"
  moos-dunkel: "#cddb92"
  moos-flaeche-dunkel: "#4a5c1b"
  wachstum-gruen-dunkel: "#a3d28a"
  wachstum-flaeche-dunkel: "#25371c"
  ton-rot-dunkel: "#eb9090"
  ton-rot-flaeche-dunkel: "#3e2323"
  ocker-dunkel: "#e2b25a"
typography:
  display:
    fontFamily: "Fraunces, Georgia, \"Times New Roman\", serif"
    fontSize: "clamp(1.6rem, 5vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Fraunces, Georgia, \"Times New Roman\", serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Fraunces, Georgia, \"Times New Roman\", serif"
    fontSize: "1.4rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "\"Nunito Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "\"Nunito Sans\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.08em"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  xs: "4px"
  sm: "14px"
  md: "18px"
  lg: "24px"
  xl: "28px"
  card: "32px"
  pill: "999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  panel: "1.75rem"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.moos}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 1.2rem"
    height: "40px"
  button-hover:
    textColor: "{colors.terrakotta}"
  button-primary:
    backgroundColor: "{colors.terrakotta}"
    textColor: "{colors.auf-terrakotta}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 1.2rem"
    height: "40px"
  button-big:
    backgroundColor: "{colors.terrakotta}"
    textColor: "{colors.auf-terrakotta}"
    rounded: "{rounded.pill}"
    padding: "0.75rem 1.5rem"
    height: "48px"
  button-small:
    backgroundColor: "transparent"
    textColor: "{colors.moos}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.6rem"
    height: "32px"
  button-right:
    backgroundColor: "{colors.wachstum-flaeche}"
    textColor: "{colors.wachstum-gruen}"
    rounded: "{rounded.pill}"
  button-wrong:
    backgroundColor: "{colors.ton-rot-flaeche}"
    textColor: "{colors.ton-rot}"
    rounded: "{rounded.pill}"
  chip:
    backgroundColor: "{colors.salbei}"
    textColor: "{colors.moos}"
    rounded: "{rounded.pill}"
    padding: "0.15rem 0.7rem"
  card:
    backgroundColor: "{colors.leinen}"
    textColor: "{colors.waldtinte}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
  panel:
    backgroundColor: "{colors.leinen}"
    textColor: "{colors.waldtinte}"
    rounded: "{rounded.lg}"
    padding: "{spacing.panel}"
  hero:
    backgroundColor: "{colors.moos}"
    textColor: "{colors.auf-moos}"
    rounded: "{rounded.xl}"
    padding: "2rem"
  exercise:
    backgroundColor: "{colors.leinen}"
    textColor: "{colors.waldtinte}"
    rounded: "{rounded.card}"
    padding: "2rem"
  input:
    backgroundColor: "{colors.leinen}"
    textColor: "{colors.waldtinte}"
    rounded: "{rounded.sm}"
    padding: "0.55rem 0.8rem"
  choice-button:
    backgroundColor: "{colors.leinen}"
    textColor: "{colors.waldtinte}"
    rounded: "{rounded.md}"
    padding: "0.85rem 1rem"
    height: "56px"
  choice-button-right:
    backgroundColor: "{colors.wachstum-flaeche}"
    textColor: "{colors.wachstum-gruen}"
  choice-button-wrong:
    backgroundColor: "{colors.ton-rot-flaeche}"
    textColor: "{colors.ton-rot}"
  segmented-active:
    backgroundColor: "{colors.terrakotta}"
    textColor: "{colors.auf-terrakotta}"
    rounded: "{rounded.pill}"
    padding: "0.55rem 1.1rem"
  gap-input:
    backgroundColor: "{colors.salbei}"
    textColor: "{colors.waldtinte}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.5rem"
---

# Design System: Vokabeltrainer

## Overview

**Creative North Star: „Der Lerngarten“**

Die Oberfläche ist ein ruhiger, warmer Ort zum Üben: Sandfarbener Grund wie ungebleichtes Papier, weiche Leinen-Karten ohne Rahmen, ein tiefes Oliv für das, was heute zählt, und ein einziges Terrakotta für jede Handlung. Überschriften und Lernwörter stehen in einer warmen Serifenschrift, der übrige Text in einer freundlichen, klaren Grotesk. Das wirkt eher wie ein gut gestaltetes Schulbuch als wie eine Software-Oberfläche. Bewertet wird sachlich – ein sattes Grün für richtig, ein Ton-Rot für falsch, ein Ocker für Hinweise –, nie wie in einem Spiel. Das Produkt verzichtet bewusst auf Punkte, Level, Ranglisten, Konfetti, Vergleiche mit anderen und Zeitdruck; das System tut es ebenso. Zwei Ausnahmen sind gewollt und bleiben leise: die Lernserie (ein Punkt pro erledigtem Tag) und Abzeichen fürs Können.

Die Oberfläche richtet sich an Kinder und Jugendliche ebenso wie an Lehrkräfte, die zwischen zwei Stunden Listen pflegen. Der Ton bleibt ruhig, sachlich und ermutigend: kurze deutsche Sätze („Richtig!“, „Fast!“, „Weiter üben!“), große Druckflächen auf dem iPad, der Stoff steht im Mittelpunkt. Dichte entsteht nur dort, wo Lehrkräfte sie brauchen (Editor, Auswertung); die Lernansicht bleibt eine einzige Karte pro Aufgabe. Alle Schriften liegen auf dem eigenen Server (`/fonts`), nichts wird von Fremdservern geladen.

**Key Characteristics:**
- Ein Akzent (Terrakotta) für Handlung; Oliv als Grundton für Flächen mit Gewicht; Bewertung über Farbe, Fläche und Text.
- Warmer Sand und dunkler Wald sind gleichwertig; beide folgen dem Gerät, per Knopf überschreibbar.
- Karten ohne Rahmen, mit weichem Schatten und großer Rundung (24–32 px); Knöpfe, Schalter und Chips vollrund.
- Serif (Fraunces) für Überschriften, Lernwörter, Sätze und Marke; Grotesk (Nunito Sans) für Text und Bedienung.
- Eine Spalte, schmal (640 px) beim Lernen, breit (1100 px) beim Verwalten.
- Symbole sind schlichte Linien-Icons (SVG, `currentColor`), keine Emojis.
- Bewegung nur als Rückmeldung (Fortschrittsbalken, Karte umdrehen) und abschaltbar.

## Colors

Warme, erdige Palette: Sand, Leinen und Moos tragen die Fläche, Terrakotta die Handlung; Grün, Ton-Rot und Ocker tauchen nur als Bewertung auf. Jede Farbe gibt es in zwei Fassungen (hell/dunkel) mit gleicher Rolle; die dunklen Werte tragen den Zusatz „-dunkel“.

### Primary
- **Terrakotta** (#9c4a27 hell, #e39a74 dunkel): der einzige Akzent. Haupt-Knopf, Logo-Punkt, Links, ausgewählter Schalter, erreichte Wochenpunkte und Abzeichen, Fokusring (45 % Deckkraft). Text darauf: Leinen (#fbf8f1) bzw. fast Schwarz (#1c140f) im Dunkeln.

### Secondary
- **Moos** (#55671f hell; im Dunkeln als Fläche #4a5c1b, als Text #cddb92): Grundton für Gewicht. „Heute fällig“-Fläche, Merksatz einer Regel, Knopf-Rand und -Text, Marke, Chip-Text. Text auf Oliv-Flächen: Leinen bzw. #f3f5e2.
- **Wachstum-Grün** (#3f6b2c hell, #a3d28a dunkel) mit **Wachstum-Fläche** (#e1ecc6 / #25371c): richtig beantwortet, sicher gelernt, „Neue Regel“-Hinweis, freigegebene Liste.
- **Ton-Rot** (#9e3b3b hell, #eb9090 dunkel) mit **Ton-Rot-Fläche** (#f2dcdc / #3e2323): falsch, Fehlerstelle im Satz, Löschen, Pflichtfehler im Editor.
- **Ocker** (#8a5a14 hell, #e2b25a dunkel), als 18 %-Tönung hinterlegt: Hinweis, Offline-Anzeige, „Fast!“, Wiederholung.

### Neutral
- **Sand** (#efeadf hell, #171b12 dunkel): Seitengrund.
- **Leinen** (#fbf8f1 hell, #21271a dunkel): Karten, Panels, Eingabefelder.
- **Waldtinte** (#2a3322 hell, #eceedc dunkel): Fließtext und Überschriften.
- **Salbeigrau** (#5a6350 hell, #adb59b dunkel): Nebentext, Beschriftungen, Tabellenköpfe (mindestens 4,5 : 1).
- **Sandlinie** (#dcd5c5 hell, #394029 dunkel): Feldränder, Trennlinien.
- **Salbei** (#e4ebbd hell, #2f3822 dunkel): Chips, Lücken-Hintergrund, gesuchte Form im Satz, Tastenkürzel-Kacheln.

### Named Rules
**The One Clay Rule.** Terrakotta ist der einzige Akzent und trägt Handlung und Fokus (Knopf, Link, Auswahl) sowie den Punkt aus dem App-Symbol: Ein gefüllter Terrakotta-Punkt heißt „erreicht“ (Wochenpunkt, Abzeichen). Es erscheint auf höchstens einem Zehntel einer Seite; Grün, Ton-Rot und Ocker gehören ausschließlich der Bewertung, Moos dem Gewicht.

**The Clay-Is-Not-Error Rule.** Terrakotta und Ton-Rot liegen farblich nah beieinander. Deshalb markiert Ton-Rot nur, was falsch ist – immer mit Text und Fläche – und Terrakotta nie einen Fehler.

**The Tint-Not-Shade Rule.** Zustände entstehen aus derselben Farbe als Fläche (Wachstum-Fläche, Ton-Rot-Fläche, 18 %-Ocker), nicht aus dunkleren Abstufungen oder Verläufen.

## Typography

**Display Font:** Fraunces (variabel, 600) – Überschriften, Lernwörter, Sätze in Übungen, Marke, gesuchte Form im Satz
**Body Font:** Nunito Sans (variabel) – Text, Knöpfe, Felder, Tabellen
**Label/Mono Font:** `ui-monospace`, SFMono-Regular, Menlo, Consolas – nur für Tipp-Muster („t _ g _“), den KI-Prompt und die Aufgaben-Syntax im Grammatik-Editor

**Character:** Eine warme Serifenschrift gibt dem Lernstoff Gewicht und Ruhe, die Grotesk hält die Bedienung klar. Beide Schriften (SIL Open Font License) liegen unter `public/fonts/` mit ihren Lizenztexten, sind im Service Worker vorgehalten und laufen offline; `font-display: swap` verhindert leere Texte beim Laden. `font-variant-emoji: text` verhindert, dass Pfeile als Emoji erscheinen.

### Hierarchy
- **Display** (Fraunces 600, `clamp(1.6rem, 5vw, 2.5rem)`, 1.2): das abgefragte Wort auf der Lernkarte; bricht an jeder Stelle um.
- **Headline** (Fraunces 600, 2rem, 1.2; kleiner unter 640 px): Seitentitel („Meine Listen“, Listentitel, Ergebnis).
- **Title** (Fraunces 600, 1.4rem / 1.15rem, 1.25): Abschnitte und Kartentitel.
- **Body** (Nunito Sans 400, 17 px, 1.55): Fließtext, Eingaben (Antwortfeld beim Lernen 1.2rem), Sätze in Übungen (`clamp(1.15rem, 3.5vw, 1.5rem)`).
- **Label** (Nunito Sans 700, 0.8rem, Laufweite 0.08em, Großbuchstaben): Sprachkennzeichnung über dem Wort („ENGLISCH“); Nebentext und Tabellenköpfe 0.875rem bzw. 0.85rem in Salbeigrau.

### Zwischenstufen
Kleine, wiederkehrende Abstufungen innerhalb der Rollen – sie sind Teil des Systems und keine Ausreißer:
- **1.4rem:** Marke in der Kopfzeile.
- **1.1rem:** Tipp-Muster, Lösungszeile.
- **1.05rem:** großer Knopf, Auswahl-Antwort, Diff-Zeile, Satzteil, Darstellungs-Knopf.
- **0.95rem:** Notiz, Beispielsatz, Aufgabenanweisung, Beispiele der Regelkarte.
- **1.3rem** Punktzahl, **1.5rem** Kennzahl-Wert, **0.85rem** Syntax-Code im Editor.
- **Icon** (SVG, `.icon-svg`): 1.15em, folgt der Textgröße; Linienstärke 1.75.
- **Diagramm-Beschriftung** (SVG): 10 px und 11 px.

### Named Rules
**The Two Voices Rule.** Genau zwei Schriften: Serif für Stoff und Überschrift, Grotesk für alles Bedienbare. Monospace nur, wo Zeichen gezählt oder Syntax gelesen wird; keine Fremdserver, keine Icon-Fonts.

**The Mark-The-Form Rule.** Die gesuchte Form im Satz ist fett, moosgrün und auf Salbei hinterlegt (`.form`, wie mit einem Textmarker); der Rest des Satzes bleibt ruhig. So lernt das Auge, worauf es ankommt.

## Layout

Eine Spalte auf Sand, zentriert. Verwaltungsseiten (Startseite, Editor, Auswertung) laufen bis 1100 px Breite; Lernen, Einstellungen vor der Runde und Ergebnis sind auf 640 px begrenzt, damit die Aufgabe im Blick bleibt. Die Startseite ordnet Karten in einem Raster (Mindestbreite 310 px, Abstand 1.25 rem); Formulare nutzen zwei gleich breite Spalten, die unter 640 px zu einer werden. Abstände folgen einem Rhythmus aus 0.25 / 0.5 / 0.75 / 1 / 1.25 / 1.5 / 2 rem; Panels haben 1.75 rem Innenabstand, Karten 1.5 rem, Übungskarten und Hero 2 rem.

Die Kopfzeile (Logo-Punkt und Marke, Status, Darstellung, Name, Abmelden) klebt oben, ohne Linie, in einem leicht durchscheinenden Sand; die Speichern-Leiste im Editor klebt unten, die Werkzeugleiste des Editors direkt unter der Kopfzeile. Unter 640 px werden Tabellen-Nebenspalten ausgeblendet, Auswahlraster einspaltig, Karteikarten niedriger (230 px). Touch-Ziele: Haupt-Knöpfe 40–48 px hoch, Auswahl-Antworten 56 px, Satzteile und Vorlese-Knopf mindestens 44 px. Auf Touch-Geräten (`pointer: coarse`) wachsen auch kleine Knöpfe und Sonderzeichen-Tasten auf 44 px; am Rechner bleiben sie mit 32 bzw. 40 px dicht.

## Elevation & Depth

Weich und flach. Karten und Panels haben keinen Rand; sie heben sich durch die hellere Leinen-Farbe und einen sehr weichen, zweistufigen Schatten vom Sand ab. Hervorhebung läuft über Farbe und Fläche (das Oliv-Hero), nicht über Höhe. Im Dunkeln entfällt der weiche Teil des Schattens (nur 1 px, 40 % Schwarz). Einzige echte Höhe: die Kopfzeile (blur), die Speichern-Leiste und die Toast-Meldung.

### Shadow Vocabulary
- **Weicher Schatten hell** (`box-shadow: 0 1px 2px rgb(48 56 28 / 6%), 0 10px 28px rgb(48 56 28 / 6%)`): Karten, Panels, Übungskarten, Toast.
- **Schatten dunkel** (`box-shadow: 0 1px 2px rgb(0 0 0 / 40%)`): dieselben Flächen im dunklen Modus.
- **Fokusring** (`outline: 3px solid color-mix(in srgb, var(--primary) 45%, transparent); outline-offset: 2px`): jedes bedienbare Element bei Tastatur-Fokus.

### Named Rules
**The Soft-Not-Heavy Rule.** Eine Fläche hebt sich durch Farbe und den einen weichen Schatten ab. Kein Element bekommt einen stärkeren Schatten, einen Rahmen oder einen Verlauf, um „wichtiger“ zu wirken – Gewicht entsteht durch die Oliv-Fläche.

**The Answer-Colors-The-Card Rule.** Nach einer Antwort färbt sich der Rand der Übungskarte (2 px, vorher transparent) grün, rot oder ockerfarben; Eingabe- und Antwortfelder nehmen die zugehörige Fläche an. Das ist die Rückmeldung zu einer einzelnen Antwort; darüber hinaus gibt es nur die Lernserie und die Abzeichen (siehe The Quiet Reward Rule).

**The Quiet Reward Rule.** Lernserie und Abzeichen bleiben leise und privat: ein Satz, ein Punkt, eine Meldung – nie ein Dialog, Ton, Konfetti oder ein Zähler, den andere sehen. Sie hängen am Können (sicher gewusst, Tagesziel erreicht), nicht an Menge oder Anmelden; ein verpasster Tag wird abgefedert und nie als Verlust inszeniert. Verborgene Abzeichen verraten nichts, bis man sie hat.

## Shapes

Große, weiche Rundung, die mit der Bedeutung wächst: kleinste Details 4 px (Fokus-Umriss der Sortier-Köpfe), Felder, Lücken und Sonderzeichen-Tasten 12–14 px, Auswahl-Antworten und Regel-Panels 18 px, Karten und Panels 24 px, Hero 28 px, Übungs- und Karteikarten 32 px; Knöpfe, Chips, Segment-Schalter, Logo-Punkt und Fortschrittsbalken vollrund (999 px). Feldränder sind 1.5 px in Sandlinie; die Antwort-Zustände nutzen 2 px, ebenso der gestrichelte Platzhalter im Satzbau-Feld. Die Karteikarte dreht sich in 3D um die senkrechte Achse (0.45 s); bei reduzierter Bewegung entfällt die Drehanimation.

## Components

### Buttons
- **Shape:** vollrunde Pille, Mindesthöhe 40 px; `big` 48 px, `small` 32 px.
- **Default:** transparent mit 1.5-px-Rand und Text in Moos, fett; beim Hover färben sich Rand und Text terrakotta.
- **Primary:** Terrakotta gefüllt, Leinen-Text; Hover hellt um 8 % auf (`brightness(1.08)`).
- **Ghost / Danger:** Ghost transparent; Danger färbt Text und Rand in Ton-Rot.
- **Bewertung:** Richtig/Falsch/Leicht sind getönte Flächen in Grün, Ton-Rot bzw. Salbei mit Rand in der Textfarbe.
- **Focus / Disabled:** Fokusring wie oben; deaktiviert mit 60 % Deckkraft.

### Chips
- **Style:** vollrund, Salbei-Fläche, Text in Moos, fett, 0.8rem; Sonderformen: Ocker (fällig/offline), Grün (freigegeben/neu), gestrichelt (nicht gesetzt).
- **State:** reine Kennzeichnung, nie bedienbar.

### Cards / Containers
- **Corner Style:** 24 px (Listenkarten, Panels), 28 px (Hero), 32 px (Übungs- und Karteikarten).
- **Background:** Leinen; Hinweisflächen in Salbei oder Sand.
- **Shadow Strategy:** weicher Schatten, siehe Elevation.
- **Border:** keiner; Zustände 2 px in Bewertungsfarbe.
- **Internal Padding:** 1.5 rem (Karte), 1.75 rem (Panel), 2 rem (Übungskarte, Hero).

### Hero „Heute fällig“
Oliv-Fläche (28 px Rundung) mit Überschrift in Fraunces (1.9rem) und einem Terrakotta-Knopf; Nebentext in Oliv-Hell. Es gibt höchstens ein Hero pro Seite.

### Inputs / Fields
- **Style:** 1.5-px-Linie in Sandlinie, Leinen, 14 px Rundung, Schrift erbt; Antwortfeld beim Lernen größer (1.2rem).
- **Focus:** Fokusring in Terrakotta.
- **Error / Disabled:** Falsch färbt das Feld in Ton-Rot-Fläche; nach der Antwort ist das Feld schreibgeschützt und grün oder rot getönt.
- **Lücke im Satz** (`gap-input`): Inline-Feld in Salbei mit 12 px Rundung und Serif-Schrift, Breite nach der Länge der Lösung; Zustand über Rand (2 px) und Fläche.

### Navigation
- **Style:** Kopfzeile mit Terrakotta-Punkt (14 px) und Marke in Fraunces links, rechts Offline-/Warte-Anzeige, Darstellungs-Knopf (SVG-Sonne/-Mond/-Halbkreis) und Person mit Abmelden. Kein Menü; jede Seite hat oben rechts einen „Zurück“-Knopf.
- **Mobile:** Name der Person bricht um, der Rollen-Chip entfällt.

### Auswahl-Schalter (Segmented)
Vollrunde Knöpfe in einer Zeile, aktiv: Terrakotta gefüllt. Für Modus, Richtung, Anzahl, Ton, Reihenfolge; `role="radiogroup"`.

### Auswahl-Antwort (Choice)
Große Kachel (56 px, 18 px Rundung) mit Tastenkürzel-Kachel links (1–4, Salbei). Nach der Antwort: richtige Kachel grün getönt und fett, falsche rot getönt, übrige auf 65 % gedimmt.

### Übungskarte
Die Aufgabe ist immer eine Karte (32 px Rundung, 2-px-Rand transparent, 2 rem Innenabstand) mit Sprachlabel, dem Wort oder Satz groß in Fraunces, Antwortfeld, Sonderzeichen-Leiste und Rückmeldung darunter. Bei Grammatik kommt oben eine Zeile mit Aufgabentyp-Chip, Regeltitel und „Regel“ mit Buch-Symbol; Fehlerstellen sind rot wellig unterstrichen (`word-wrong`), korrigierte Stellen grün und fett (`word-fix`). Der Merksatz einer Regel steht in einer Oliv-Fläche.

### Lernserie (Wochenpunkte)
- **Panel:** Leinen, 24 px, ohne Rahmen. Überschrift in Fraunces: „n Tage in Folge“ (ab 2 Tagen, sonst „Lernserie“), darunter ein Satz zum heutigen Tag (0.875rem, Salbeigrau).
- **Wochenzeile:** sieben Punkte für Mo–So (28 px, vollrund, 2 px Sandlinie) mit Kürzel (0.75rem, fett). Erledigt: Terrakotta gefüllt; heute: Terrakotta-Rand; kommend: gestrichelt. Jeder Punkt trägt eine `aria`-Beschriftung („Montag: Tagesziel erreicht“); Farbe ist nie das einzige Zeichen.
- **Fußzeile:** „Lerntage insgesamt“ und „Beste Serie“ (0.875rem, Salbeigrau) links, rechts der Standard-Knopf mit Stern-Symbol „Abzeichen: n von 12“; er rutscht unter die Zahlen, wenn der Platz fehlt.
- **Meldung:** Erreicht das Ergebnis einer Runde das Tagesziel oder ein Abzeichen, erscheint ein Satz als Toast („Tagesziel erreicht – 2 Tage in Folge. Neues Abzeichen: 10 Wörter sicher.“), nie als Dialog.

### Abzeichen-Sammlung
- **Raster:** Karten ab 300 px Breite, Leinen, 24 px, ohne Rahmen (Schatten).
- **Medaille:** Kreis, 48 px, 2 px Sandlinie, Linien-Symbol in Salbeigrau. Erreicht: Terrakotta gefüllt, Symbol in Leinen. Verborgen und nicht erreicht: gestrichelt mit Stern; Titel und Text verraten nichts.
- **Fortschritt:** Bei nicht erreichten ein Balken in Wachstum-Grün wie überall („20 von 50“); bei erreichten das Datum.

### Gruppen-Schalter (Lehrkräfte)
Panel „Lernserie und Abzeichen“ mit einem Kontrollkästchen pro Gruppe, auf der Startseite unter den Listen. Speichert beim Umschalten und meldet das als Toast.

### Auswertung
Kennzahl-Kacheln, Diagramme als Linie und Säulen in Moos ohne Füllverlauf, sortierbare Tabellen mit Fortschrittsbalken in Wachstum-Grün und Stufen-Chips (neu → gefestigt) in zunehmend dichter Salbei-Tönung.

### Editor (Lehrkräfte)
Dichte Formulare in Panels; Werkzeugleiste klebt unter der Kopfzeile; Grammatik-Regeln sind aufklappbare Panels mit Aufgaben-Textfeld in Monospace, Live-Vorschau und zeilengenauen Fehlern in Ton-Rot.

## Do's and Don'ts

### Do:
- **Do** Farben und Maße über die Variablen (`--primary`, `--surface`, `--border`, `--right`, `--wrong`, `--warn`, `--chip`, `--moss`, `--hero`, `--radius`, `--shadow`) setzen, damit hell und dunkel identisch funktionieren; beide Blöcke bleiben gleich.
- **Do** Zustandsfarben nur auf die Kopfzeile der Rückmeldung („Richtig!“, „Leider falsch.“) legen, nie auf Hinweise oder den Merksatz; Text auf Zustandsflächen braucht mindestens 4,5 : 1.
- **Do** Bewertung über Rand und Fläche zeigen (2 px Rand in Wachstum-Grün, Ton-Rot oder Ocker, dazu die getönte Fläche) – Farbe nie als einziges Zeichen: immer auch Text („Richtig!“, „Leider falsch.“).
- **Do** Breite und Dichte an der Aufgabe ausrichten: 640 px beim Lernen, 1100 px beim Verwalten.
- **Do** jedes Element – auch Links und Zusammenfassungen – mit Fokusring, Tastaturbedienung und `aria`-Beschriftung ausstatten und den Fokus nach dem Neuzeichnen einer Ansicht (z. B. Satzbau) an eine sinnvolle Stelle setzen; Fremdsprachentext mit `lang` auszeichnen; Bewegung bei `prefers-reduced-motion` abschalten.
- **Do** Breiten und Farben per CSSOM setzen (`element.style.width`), nicht per `style`-Attribut – die Content-Security-Policy erlaubt keine Inline-Styles.
- **Do** neue Symbole als Linien-SVG über `icon()` in `ui.js` anlegen (`currentColor`, `aria-hidden`).
- **Do** neue Dateien in `public/` (auch Schriften) in die Liste des Service Workers eintragen.
- **Do** kurze, direkte deutsche Sätze schreiben und gendergerecht mit Doppelpunkt („Schüler:innen“).

### Don't:
- **Don't** Punkte, Level, Ranglisten, Vergleiche mit anderen, Konfetti, Münzen oder einen Shop und Zeitdruck einführen (Tempo-Runden sind ausgeschlossen). Bewusste Ausnahmen, klein und pro Gruppe abschaltbar: die Lernserie und Abzeichen fürs Können (siehe The Quiet Reward Rule).
- **Don't** einen zweiten Akzent neben Terrakotta einführen; Grün, Ton-Rot, Ocker bleiben der Bewertung vorbehalten, Moos dem Gewicht.
- **Don't** Terrakotta für Fehler oder Warnungen verwenden – es ist zu nah an Ton-Rot.
- **Don't** Rahmen um Karten, stärkere Schatten, Verläufe, Glas-Effekte oder farbige Seitenstreifen nutzen, um etwas wichtiger zu machen.
- **Don't** Schriften, Icons, Skripte oder Bilder von fremden Servern laden (Datenschutz-Zusage, CSP `default-src 'self'`).
- **Don't** Emojis als Symbole einsetzen; Zeichen und Pfeile bleiben Text (`font-variant-emoji: text`), Symbole sind SVG.
- **Don't** Fehler nur rot färben: falsche Stellen werden markiert und erklärt, nicht bestraft.
