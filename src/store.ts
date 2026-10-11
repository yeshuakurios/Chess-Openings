import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs';

export interface Progress {
  learned: Record<string, true>;
  cards: Record<string, Card>;
  bestCombo: number;
}
const empty = (): Progress => ({ learned: {}, cards: {}, bestCombo: 0 });
const DB = 'openings', STORE = 'kv', KEY = 'progress';
const scheduler = fsrs();

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
const revive = (c: Card): Card => ({ ...c, due: new Date(c.due), last_review: c.last_review ? new Date(c.last_review) : undefined });

let progress: Progress = empty();

export async function loadProgress(): Promise<Progress> {
  try {
    const db = await open();
    const raw = await new Promise<string | undefined>((res, rej) => {
      const r = db.transaction(STORE).objectStore(STORE).get(KEY);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    if (raw) progress = parse(raw);
  } catch { /* private mode: run in memory */ }
  return progress;
}
function parse(raw: string): Progress {
  const p = { ...empty(), ...JSON.parse(raw) } as Progress;
  for (const k of Object.keys(p.cards)) p.cards[k] = revive(p.cards[k]);
  return p;
}
async function save() {
  try {
    const db = await open();
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(JSON.stringify(progress), KEY);
  } catch { /* ignore */ }
}

export const getProgress = () => progress;
export const isLearned = (k: string) => !!progress.learned[k];

export function markLearned(k: string) {
  progress.learned[k] = true;
  if (!progress.cards[k]) progress.cards[k] = createEmptyCard(new Date());
  void save();
}
/** mistakes: 0 → Good, 1 → Hard, 2+ → Again. */
export function review(k: string, mistakes: number) {
  const card = progress.cards[k] ?? createEmptyCard(new Date());
  const rating = mistakes === 0 ? Rating.Good : mistakes === 1 ? Rating.Hard : Rating.Again;
  progress.cards[k] = scheduler.next(card, new Date(), rating).card;
  void save();
}
export function dueKeys(now = new Date()): string[] {
  return Object.entries(progress.cards).filter(([, c]) => c.due <= now).sort((a, b) => +a[1].due - +b[1].due).map(([k]) => k);
}
export function setBestCombo(n: number) {
  if (n > progress.bestCombo) { progress.bestCombo = n; void save(); }
}
export const exportProgress = () => JSON.stringify(progress);
export function importProgress(raw: string) { progress = parse(raw); void save(); }
