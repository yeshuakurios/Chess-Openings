import assert from 'node:assert/strict';
import worker from './index.ts';
import type { ExplainFacts } from '../src/explainShared.ts';

// Minimal in-memory stand-ins for D1 and the AI binding, enough to run the /api/explain route.
function fakeDb() {
  const cache = new Map<string, string>(), usage = new Map<string, number>();
  const stmt = (sql: string) => ({ args: [] as unknown[], bind(...a: unknown[]) { this.args = a; return this; },
    async first() {
      if (sql.startsWith('SELECT text')) { const t = cache.get(this.args[0] as string); return t ? { text: t } : null; }
      if (sql.startsWith('SELECT calls')) { const c = usage.get(this.args[0] as string); return c === undefined ? null : { calls: c }; }
      return null;
    },
    async run() {
      if (sql.startsWith('INSERT INTO explain_usage')) usage.set(this.args[0] as string, (usage.get(this.args[0] as string) ?? 0) + 1);
      if (sql.startsWith('INSERT OR REPLACE INTO explain_cache')) cache.set(this.args[0] as string, this.args[1] as string);
      return {};
    } });
  return { db: { prepare: stmt } as unknown as D1Database, cache, usage };
}
type Env = Parameters<typeof worker.fetch>[1];
const facts: ExplainFacts = { opening: 'Bird\'s Opening', line: 'Main line', plan: 'Take control of the key central square', side: 'white', moveNumber: 3,
  kind: 'move-order', played: 'b3', wrong: 2, hints: 0, slow: 0, rule: 'b3 is a good move, but it comes later in this line. Something else has to happen first.' };
const good = 'b3 is a sound move, but it belongs later in this line, so first finish the step that comes before it.';
const call = (env: Env, body: unknown, token = 'secret', method = 'POST') =>
  worker.fetch(new Request('https://x.test/api/explain', { method, headers: { authorization: `Bearer ${token}` }, body: method === 'POST' ? JSON.stringify(body) : undefined }), env);

let aiCalls = 0; let aiReply: () => unknown = () => ({ response: good });
const { db, usage } = fakeDb();
const env = { DB: db, SYNC_TOKEN: 'secret', ASSETS: {} as Fetcher, AI: { run: async () => { aiCalls++; return aiReply(); } } as unknown as Ai } as Env;

assert.equal((await call(env, facts, 'wrong')).status, 401);
assert.equal((await call(env, facts, 'secret', 'GET')).status, 405);
assert.equal((await call(env, { nope: 1 })).status, 400);

let r = await call(env, facts);
assert.equal(r.status, 200);
assert.deepEqual(await r.json(), { text: good, model: '@cf/google/gemma-4-26b-a4b-it', cached: false });
r = await call(env, facts);                                           // same facts: served from the cache, no second AI call
assert.deepEqual(await r.json(), { text: good, model: '@cf/google/gemma-4-26b-a4b-it', cached: true });
assert.equal(aiCalls, 1);

aiReply = () => ({ choices: [{ message: { content: good.replace('b3', 'b3') + ' Next time start with the knight.' } }] });
assert.equal((await call(env, { ...facts, wrong: 5 })).status, 200);  // other response shape works

aiReply = () => ({ response: 'You should have played Nf3 here because it controls the center nicely.' });
assert.equal((await call(env, { ...facts, wrong: 6 })).status, 502);  // names another move: rejected, app keeps the rule text

aiReply = () => { throw new Error('capacity'); };
assert.equal((await call(env, { ...facts, wrong: 7 })).status, 503);  // model unavailable

aiReply = () => ({ response: good });
const today = new Date().toISOString().slice(0, 10);
usage.set(today, 400);
const before = aiCalls;
assert.equal((await call(env, { ...facts, wrong: 8 })).status, 429);  // daily cap
assert.equal(aiCalls, before);

const withModel = { ...env, AI_MODEL: '@cf/other/model' } as Env;      // model comes from config
usage.set(today, 0);
assert.equal(((await (await call(withModel, { ...facts, wrong: 9 })).json()) as { model: string }).model, '@cf/other/model');
console.log('✓ worker explain ok');
