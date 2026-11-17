import assert from 'node:assert/strict';
import { nextBatch, type QueueItem } from './queue-lib.ts';
import { buildAskPrompt, notation } from '../src/askprompt.ts';
import { readFileSync } from 'node:fs';
import type { Opening } from '../src/types.ts';
const mk = (n: number, k = `o/v#${n}`, status: QueueItem['status'] = 'pending'): QueueItem => ({ id: String(n), k, prompt: '', status });
const q = [...Array.from({ length: 14 }, (_, i) => mk(i)), mk(99, 'o/v#0'), mk(98, 'o/v#20', 'done')];
assert.deepEqual(nextBatch(q).map(x => x.id), ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']); // 10, oldest first, no dup move, no done
assert.equal(nextBatch(q.slice(10)).length, 5); // items 10-13 plus 99, whose twin (0) is no longer in the list
const o: Opening = JSON.parse(readFileSync('content/bird.json', 'utf8')), v = o.variations[0];
assert.match(notation(v, 2), /^1\. \S+ \S+ 2\. \S+$/);
const p = buildAskPrompt(o, v, 1, '  why? ');
assert.ok(p.startsWith(`QUEUE explanation: ${o.id}/${v.id}#1`) && p.includes('My question: why?') && p.includes('/'));
console.log('✓ queue ok');
