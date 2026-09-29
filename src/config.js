// Alle Einstellungen kommen aus Umgebungsvariablen (siehe .env.example).

const env = process.env;

function list(value, fallback = '') {
  return (value ?? fallback)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function bool(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'ja', 'on'].includes(value.toLowerCase());
}

const production = env.NODE_ENV === 'production';

export const config = {
  production,
  port: Number(env.PORT ?? 3000),
  // Öffentliche Adresse der App, z. B. https://vokabeln.meine-schule.de
  baseUrl: (env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, ''),
  dataDir: env.DATA_DIR ?? './data',
  trustProxy: bool(env.TRUST_PROXY, production),
  sessionDays: Number(env.SESSION_DAYS ?? 7),
  // „Angemeldet bleiben“: so viele Tage nach der IServ-Anmeldung meldet die App sich selbst wieder an (0 = aus)
  rememberDays: Number(env.REMEMBER_DAYS ?? 30),
  // Konten, die sich so lange nicht angemeldet haben, werden samt Lernstand gelöscht (0 = nie).
  retentionDays: Number(env.RETENTION_DAYS ?? 400),
  frameAncestors: env.FRAME_ANCESTORS ?? "'self'",
  appName: env.APP_NAME ?? 'Vokabeltrainer',
  loginLabel: env.LOGIN_LABEL ?? 'Mit IServ anmelden',

  oidc: {
    // Bei IServ: https://mein-iserv.de (Discovery unter /.well-known/openid-configuration)
    issuer: env.OIDC_ISSUER ?? '',
    clientId: env.OIDC_CLIENT_ID ?? '',
    clientSecret: env.OIDC_CLIENT_SECRET ?? '',
    scopes: env.OIDC_SCOPES ?? 'openid profile iserv:groups iserv:roles',
    groupsClaim: env.OIDC_GROUPS_CLAIM ?? 'iserv:groups',
    rolesClaim: env.OIDC_ROLES_CLAIM ?? 'iserv:roles',
    // Zeigt die empfangenen Claims im Log – hilfreich beim Einrichten der Lehrkraft-Erkennung.
    logClaims: bool(env.OIDC_LOG_CLAIMS),
  },

  // Wer als Lehrkraft gilt: Treffer in Rollen ODER Gruppen (Groß-/Kleinschreibung egal).
  teacherRoles: list(env.TEACHER_ROLES, 'ROLE_TEACHER,teacher,lehrer'),
  teacherGroups: list(env.TEACHER_GROUPS, 'lehrer'),
  // Gruppen, die Lehrkräften bei der Zuweisung nicht angeboten werden.
  hiddenGroups: list(env.HIDDEN_GROUPS, 'alle,lehrer,schueler,schüler'),

  // Nur für die lokale Entwicklung: Anmeldung ohne OIDC.
  devLogin: !production && bool(env.DEV_LOGIN),
};

export function assertConfig() {
  const missing = [];
  if (!config.devLogin) {
    if (!config.oidc.issuer) missing.push('OIDC_ISSUER');
    if (!config.oidc.clientId) missing.push('OIDC_CLIENT_ID');
    if (!config.oidc.clientSecret) missing.push('OIDC_CLIENT_SECRET');
  }
  if (missing.length) {
    throw new Error(`Fehlende Umgebungsvariablen: ${missing.join(', ')}`);
  }
}
