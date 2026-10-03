#!/bin/sh
# Lädt beim ersten Start die Stimmen aus PIPER_VOICES (Komma-getrennt, z. B. de_DE-thorsten-high,en_GB-alba-medium)
# und startet den HTTP-Server von Piper. Schlägt ein Download fehl, bricht der Start ab und Docker versucht es erneut:
# Piper würde eine fehlende Stimme sonst stillschweigend durch die erste ersetzen.
set -eu
: "${PIPER_VOICES:?PIPER_VOICES fehlt}"
dir=/voices
first=

for voice in $(echo "$PIPER_VOICES" | tr ',' ' '); do
  first=${first:-$voice}
  # Die Konfigurationsdatei wird zuletzt geladen: Fehlt sie, ist ein früherer Download unvollständig.
  if [ ! -s "$dir/$voice.onnx.json" ]; then
    rm -f "$dir/$voice.onnx"
    if ! python -m piper.download_voices --data-dir "$dir" "$voice"; then
      rm -f "$dir/$voice.onnx" "$dir/$voice.onnx.json"
      echo "Stimme $voice konnte nicht geladen werden." >&2
      exit 1
    fi
  fi
done

exec python -m piper.http_server -m "$first" --data-dir "$dir"
