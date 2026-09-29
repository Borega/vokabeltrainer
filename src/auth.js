import express from 'express';
import * as oidc from 'openid-client';
import { userFromClaims } from './claims.js';
import { now, transaction } from './db.js';
import { forgetDevice, resumeDevice } from './devices.js';

export function saveUser(db, user) {
  return transaction(db, () => {
    const row = db
      .prepare(
        `INSERT INTO users (sub, name, is_teacher, last_login) VALUES (?, ?, ?, ?)
         ON CONFLICT(sub) DO UPDATE SET name = excluded.name, is_teacher = excluded.is_teacher, last_login = excluded.last_login
         RETURNING id`,
      )
      .get(user.sub, user.name, user.isTeacher ? 1 : 0, now());
    db.prepare('DELETE FROM user_groups WHERE user_id = ?').run(row.id);
    const insert = db.prepare('INSERT INTO user_groups (user_id, group_id, group_name) VALUES (?, ?, ?)');
    for (const g of user.groups) insert.run(row.id, g.id, g.name);
    return row.id;
  });
}

function login(req, userId) {
  req.session.regenerate();
  req.session.data.userId = userId;
}

export function authRouter(db, config) {
  const router = express.Router();
  const redirectUri = `${config.baseUrl}/auth/callback`;
  let oidcConfig;

  async function getOidc() {
    if (!oidcConfig) {
      oidcConfig = await oidc.discovery(
        new URL(config.oidc.issuer),
        config.oidc.clientId,
        config.oidc.clientSecret,
        undefined,
        // http:// nur für lokale Tests mit einem Test-Anbieter erlauben
        !config.production && config.oidc.issuer.startsWith('http://')
          ? { execute: [oidc.allowInsecureRequests] }
          : undefined,
      );
    }
    return oidcConfig;
  }

  if (config.oidc.issuer) {
    router.get('/login', async (req, res, next) => {
      try {
        const cfg = await getOidc();
        const verifier = oidc.randomPKCECodeVerifier();
        const state = oidc.randomState();
        const nonce = oidc.randomNonce();
        req.session.data.pending = { verifier, state, nonce };
        const url = oidc.buildAuthorizationUrl(cfg, {
          redirect_uri: redirectUri,
          scope: config.oidc.scopes,
          code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
          code_challenge_method: 'S256',
          state,
          nonce,
        });
        res.redirect(url.href);
      } catch (err) {
        next(err);
      }
    });

    router.get('/callback', async (req, res, next) => {
      const pending = req.session.data.pending;
      if (!pending) return res.redirect('/');
      try {
        const cfg = await getOidc();
        // Hinter einem Reverse-Proxy zählt die öffentliche Adresse, nicht die interne.
        const currentUrl = new URL(req.originalUrl, config.baseUrl);
        const tokens = await oidc.authorizationCodeGrant(cfg, currentUrl, {
          pkceCodeVerifier: pending.verifier,
          expectedState: pending.state,
          expectedNonce: pending.nonce,
        });
        const idClaims = tokens.claims() ?? {};
        let claims = idClaims;
        try {
          const info = await oidc.fetchUserInfo(cfg, tokens.access_token, idClaims.sub);
          claims = { ...idClaims, ...info };
        } catch (err) {
          console.warn('Userinfo nicht abrufbar, nutze nur ID-Token:', err.message);
        }
        if (config.oidc.logClaims) console.log('OIDC-Claims:', JSON.stringify(claims, null, 2));
        const user = userFromClaims(claims, config);
        login(req, saveUser(db, user));
        res.redirect('/');
      } catch (err) {
        delete req.session.data.pending;
        next(err);
      }
    });
  }

  if (config.devLogin) {
    // Nur lokal: freie Wahl von Name, Rolle und Gruppen zum Ausprobieren.
    router.post('/dev-login', express.urlencoded({ extended: false }), (req, res) => {
      const groups = String(req.body.groups ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((g) => ({ id: g.toLowerCase().replace(/\s+/g, '.'), name: g }));
      const name = String(req.body.name || 'Test').slice(0, 100);
      const user = {
        sub: `dev:${name.toLowerCase()}`,
        name,
        groups,
        isTeacher: req.body.teacher === 'on',
      };
      login(req, saveUser(db, user));
      res.redirect('/');
    });
  }

  // Neue Sitzung mit dem Geräteschlüssel der App („Angemeldet bleiben“)
  router.post('/resume', express.json(), (req, res) => {
    const device = config.rememberDays > 0 ? resumeDevice(db, req.body?.token) : null;
    if (!device) return res.status(401).json({ error: 'Bitte neu anmelden.' });
    db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(now(), device.userId);
    login(req, device.userId);
    req.session.data.device = device.hash;
    res.json({ ok: true });
  });

  router.post('/logout', (req, res) => {
    forgetDevice(db, req.session.data?.device);
    req.session.destroy();
    res.redirect('/');
  });

  return router;
}
