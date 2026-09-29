// Speicher auf dem Gerät (IndexedDB): Listen zum Lernen ohne Internet und Antworten, die noch nicht
// übertragen wurden. Antworten gehören zu einer Person (user) – auf geteilten Geräten bleiben sie
// getrennt und werden erst übertragen, wenn sich dieselbe Person wieder anmeldet.
// Ohne IndexedDB (sehr alte Browser, manche private Fenster) wird nur im Arbeitsspeicher gehalten.

const NAME = 'vokabeltrainer';
const VERSION = 1;

let dbPromise = null;
const memory = { data: new Map(), outbox: new Map() };

function openDb() {
  dbPromise ??= new Promise((resolve) => {
    let req;
    try {
      req = indexedDB.open(NAME, VERSION);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('data');
      db.createObjectStore('outbox', { keyPath: 'id' }).createIndex('user', 'user');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function run(storeName, mode, fn) {
  return openDb().then((db) => {
    if (!db) return fn(null);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const result = fn(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  });
}

export function load(key) {
  return run('data', 'readonly', (s) => (s ? s.get(key) : memory.data.get(key)));
}

export function save(key, value) {
  return run('data', 'readwrite', (s) => (s ? s.put(value, key) : memory.data.set(key, value)));
}

export function remove(key) {
  return run('data', 'readwrite', (s) => (s ? s.delete(key) : memory.data.delete(key)));
}

// Antwort merken, bis sie übertragen ist. entry: { id, user, list_id, word_id, … }
export function queue(entry) {
  return run('outbox', 'readwrite', (s) => (s ? s.put(entry) : memory.outbox.set(entry.id, entry)));
}

// Noch nicht übertragene Antworten einer Person, älteste zuerst
export async function pending(user) {
  const rows = await run('outbox', 'readonly', (s) => (s ? s.index('user').getAll(user) : [...memory.outbox.values()].filter((e) => e.user === user)));
  return rows.sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0));
}

export function done(ids) {
  return run('outbox', 'readwrite', (s) => {
    for (const id of ids) s ? s.delete(id) : memory.outbox.delete(id);
  });
}
