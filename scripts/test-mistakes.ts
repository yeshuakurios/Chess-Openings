import assert from 'node:assert/strict';
import { explain, troubleSpots } from '../src/mistakes.ts';
import { listContentFiles, loadOpening } from './shared.ts';
import type { Attempt } from '../src/store.ts';
import type { Opening, Variation } from '../src/types.ts';

const all = listContentFiles().map(f => loadOpening(f)) as unknown as Opening[];
const op = (id: string) => all.find(o => o.id === id)!;
const va = (o: Opening, id: string) => o.variations.find(v => v.id === id)!;
let n = 0; const T = Date.now();
const att = (k: string, p: number, o: Partial<Attempt> = {}): Attempt => ({ id: 'm' + n++, k, p, ok: 0, h: 0, ms: 3000, t: T - 1000 * (100 - n), m: 'd', ...o });

// other line: Black plays the Adler move in the Rubinstein line (same point in the line, different earlier choice)
const bud = op('budapest-gambit'), rub = va(bud, 'bf4-rubinstein');
const e1 = explain(att('budapest-gambit/bf4-rubinstein', 9, { s: 'Ngxe5' }), bud, rub);
assert.equal(e1.kind, 'other-line');
assert.ok(e1.text.includes('Adler'));
// move order: a move that belongs later in the same line
const bird = op('bird'), main = va(bird, 'main-d5');
const e2 = explain(att('bird/main-d5', 4, { s: 'b3' }), bird, main);
assert.equal(e2.kind, 'move-order');
assert.ok(!e2.text.includes('e3'), 'must not name the line move');
// tactical: a capture that is not in the line
const por = op('portuguese-gambit'), nf3 = va(por, 'nf3-nxd5');
const e3 = explain(att('portuguese-gambit/nf3-nxd5', 7, { s: 'Qxd5' }), por, nf3);
assert.equal(e3.kind, 'tactical');
assert.ok(e3.text.startsWith("Qxd5 isn't part of this line."));
assert.ok(!e3.text.includes('Nxd5'), 'must not name the line move');
// plain wrong, hint, slow
assert.equal(explain(att('bird/main-d5', 0, { s: 'a3' }), bird, main).kind, 'other');
assert.equal(explain(att('bird/main-d5', 0, { ok: 1, h: 1 }), bird, main).kind, 'hint');
assert.equal(explain(att('bird/main-d5', 0, { ok: 1, ms: 30000 }), bird, main).kind, 'slow');
// no move recorded (older data): still gives an answer
assert.equal(explain(att('bird/main-d5', 0), bird, main).kind, 'other');

// trouble spots
const find = (k: string): [Opening, Variation] | undefined => { const [oid, vid] = k.split('/'); const o = all.find(x => x.id === oid); const v = o?.variations.find(x => x.id === vid); return o && v ? [o, v] : undefined; };
const clean = (k: string, p: number) => att(k, p, { ok: 1 });
const list = troubleSpots([
  att('bird/main-d5', 2, { s: 'e3' }), att('bird/main-d5', 2, { s: 'e3' }), att('bird/main-d5', 2, { ok: 1, h: 1 }),   // 3 problems at p2
  att('bird/main-d5', 4, { s: 'b3' }), clean('bird/main-d5', 4), clean('bird/main-d5', 4),                              // recovered
  att('bird/vs-nf6', 2, { s: 'e3' }),                                                                                  // 1 problem
  att('gone/none', 0, { s: 'e4' })                                                                                     // unknown line is skipped
], find, T);
assert.deepEqual(list.map(t => `${t.k}#${t.p}`), ['bird/main-d5#2', 'bird/vs-nf6#2']);
assert.equal(list[0].count, 2); assert.equal(list[0].hints, 1);
assert.equal(troubleSpots([att('bird/main-d5', 2, { t: T - 40 * 24 * 3600_000 })], find, T).length, 0); // too old
console.log('✓ mistakes ok');
