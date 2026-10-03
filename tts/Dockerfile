# Piper (https://github.com/OHF-Voice/piper1-gpl, GPL-3.0) als eigener Dienst für die Aussprache.
# Die App spricht ihn nur über HTTP an (TTS_URL); die Stimmen werden beim ersten Start geladen (siehe entrypoint.sh).
FROM python:3.12-slim

RUN pip install --no-cache-dir "piper-tts[http]==1.8.0" \
    && useradd --create-home --uid 10001 piper \
    && mkdir /voices && chown piper /voices

COPY entrypoint.sh /entrypoint.sh
USER piper
VOLUME ["/voices"]
EXPOSE 5000

# Der erste Start lädt die Stimmen (mehrere hundert MB) – so lange gilt der Dienst noch nicht als defekt.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15m \
    CMD python -c "import urllib.request as u; u.urlopen('http://127.0.0.1:5000/info', timeout=3)"
ENTRYPOINT ["sh", "/entrypoint.sh"]
