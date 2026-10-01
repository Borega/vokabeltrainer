# Grammatik-Vorlagen

Diese Listen legt der Server beim Start als freigegebene Vorlagen an (siehe `src/templates.js`).

- `vorlagen.json` nennt jede Datei mit Titel der Liste, Sprache (`lang`) und Jahrgang (`grade`).
  Bei Deutsch ist „Groß-/Kleinschreibung beachten“ an, sonst aus; „Akzente und Umlaute beachten“ immer an.
- Die Dateien haben das Format von „Als Textdatei exportieren“ im Grammatik-Editor (`## Titel`, `Merksatz:`,
  `Erklärung:`, `Aufgaben:`). Eine eigene Liste lässt sich also exportieren und hier ergänzen.
- Der Schlüssel einer Vorlage ist ihr Dateipfad: Umbenennen legt eine neue Vorlage an und entfernt die alte.
- Fehlerhafte Dateien werden beim Start übersprungen (Meldung im Log); `npm test` prüft alle Vorlagen.
