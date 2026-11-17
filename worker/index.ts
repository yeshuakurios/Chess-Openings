// Single-user progress API. Static files are served by the Workers assets binding; only /api/* reaches this code.
import { buildMessages, cacheKey, cleanAnswer, extractText, parseFacts } from '../src/explainShared.ts';

interface Env { DB: D1Database; ASSETS: Fetcher; AI: Ai; SYNC_TOKEN: string; AI_MODEL?: string }

/** The one place the model is named. Override with the AI_MODEL variable without a code change. */
const DEFAULT_MODEL = '@cf/google/gemma-4-26b-a4b-it';
/** Safety cap per UTC day, far below the 10,000 free neurons (about 6 per call on this model). */
const DAILY_AI_CALLS = 400;

const MAX_BYTES = 256 * 1024;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function sameToken(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([a, b].map(async s => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))));
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

/** Read-only list of the questions asked in the app, for the daily review routine. Same token as the rest of the API. Only the question fields leave the Worker, never the rest of the progress. */
async function questions(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);
  const row = await env.DB.prepare('SELECT data FROM progress WHERE id = 1').first<{ data: string }>();
  let list: unknown[] = [];
  try { const q = row ? (JSON.parse(row.data) as { questions?: unknown }).questions : []; if (Array.isArray(q)) list = q; } catch { /* unreadable progress: no questions */ }
  const out = list.flatMap(x => {
    const o = x as { id?: unknown; t?: unknown; q?: unknown; k?: unknown };
    return typeof o?.id === 'string' && typeof o.q === 'string' && typeof o.t === 'number'
      ? [{ id: o.id, t: o.t, q: o.q.slice(0, 500), ...(typeof o.k === 'string' ? { k: o.k } : {}) }] : [];
  });
  return json({ questions: out });
}

let tablesReady = false;
async function ensureTables(db: D1Database) {
  if (tablesReady) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS explain_cache (key TEXT PRIMARY KEY, text TEXT NOT NULL, model TEXT NOT NULL, created_at INTEGER NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS explain_usage (day TEXT PRIMARY KEY, calls INTEGER NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS explanations (k TEXT PRIMARY KEY, text TEXT NOT NULL, t INTEGER NOT NULL)').run();
  tablesReady = true;
}

const NOTE_KEY = /^[\w-]+\/[\w-]+#\d+$/, MAX_NOTES_PER_PUT = 100;
/** The owner's pasted explanations, one row per move. GET lists them all; PUT upserts the given ones, a row only being replaced by a newer `t`. */
async function explanations(req: Request, env: Env): Promise<Response> {
  await ensureTables(env.DB);
  if (req.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT k, text, t FROM explanations ORDER BY t').all<{ k: string; text: string; t: number }>();
    return json({ items: results });
  }
  if (req.method !== 'PUT') return json({ error: 'method not allowed' }, 405);
  const text = await req.text();
  if (text.length > MAX_BYTES) return json({ error: 'too large' }, 413);
  let items: unknown;
  try { items = (JSON.parse(text) as { items?: unknown }).items; } catch { return json({ error: 'invalid' }, 400); }
  if (!Array.isArray(items) || items.length > MAX_NOTES_PER_PUT) return json({ error: 'invalid' }, 400);
  const rows = items.flatMap(x => {
    const o = x as { k?: unknown; text?: unknown; t?: unknown };
    return typeof o?.k === 'string' && NOTE_KEY.test(o.k) && typeof o.text === 'string' && o.text.trim() && typeof o.t === 'number' ? [{ k: o.k, text: o.text.slice(0, 1000), t: o.t }] : [];
  });
  if (rows.length) await env.DB.batch(rows.map(r => env.DB.prepare('INSERT INTO explanations (k, text, t) VALUES (?1, ?2, ?3) ON CONFLICT(k) DO UPDATE SET text = ?2, t = ?3 WHERE ?3 > explanations.t').bind(r.k, r.text, r.t)));
  return json({ ok: true, saved: rows.length });
}

/** Rephrase a verified, rule-based mistake explanation. Any failure returns an error and the app keeps the rule-based text. */
async function explain(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  let facts;
  try { facts = parseFacts(await req.json()); } catch { return json({ error: 'invalid facts' }, 400); }
  const model = env.AI_MODEL || DEFAULT_MODEL;
  try {
    await ensureTables(env.DB);
    const key = await cacheKey(facts, model);
    const hit = await env.DB.prepare('SELECT text FROM explain_cache WHERE key = ?1').bind(key).first<{ text: string }>();
    if (hit) return json({ text: hit.text, model, cached: true });
    const day = new Date().toISOString().slice(0, 10);
    const used = await env.DB.prepare('SELECT calls FROM explain_usage WHERE day = ?1').bind(day).first<{ calls: number }>();
    if ((used?.calls ?? 0) >= DAILY_AI_CALLS) return json({ error: 'daily limit' }, 429);
    await env.DB.prepare('INSERT INTO explain_usage (day, calls) VALUES (?1, 1) ON CONFLICT(day) DO UPDATE SET calls = calls + 1').bind(day).run();
    // The model name is a string from config, so the typed model list does not apply.
    const out = await (env.AI as unknown as { run(m: string, i: unknown): Promise<unknown> }).run(model, {
      messages: buildMessages(facts), max_tokens: 160, temperature: 0.3, chat_template_kwargs: { enable_thinking: false }
    });
    const text = cleanAnswer(extractText(out), facts.played);
    if (!text) return json({ error: 'rejected' }, 502);
    await env.DB.prepare('INSERT OR REPLACE INTO explain_cache (key, text, model, created_at) VALUES (?1, ?2, ?3, ?4)').bind(key, text, model, Date.now()).run();
    return json({ text, model, cached: false });
  } catch { return json({ error: 'unavailable' }, 503); }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== '/api/progress' && url.pathname !== '/api/explain' && url.pathname !== '/api/questions' && url.pathname !== '/api/explanations') return env.ASSETS.fetch(req);

    const given = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
    if (!env.SYNC_TOKEN || !(await sameToken(given, env.SYNC_TOKEN))) return json({ error: 'unauthorized' }, 401);
    if (url.pathname === '/api/explain') return explain(req, env);
    if (url.pathname === '/api/questions') return questions(req, env);
    if (url.pathname === '/api/explanations') return explanations(req, env);

    if (req.method === 'GET') {
      const row = await env.DB.prepare('SELECT data, updated_at FROM progress WHERE id = 1').first<{ data: string; updated_at: number }>();
      return json(row ? { data: row.data, updatedAt: row.updated_at } : { data: null, updatedAt: 0 });
    }
    if (req.method === 'PUT') {
      const text = await req.text();
      if (text.length > MAX_BYTES) return json({ error: 'too large' }, 413);
      try { const p = JSON.parse(text); if (typeof p !== 'object' || p === null || !('cards' in p) || !('learned' in p)) throw 0; }
      catch { return json({ error: 'invalid progress' }, 400); }
      const now = Date.now();
      await env.DB.prepare(
        'INSERT INTO progress (id, data, updated_at) VALUES (1, ?1, ?2) ON CONFLICT(id) DO UPDATE SET data = ?1, updated_at = ?2'
      ).bind(text, now).run();
      return json({ ok: true, updatedAt: now });
    }
    return json({ error: 'method not allowed' }, 405);
  }
};
