import assert from 'node:assert/strict';
import { flagKey, flagReport, splitFlagKey } from '../src/flags.ts';
import type { Opening, Variation } from '../src/types.ts';

const mv = (san: string, note: string) => ({ san, note, eval: 0 });
const v: Variation = { id: 'main', name: 'Main line', strategy: '', moves: [mv('f4', 'Take space.'), mv('d5', 'Black builds a center.'), mv('Nf3', 'Develop and guard e5.')] };
const o: Opening = { id: 'bird', name: "Bird's Opening", color: 'white', summary: '', status: 'draft', goal: { title: '', text: '', plans: [] }, variations: [v] };
const lookup = (k: string): [Opening, Variation] | undefined => (k === 'bird/main' ? [o, v] : undefined);

assert.equal(flagKey('bird/main', 2), 'bird/main#2');
assert.deepEqual(splitFlagKey('bird/main#2'), ['bird/main', 2]);
assert.equal(flagReport({}, lookup), '');
assert.equal(flagReport({ 'bird/main#2': { on: false, t: 1 } }, lookup), '');                 // switched off: not listed
const text = flagReport({ 'bird/main#2': { on: true, t: 1 }, 'bird/main#0': { on: true, t: 2 }, 'gone/x#1': { on: true, t: 3 } }, lookup);
assert.match(text, /^Moves that need more explanation \(3\)/);
assert.match(text, /Bird's Opening: Main line \(bird\/main\)\n- 1\. f4: Take space\.\n- 2\. Nf3: Develop and guard e5\./); // moves in order, with today's note
assert.match(text, /\ngone\/x\n- move index 1/);                                                  // a line that no longer exists is still reported
console.log('✓ flags ok');
