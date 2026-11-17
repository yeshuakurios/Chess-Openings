import { authHeader, hasToken, kvGet, kvSet } from './store.ts';
import { mergeNotes, parseNotes, unsynced, type Notes } from './notes.ts';

const KEY = 'explanations', SYNCED = 'explanationsSyncedAt';
let notes: Notes = {};
let syncedAt = 0;

export async function loadNotes() {
  try {
    const raw = await kvGet(KEY); if (raw) notes = JSON.parse(raw);
    syncedAt = Number(await kvGet(SYNCED)) || 0;
  } catch { /* private mode: memory only */ }
}
const persist = async () => { try { await kvSet(KEY, JSON.stringify(notes)); await kvSet(SYNCED, String(syncedAt)); } catch { /* ignore */ } };
export const getNote = (k: string) => notes[k]?.text;
export const noteCount = () => Object.keys(notes).length;

/** Save pasted explanations on this device, then push them. Returns how many blocks were understood. */
export function addNotes(raw: string): number {
  const items = parseNotes(raw), t = Date.now();
  for (const { k, text } of items) notes[k] = { text, t };
  void persist().then(() => syncNotes());
  return items.length;
}

/** One cycle: push what changed since the last cycle to D1, pull what the server has newer. Run at start, after a paste and every few minutes while the app is open. */
export async function syncNotes(): Promise<'off' | 'ok' | 'offline'> {
  if (!hasToken()) return 'off';
  try {
    const headers = { ...authHeader(), 'content-type': 'application/json' };
    const pending = unsynced(notes, syncedAt);
    const sentAt = Date.now();
    if (pending.length) {
      const put = await fetch('./api/explanations', { method: 'PUT', headers, body: JSON.stringify({ items: pending }) });
      if (!put.ok) return 'offline';
    }
    const res = await fetch('./api/explanations', { headers, cache: 'no-store' });
    if (!res.ok) return 'offline';
    const remote = ((await res.json()) as { items?: { k: string; text: string; t: number }[] }).items ?? [];
    notes = mergeNotes(notes, Object.fromEntries(remote.map(x => [x.k, { text: x.text, t: x.t }])));
    syncedAt = sentAt;
    await persist();
    return 'ok';
  } catch { return 'offline'; }
}
/** Cycle every `ms` while the app is open (the first one now). */
export function startNoteCycle(ms = 10 * 60 * 1000) { void syncNotes(); setInterval(() => void syncNotes(), ms); }
