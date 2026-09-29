import express from 'express';
import { fileURLToPath } from 'node:url';
import { apiRouter } from './api.js';
import { authRouter } from './auth.js';
import { assertConfig, config } from './config.js';
import { openDb } from './db.js';
import { purgeDevices } from './devices.js';
import { purgeSessions, sessionMiddleware } from './session.js';

export function createApp(db, cfg = config) {
  const app = express();
  app.disable('x-powered-by');
  if (cfg.trustProxy) app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': `default-src 'self'; img-src 'self' data:; frame-ancestors ${cfg.frameAncestors}; form-action 'self' ${cfg.oidc.issuer || ''}`.trim(),
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    });
    next();
  });

  // Schutz vor CSRF: Schreibende Anfragen müssen von der eigenen Seite kommen.
  const ownOrigin = new URL(cfg.baseUrl).origin;
  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin && origin !== ownOrigin) return res.status(403).json({ error: 'Ungültige Herkunft.' });
    if (req.path.startsWith('/api/') && !req.is('application/json') && req.method !== 'DELETE') {
      return res.status(415).json({ error: 'JSON erwartet.' });
    }
    next();
  });

  app.use(sessionMiddleware(db, { days: cfg.sessionDays, secure: cfg.baseUrl.startsWith('https://') }));

  app.get('/config.json', (req, res) => {
    res.json({ appName: cfg.appName, loginLabel: cfg.loginLabel, devLogin: cfg.devLogin, oidc: !!cfg.oidc.issuer });
  });
  app.get('/healthz', (req, res) => res.send('ok'));
  app.use('/auth', authRouter(db, cfg));
  app.use('/api', apiRouter(db, cfg));

  // Die Planungs-Bibliothek läuft auch im Browser (Lernen ohne Internet), ohne Build-Schritt
  const fsrsModule = fileURLToPath(import.meta.resolve('ts-fsrs'));
  app.get('/vendor/ts-fsrs.js', (req, res) => res.sendFile(fsrsModule, { maxAge: cfg.production ? '1h' : 0 }));

  const publicDir = fileURLToPath(new URL('../public', import.meta.url));
  app.use(express.static(publicDir, { index: 'index.html', maxAge: cfg.production ? '1h' : 0 }));

  app.use((err, req, res, next) => {
    console.error(err);
    if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'Interner Fehler.' });
    res.status(500).send(
      '<!doctype html><meta charset="utf-8"><title>Fehler</title><p>Die Anmeldung ist fehlgeschlagen. <a href="/">Zurück zur Startseite</a></p>',
    );
  });

  return app;
}

function cleanup(db) {
  purgeSessions(db);
  purgeDevices(db);
  if (config.retentionDays > 0) {
    const cutoff = new Date(Date.now() - config.retentionDays * 86400000).toISOString();
    const { changes } = db.prepare('DELETE FROM users WHERE last_login < ?').run(cutoff);
    if (changes) console.log(`${changes} inaktive Konten gelöscht.`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assertConfig();
  const db = openDb(config.dataDir);
  cleanup(db);
  setInterval(() => cleanup(db), 6 * 60 * 60 * 1000).unref();
  createApp(db).listen(config.port, () => {
    console.log(`Vokabeltrainer läuft auf Port ${config.port} (${config.baseUrl})`);
    if (config.devLogin) console.warn('ACHTUNG: DEV_LOGIN ist aktiv – nur für die Entwicklung verwenden!');
  });
}
