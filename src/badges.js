// Abzeichen: reine Funktionen ohne Datenbank (siehe docs/gamification-plan.md, 3.2).
// Alle Abzeichen hängen an Können, nicht an Menge oder Anmelden: Wörter und Regeln, die „sicher“ sitzen,
// Wörter, die nach Wochen noch gewusst werden, Fehler, die am nächsten Tag richtig waren.
//
// stats (aus der Datenbank, siehe api.js):
//   safeWords     Wörter, die in mindestens einer Richtung sicher sind
//   bothWays      Wörter, die in beiden Richtungen sicher sind
//   safeRules     sichere Grammatikregeln
//   listsMastered Listen, in denen alles sicher ist (Vokabeln: mind. 5 Wörter, Grammatik: mind. 3 Regeln)
//   days          Lerntage insgesamt (Tagesziel erreicht)
//   longRecall    in dieser Übertragung: ein Wort nach mindestens 28 Tagen gewusst
//   errorFixed    in dieser Übertragung: ein Wort, das beim letzten Mal falsch war, an einem späteren Tag richtig

export const LONG_RECALL_DAYS = 28;

const count = (key, max) => ({ test: (s) => s[key] >= max, meter: (s) => [Math.min(s[key], max), max] });

export const BADGES = [
  { id: 'woerter-10', title: '10 Wörter sicher', text: 'Zehn Wörter sitzen auch nach zwei Wochen noch.', ...count('safeWords', 10) },
  { id: 'woerter-50', title: '50 Wörter sicher', text: 'Fünfzig Wörter sitzen auch nach zwei Wochen noch.', ...count('safeWords', 50) },
  { id: 'woerter-150', title: '150 Wörter sicher', text: 'Hundertfünfzig Wörter sitzen auch nach zwei Wochen noch.', ...count('safeWords', 150) },
  { id: 'regel-1', title: 'Erste Regel sicher', text: 'Du kannst eine Grammatikregel sicher anwenden.', ...count('safeRules', 1) },
  { id: 'regeln-5', title: '5 Regeln sicher', text: 'Fünf Grammatikregeln sitzen.', ...count('safeRules', 5) },
  { id: 'liste', title: 'Liste gemeistert', text: 'In einer Liste sitzt alles: jedes Wort bzw. jede Regel ist sicher.', test: (s) => s.listsMastered >= 1 },
  { id: 'lerntage-7', title: '7 Lerntage', text: 'An sieben Tagen hast du alles Fällige erledigt.', ...count('days', 7) },
  { id: 'lerntage-30', title: '30 Lerntage', text: 'An dreißig Tagen hast du alles Fällige erledigt.', ...count('days', 30) },
  { id: 'lerntage-100', title: '100 Lerntage', text: 'An hundert Tagen hast du alles Fällige erledigt.', ...count('days', 100) },
  // Erst sichtbar, wenn man sie hat: Unangekündigte Belohnungen untergraben die Motivation weniger (Deci et al. 1999)
  { id: 'langzeit', hidden: true, title: 'Nach 4 Wochen noch gewusst', text: 'Du hast ein Wort vier Wochen nicht gesehen und wusstest es trotzdem.', test: (s) => !!s.longRecall },
  { id: 'fehler', hidden: true, title: 'Fehler besiegt', text: 'Beim letzten Mal in dieser Richtung falsch, diesmal richtig.', test: (s) => !!s.errorFixed },
  { id: 'beide', hidden: true, title: 'Beide Richtungen', text: 'Zehn Wörter sind in beide Richtungen sicher.', test: (s) => s.bothWays >= 10 },
];

// Neu erreichte Abzeichen (Kennungen), die die Person noch nicht hat
export function newlyEarned(stats, have) {
  return BADGES.filter((b) => !have.has(b.id) && b.test(stats)).map((b) => b.id);
}

// Für die Sammlungsseite: nicht erreichte versteckte Abzeichen verraten nichts.
// earnedAt: Map Kennung → Zeitpunkt
export function collection(stats, earnedAt) {
  return BADGES.map((b) => {
    const at = earnedAt.get(b.id) ?? null;
    if (b.hidden && !at) {
      return { id: b.id, hidden: true, earned_at: null, title: 'Verstecktes Abzeichen', text: 'Wird verraten, sobald du es hast.', progress: null };
    }
    const [value, max] = !at && b.meter ? b.meter(stats) : [null, null];
    return { id: b.id, hidden: !!b.hidden, earned_at: at, title: b.title, text: b.text, progress: max ? { value, max } : null };
  });
}

export const titleOf = (id) => BADGES.find((b) => b.id === id)?.title ?? id;
