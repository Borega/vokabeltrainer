// Gruppen/Rollen kommen je nach Anbieter in unterschiedlichen Formen an:
//   ["klasse.7b", ...]                          (Strings)
//   [{ "id": "klasse.7b", "name": "Klasse 7b" }]   (Objekte, auch act/name, uuid/displayName)
//   { "klasse.7b": "Klasse 7b" }                 (Objekt-Map)
// normalizeEntries() macht daraus immer [{ id, name }].

function entryFrom(value, key) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    const id = String(key ?? value);
    return { id, name: String(value) };
  }
  if (typeof value === 'object') {
    const id = value.act ?? value.id ?? value.uuid ?? value.slug ?? value.name ?? key;
    const name = value.name ?? value.displayName ?? value.display_name ?? value.title ?? id;
    if (id == null) return null;
    return { id: String(id), name: String(name) };
  }
  return null;
}

export function normalizeEntries(raw) {
  if (raw == null) return [];
  if (typeof raw === 'string') raw = raw.split(/[,\s]+/).filter(Boolean);
  let entries;
  if (Array.isArray(raw)) entries = raw.map((v) => entryFrom(v));
  else if (typeof raw === 'object') entries = Object.entries(raw).map(([k, v]) => entryFrom(v, k));
  else entries = [];

  const seen = new Map();
  for (const e of entries) {
    if (e && e.id && !seen.has(e.id)) seen.set(e.id, e);
  }
  return [...seen.values()];
}

function matches(entries, needles) {
  return entries.some(
    (e) => needles.includes(e.id.toLowerCase()) || needles.includes(e.name.toLowerCase()),
  );
}

// Erster vorhandener Claim: der konfigurierte, sonst die üblichen Namen (IServ: "iserv:groups").
function pick(claims, configured, fallbacks) {
  for (const key of [configured, ...fallbacks]) {
    if (key && claims[key] != null) return claims[key];
  }
  return undefined;
}

export function userFromClaims(claims, config) {
  const groups = normalizeEntries(pick(claims, config.oidc.groupsClaim, ['iserv:groups', 'groups']));
  const roles = normalizeEntries(pick(claims, config.oidc.rolesClaim, ['iserv:roles', 'roles']));
  const name =
    claims.name ||
    [claims.given_name, claims.family_name].filter(Boolean).join(' ') ||
    claims.preferred_username ||
    'Unbekannt';
  const isTeacher = matches(roles, config.teacherRoles) || matches(groups, config.teacherGroups);
  return { sub: String(claims.sub), name, groups, isTeacher };
}
