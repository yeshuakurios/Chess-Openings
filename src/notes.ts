/** Explanations the owner pastes back from a Claude session ("EXPLANATION <opening>/<line>#<ply>" then the text). Pure helpers; storage is in notestore.ts, the server copy in the Worker's `explanations` table. */
export interface Note { text: string; t: number }
export type Notes = Record<string, Note>;
export const NOTE_MAX = 1000;
const KEY_RE = /^[\w-]+\/[\w-]+#\d+$/;
const HEAD_RE = /^\s*EXPLANATION\b[ \t]*(.*?)\s*$/;

/** Split pasted text into blocks. A block starts at a header line; text before the first header and blocks with a bad id or empty body are dropped. A repeated id keeps the last one. */
export function parseNotes(raw: string): { k: string; text: string }[] {
  const out = new Map<string, string>();
  let cur: string | undefined, body: string[] = [];
  const flush = () => { const text = body.join('\n').trim().slice(0, NOTE_MAX); if (cur && KEY_RE.test(cur) && text) out.set(cur, text); };
  for (const line of raw.split(/\r?\n/)) {
    const h = HEAD_RE.exec(line);
    if (h) { flush(); cur = h[1]; body = []; } else body.push(line);
  }
  flush();
  return [...out].map(([k, text]) => ({ k, text }));
}
/** Union by id; the newer `t` wins. */
export function mergeNotes(a: Notes, b: Notes): Notes {
  const out: Notes = { ...a };
  for (const [k, n] of Object.entries(b)) if (!out[k] || n.t > out[k].t) out[k] = n;
  return out;
}
/** Notes changed since the last successful push. */
export const unsynced = (n: Notes, syncedAt: number): { k: string; text: string; t: number }[] =>
  Object.entries(n).filter(([, x]) => x.t > syncedAt).map(([k, x]) => ({ k, ...x }));
