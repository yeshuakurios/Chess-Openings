import assert from 'node:assert/strict';
import { buildMessages, cacheKey, cleanAnswer, extractText, parseFacts, type ExplainFacts } from '../src/explainShared.ts';

const facts: ExplainFacts = { opening: 'Budapest Gambit', line: '4.Bf4: Rubinstein variation', plan: 'Give a pawn for quick piece play, then win it back',
  side: 'black', moveNumber: 5, kind: 'other-line', played: 'Ngxe5', wrong: 2, hints: 0, slow: 1,
  rule: 'Ngxe5 is the move in the "4.Nf3: Adler variation" line, but this line goes differently here. Check which reply you are facing.' };

// parsing: good input round-trips, bad input throws
assert.deepEqual(parseFacts(JSON.parse(JSON.stringify(facts))), facts);
for (const bad of [null, 'x', { ...facts, kind: 'nope' }, { ...facts, side: 'green' }, { ...facts, wrong: -1 }, { ...facts, wrong: 1.5 }, { ...facts, rule: 'x'.repeat(401) }, { ...facts, played: 5 }])
  assert.throws(() => parseFacts(bad), Error);
const noMove: Partial<ExplainFacts> = { ...facts }; delete noMove.played;
assert.equal(parseFacts(noMove).played, undefined);

// prompt carries the facts and never a correct-move field
const msgs = buildMessages(facts);
assert.equal(msgs[0].role, 'system');
assert.ok(msgs[1].content.includes('Ngxe5') && msgs[1].content.includes('Rubinstein'));
assert.ok(!/correct move:|best move:/i.test(msgs[1].content));

// answer filter
const ok = 'That move belongs to the other Budapest line, so here you should check which reply White chose before playing Ngxe5.';
assert.equal(cleanAnswer(ok, 'Ngxe5'), ok);
assert.equal(cleanAnswer('**' + ok + '**', 'Ngxe5'), ok);                          // markdown stripped
assert.equal(cleanAnswer(ok.replace('Ngxe5', 'Bb4+'), 'Ngxe5'), null);              // names a different move
assert.equal(cleanAnswer('You should have played e3 here, which controls the center.', 'Ngxe5'), null);
assert.equal(cleanAnswer('After 5. something the plan changes and you need to look at the reply again.', 'Ngxe5'), null);  // move number
assert.equal(cleanAnswer('Too short.', 'Ngxe5'), null);
assert.equal(cleanAnswer('x '.repeat(200), 'Ngxe5'), null);
assert.equal(cleanAnswer(undefined, 'Ngxe5'), null);
assert.equal(cleanAnswer('You needed the hint here, so go back over the plan and try this position again from memory.', undefined) !== null, true);

// both response shapes
assert.equal(extractText({ response: 'a' }), 'a');
assert.equal(extractText({ choices: [{ message: { content: 'b' } }] }), 'b');
assert.equal(extractText({}), undefined);
assert.equal(extractText(null), undefined);

// cache key: stable, and sensitive to facts and model
const k1 = await cacheKey(facts, 'm1');
assert.equal(k1, await cacheKey({ ...facts }, 'm1'));
assert.notEqual(k1, await cacheKey({ ...facts, wrong: 3 }, 'm1'));
assert.notEqual(k1, await cacheKey(facts, 'm2'));
assert.match(k1, /^[0-9a-f]{64}$/);
console.log('✓ explain ok');
