import assert from 'node:assert/strict';
import worker from './index.ts';

type Env = Parameters<typeof worker.fetch>[1];
const withData = (data: string | null) => ({ prepare: () => ({ first: async () => (data === null ? null : { data }) }) }) as unknown as D1Database;
const call = (data: string | null, token = 'secret', method = 'GET') =>
  worker.fetch(new Request('https://x.test/api/questions', { method, headers: { authorization: `Bearer ${token}` } }), { DB: withData(data), SYNC_TOKEN: 'secret', ASSETS: {} as Fetcher, AI: {} as Ai } as Env);

const progress = JSON.stringify({ learned: {}, cards: {}, secret: 'x', questions: [
  { id: 'a1', t: 5, q: 'Why?', k: 'bird/main-d5#2' }, { id: 'a2', t: 6, q: 'General' }, { id: 7, t: 1, q: 'bad id' }, { id: 'a3', q: 'no time' }, 'junk'] });

assert.equal((await call(progress, 'wrong')).status, 401);
assert.equal((await call(progress, 'secret', 'POST')).status, 405);
const r = await call(progress);
assert.equal(r.status, 200);
assert.deepEqual(await r.json(), { questions: [{ id: 'a1', t: 5, q: 'Why?', k: 'bird/main-d5#2' }, { id: 'a2', t: 6, q: 'General' }] }); // only valid questions, only their fields
assert.deepEqual(await (await call(null)).json(), { questions: [] });          // nothing synced yet
assert.deepEqual(await (await call('not json')).json(), { questions: [] });    // unreadable progress
assert.deepEqual(await (await call(JSON.stringify({ cards: {}, learned: {} }))).json(), { questions: [] }); // older progress without questions
console.log('✓ worker questions ok');
