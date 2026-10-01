// Lernserie: reine Funktionen ohne Datenbank, damit sie sich leicht testen lassen.
// Tage sind Zeichenketten 'JJJJ-MM-TT' in der Zeitzone der Schule (config.timezone).

// Mindestens so viele Antworten an einem Tag erfüllen das Tagesziel, auch wenn noch mehr fällig ist
// (nach den Ferien können mehrere hundert Einträge fällig sein).
export const DAILY_GOAL = 25;
// Ein verpasster Tag wird überbrückt, wenn in den 6 Tagen davor keiner überbrückt wurde.
export const GRACE_SPAN = 7;

const NEVER = '9999-12-31';

const formatters = new Map();
function partsOf(ms, timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(timeZone, new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    }));
  }
  return Object.fromEntries(formatters.get(timeZone).formatToParts(ms).map((p) => [p.type, Number(p.value)]));
}

const pad = (n) => String(n).padStart(2, '0');

// Der Kalendertag eines Zeitpunkts (ms) in der Zeitzone
export function localDay(ms, timeZone) {
  const p = partsOf(ms, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Wie weit die Ortszeit der Zeitzone vor UTC liegt (ms) – zu dem Zeitpunkt ms
function offsetMs(ms, timeZone) {
  const p = partsOf(ms, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

// Beginn des Tages (ms), auch an Tagen mit Zeitumstellung
export function startOfDay(day, timeZone) {
  const [y, m, d] = day.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d);
  return wall - offsetMs(wall - offsetMs(wall, timeZone), timeZone);
}

// Letzte Millisekunde des Tages
export const endOfDay = (day, timeZone) => startOfDay(addDays(day, 1), timeZone) - 1;

// Serie aus den Tageszeilen (aufsteigend): { day, done, had_due, next_due }.
//   done      Tagesziel erreicht
//   had_due   an dem Tag war etwas fällig (sonst war er frei: Üben ist erlaubt, ändert aber nichts)
//   next_due  wann nach der letzten Antwort des Tages wieder etwas fällig wird
// Tage ohne Zeile sind frei, solange nichts fällig war (vor dem next_due der letzten Zeile), sonst verpasst.
// Verpasste Tage bricht die Serie, außer einem pro GRACE_SPAN Tage. Der heutige Tag bricht nie.
// Ergebnis: aktuelle Serie, beste Serie, Lerntage insgesamt (nie zurückgesetzt).
export function computeStreak(rows, today, timeZone) {
  const total = rows.filter((r) => r.done).length;
  if (!rows.length) return { current: 0, best: 0, total };
  const byDay = new Map(rows.map((r) => [r.day, r]));
  let current = 0;
  let best = 0;
  let freeUntil = NEVER;
  let lastBridged = -Infinity;
  let index = 0;
  for (let day = rows[0].day; day <= today; day = addDays(day, 1), index++) {
    const row = byDay.get(day);
    if (row) freeUntil = row.next_due ? localDay(Date.parse(row.next_due), timeZone) : NEVER;
    if (row?.done) {
      best = Math.max(best, ++current);
      continue;
    }
    const free = row ? !row.had_due : day < freeUntil;
    if (free || day === today) continue;
    if (index - lastBridged >= GRACE_SPAN) {
      lastBridged = index;
    } else {
      current = 0;
      lastBridged = -Infinity;
    }
  }
  return { current, best, total };
}

// Montag bis Sonntag der Woche von today, jeweils mit erledigt/heute/kommt noch
export function weekOf(rows, today) {
  const done = new Set(rows.filter((r) => r.done).map((r) => r.day));
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sonntag
  const monday = addDays(today, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    return { day, done: done.has(day), today: day === today, future: day > today };
  });
}
