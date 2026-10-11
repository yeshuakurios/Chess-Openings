// Single-user progress API. Static files are served by the Workers assets binding; only /api/* reaches this code.
interface Env { DB: D1Database; ASSETS: Fetcher; SYNC_TOKEN: string }

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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== '/api/progress') return env.ASSETS.fetch(req);

    const given = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
    if (!env.SYNC_TOKEN || !(await sameToken(given, env.SYNC_TOKEN))) return json({ error: 'unauthorized' }, 401);

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
