import assert from 'node:assert/strict';
import worker from './index.ts';
type Env = Parameters<typeof worker.fetch>[1];
const rows = new Map<string, { k: string; text: string; t: number }>();
const stmt = (sql: string) => ({ args: [] as unknown[], bind(...a: unknown[]) { this.args = a; return this; }, async run() { return {}; }, async all() { return { results: [...rows.values()] }; }, sql });
const DB = { prepare: (sql: string) => stmt(sql), batch: async (list: ReturnType<typeof stmt>[]) => { for (const s of list) { const [k, text, t] = s.args as [string, string, number]; const old = rows.get(k); if (!old || t > old.t) rows.set(k, { k, text, t }); } return []; } } as unknown as D1Database;
const env = { DB, SYNC_TOKEN: 's', ASSETS: {} as Fetcher, AI: {} as Ai } as Env;
const call = (method: string, body?: unknown, token = 's') => worker.fetch(new Request('https://x.test/api/explanations', { method, headers: { authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) }), env);

assert.equal((await call('GET', undefined, 'bad')).status, 401);
assert.equal((await call('POST')).status, 405);
assert.equal((await call('PUT', { items: 'x' })).status, 400);
assert.equal((await call('PUT', { items: Array.from({ length: 101 }, () => ({})) })).status, 400);
let r = await call('PUT', { items: [{ k: 'bird/main#2', text: 'one', t: 5 }, { k: 'bad key', text: 'x', t: 1 }, { k: 'bird/main#3', text: '  ', t: 1 }, { k: 'bird/main#4', text: 'y'.repeat(2000), t: 1 }] });
assert.deepEqual(await r.json(), { ok: true, saved: 2 }); // bad key and empty text dropped
assert.equal(rows.get('bird/main#4')!.text.length, 1000);
await call('PUT', { items: [{ k: 'bird/main#2', text: 'older', t: 3 }] });
assert.equal(rows.get('bird/main#2')!.text, 'one');     // an older copy never replaces a newer one
await call('PUT', { items: [{ k: 'bird/main#2', text: 'newer', t: 9 }] });
assert.equal(rows.get('bird/main#2')!.text, 'newer');
assert.equal(((await (await call('GET')).json()) as { items: unknown[] }).items.length, 2);
console.log('✓ worker explanations ok');
