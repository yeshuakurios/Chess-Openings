import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs';
import { MAX_ATTEMPTS, mergeProgress } from './merge.ts';
import { LINE_BONUS, dayKey, xpForAttempt } from './gamify.ts';
import { flagKey, type Stamped } from './flags.ts';

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
  o?: 1;           // 1 if the line was started from the middle (spot check)
  s?: string;      // the move played, kept only for wrong attempts
}
export interface Progress {
  learned: Record<string, true>;
  cards: Record<string, Card>;
  bestCombo: number;
  attempts: Attempt[];
  /** XP per local day. Kept as a per-day total (merged by max) so it survives the attempt log being capped and re-syncs without double counting. */
  xp: Record<string, number>;
  /** Earned badge id -> day earned. Never removed. */
  badges: Record<string, string>;
  /** Openings set aside with "Save for later". Per opening: `on` plus when it was last changed, so the newest change wins when two devices sync. Progress on a saved opening is kept. */
  shelf: Record<string, Stamped>;
  /** Moves marked "Needs more explanation", keyed by line and move index (see flagKey). Turned off, not deleted, so the change syncs. */
  flags: Record<string, Stamped>;
}
const empty = (): Progress => ({ learned: {}, cards: {}, bestCombo: 0, attempts: [], xp: {}, badges: {}, shelf: {}, flags: {} });
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
  void requestPersistence();
  return progress;
}
/** Ask the browser not to evict our storage (iOS can clear site data of unused sites). Best effort; the answer may be no. */
async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* unsupported or denied: nothing to do */ }
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
export const isShelved = (openingId: string) => !!progress.shelf[openingId]?.on;
export const isFlagged = (line: string, ply: number) => !!progress.flags[flagKey(line, ply)]?.on;
export function setFlagged(line: string, ply: number, on: boolean) {
  progress.flags[flagKey(line, ply)] = { on, t: Date.now() };
  void save();
}
export const flaggedCount = () => Object.values(progress.flags).filter(f => f.on).length;
export function clearFlags() {
  const t = Date.now();
  for (const [k, f] of Object.entries(progress.flags)) if (f.on) progress.flags[k] = { on: false, t };
  void save();
}
export function setShelved(openingId: string, on: boolean) {
  progress.shelf[openingId] = { on, t: Date.now() };
  void save();
}

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
  addXp(xpForAttempt(a));
  if (progress.attempts.length > MAX_ATTEMPTS) progress.attempts.splice(0, progress.attempts.length - MAX_ATTEMPTS);
  void save();
}
function addXp(n: number) {
  if (n > 0) { const d = dayKey(); progress.xp[d] = (progress.xp[d] ?? 0) + n; }
}
/** XP for finishing a line with no mistakes and no hints. */
export function awardLineBonus() { addXp(LINE_BONUS); void save(); }
/** Record newly qualified badges; returns the ids that were new. */
export function grantBadges(ids: string[]): string[] {
  const fresh = ids.filter(id => !progress.badges[id]);
  if (fresh.length) { const d = dayKey(); for (const id of fresh) progress.badges[id] = d; void save(); }
  return fresh;
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
export const authHeader = () => ({ authorization: `Bearer ${token}` });
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
