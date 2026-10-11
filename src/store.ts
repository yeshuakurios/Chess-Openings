import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs';
import { MAX_ATTEMPTS, mergeProgress } from './merge.ts';

/** One user move in a line. Short field names on purpose: the log is synced and the Worker caps the body at 256 KB. */
export interface Attempt {
  id: string;
  k: string;       // variation key, same as the FSRS card key
  p: number;       // index of the move in the line (0 = first ply)
  ok: 0 | 1;       // 1 if the move was the line's move
  h: 0 | 1;        // 1 if Hint was pressed at this position first
  ms: number;      // time from the position appearing to this move
  t: number;       // epoch ms
  m: 'p' | 'd';    // practice or drill
}
export interface Progress {
  learned: Record<string, true>;
  cards: Record<string, Card>;
  bestCombo: number;
  attempts: Attempt[];
}
const empty = (): Progress => ({ learned: {}, cards: {}, bestCombo: 0, attempts: [] });
const DB = 'openings', STORE = 'kv', KEY = 'progress', TOKEN_KEY = 'syncToken';
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

async function kvGet(k: string): Promise<string | undefined> {
  const db = await open();
  return new Promise((res, rej) => {
    const r = db.transaction(STORE).objectStore(STORE).get(k);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function kvSet(k: string, v: string) {
  const db = await open();
  db.transaction(STORE, 'readwrite').objectStore(STORE).put(v, k);
}

export async function loadProgress(): Promise<Progress> {
  try {
    const raw = await kvGet(KEY);
    if (raw) progress = parse(raw);
    token = (await kvGet(TOKEN_KEY)) ?? '';
  } catch { /* private mode: run in memory */ }
  return progress;
}
function parse(raw: string): Progress {
  const p = { ...empty(), ...JSON.parse(raw) } as Progress;
  for (const k of Object.keys(p.cards)) p.cards[k] = revive(p.cards[k]);
  return p;
}
async function save(sync = true) {
  try { await kvSet(KEY, JSON.stringify(progress)); } catch { /* ignore */ }
  if (sync) scheduleSync();
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
/** Append one attempt. FSRS scheduling is unchanged; this feeds mastery and mistake tracking later. */
export function logAttempt(a: Omit<Attempt, 'id' | 't'>) {
  const t = Date.now();
  progress.attempts.push({ ...a, id: t.toString(36) + Math.random().toString(36).slice(2, 6), t });
  if (progress.attempts.length > MAX_ATTEMPTS) progress.attempts.splice(0, progress.attempts.length - MAX_ATTEMPTS);
  void save();
}
export function setBestCombo(n: number) {
  if (n > progress.bestCombo) { progress.bestCombo = n; void save(); }
}
export const exportProgress = () => JSON.stringify(progress);
export function importProgress(raw: string) { progress = parse(raw); void save(); }

// ---- D1 sync (optional: only active once a token is set) ----
export type SyncStatus = 'off' | 'ok' | 'unauthorized' | 'offline';
let token = '';
let timer: ReturnType<typeof setTimeout> | undefined;
export const hasToken = () => !!token;
export async function setToken(t: string) {
  token = t.trim();
  try { await kvSet(TOKEN_KEY, token); } catch { /* ignore */ }
}
function scheduleSync() {
  if (!token) return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), 3000);
}
/** Pull the remote copy, merge it with the local one, store the result both places. */
export async function syncNow(): Promise<SyncStatus> {
  if (!token) return 'off';
  const headers = { authorization: `Bearer ${token}` };
  try {
    const res = await fetch('./api/progress', { headers, cache: 'no-store' });
    if (res.status === 401) return 'unauthorized';
    if (!res.ok) return 'offline';
    const remote = (await res.json()) as { data: string | null };
    if (remote.data) progress = mergeProgress(progress, parse(remote.data));
    await save(false);
    const put = await fetch('./api/progress', { method: 'PUT', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(progress) });
    return put.ok ? 'ok' : put.status === 401 ? 'unauthorized' : 'offline';
  } catch { return 'offline'; }
}
