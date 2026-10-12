import assert from 'node:assert/strict';
import { unanswered } from './unanswered.ts';

const fetched = { questions: [{ id: 'b', t: 2, q: 'Second' }, { id: 'a', t: 1, q: 'First', k: 'bird/main-d5#1' }, { id: 'c', t: 3, q: 'Done already' }, { id: 5, t: 1, q: 'bad' }, null] };
assert.deepEqual(unanswered(fetched, { c: { a: 'x', t: 1 } }).map(x => x.id), ['a', 'b']);   // oldest first, answered and malformed dropped
assert.deepEqual(unanswered({}, {}), []);
assert.deepEqual(unanswered({ questions: 'nope' }, {}), []);
console.log('✓ unanswered ok');
