// Wiederholungsplanung mit FSRS (Free Spaced Repetition Scheduler).
// Pro Schüler:in, Wort und Richtung werden Stabilität (wie lange das Wort voraussichtlich
// behalten wird) und Schwierigkeit gespeichert; daraus ergibt sich, wann es wieder fällig ist.
import { Rating, State, createEmptyCard, fsrs, generatorParameters } from 'ts-fsrs';

const DAY = 24 * 60 * 60 * 1000;

const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9, // Wort wiederholen, wenn es nur noch zu 90 % gewusst wird
    maximum_interval: 365, // höchstens einmal im Schuljahr
    enable_fuzz: true, // Termine leicht streuen, damit nicht alles am selben Tag fällig wird
    enable_short_term: false, // Wiederholungen innerhalb einer Runde regelt die Oberfläche
  }),
);

export const GRADES = {
  again: Rating.Again, // nicht gewusst
  hard: Rating.Hard, // gewusst, aber mit Mühe (z. B. kleiner Tippfehler)
  good: Rating.Good, // gewusst
  easy: Rating.Easy, // sofort gewusst
};

// Stufe 0–5 für Anzeige und Auswertung, abgeleitet aus der Stabilität in Tagen.
// Ab Stufe 3 („sicher“) wird das Wort in 2 Wochen noch mit ≥ 90 % Wahrscheinlichkeit gewusst.
const LEVEL_LIMITS = [3, 14, 45, 120];
export const SAFE_LEVEL = 3;

export function levelFor(stability) {
  if (!stability) return 0;
  return 1 + LEVEL_LIMITS.filter((limit) => stability >= limit).length;
}

function cardFromRow(row, now) {
  if (!row || row.state == null || !row.due) return createEmptyCard(now);
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: 0,
    scheduled_days: row.scheduled_days ?? 0,
    learning_steps: 0,
    reps: row.reps ?? 0,
    lapses: row.lapses ?? 0,
    state: row.state,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
}

// Neuer Stand nach einer Antwort. row: bisheriger Datensatz (oder undefined).
export function review(row, grade, now = new Date()) {
  const rating = GRADES[grade] ?? Rating.Again;
  const { card } = scheduler.next(cardFromRow(row, now), now, rating);
  let due = card.due;
  let scheduledDays = card.scheduled_days;
  // Nicht gewusst: am nächsten Tag wiederholen (FSRS würde teils mehrere Tage warten).
  if (rating === Rating.Again) {
    due = new Date(now.getTime() + DAY);
    scheduledDays = 1;
  }
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    due: due.toISOString(),
    state: card.state,
    reps: card.reps,
    lapses: card.lapses,
    scheduled_days: scheduledDays,
    last_review: now.toISOString(),
    box: levelFor(card.stability),
  };
}

export { State };
