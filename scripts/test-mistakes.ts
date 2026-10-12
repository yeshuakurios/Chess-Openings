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
const plain = (o: Opening): Opening => ({ ...o, variations: o.variations.map(v => ({ ...v, moves: v.moves.map(({ mistakes: _m, versus: _v, ...m }) => m) })) }); // content without the hand-written texts
const bud = plain(op('budapest-gambit')), rub = va(bud, 'bf4-rubinstein');
const e1 = explain(att('budapest-gambit/bf4-rubinstein', 9, { s: 'Ngxe5' }), bud, rub);
assert.equal(e1.kind, 'other-line');
assert.ok(e1.text.includes('Adler'));
// hand-written texts win over the generic ones: a common mistake, and the contrast with the near-identical position of another line
const budFull = op('budapest-gambit'), e3l = va(budFull, 'e3-declined');
const e1a = explain(att('budapest-gambit/e3-declined', 5, { s: 'Ng4' }), budFull, e3l);
assert.equal(e1a.kind, 'tactical');
assert.ok(e1a.text.includes('queen'), 'uses the mistake text');
assert.ok(!e1a.text.includes('exd4'), 'must not name the line move');
const porFull = op('portuguese-gambit'), f3l = va(porFull, 'f3-bf5');
const e1b = explain(att('portuguese-gambit/f3-bf5', 7, { s: 'Nxd5' }), porFull, f3l);   // Nxd5 is the move of the 4.Nf3 line at this point
assert.equal(e1b.kind, 'tactical');
assert.ok(e1b.text.includes('4.Nf3'), 'uses the versus text');
assert.ok(!e1b.text.includes('Bf5'), 'must not name the line move');
// move order: a move that belongs later in the same line
const bird = op('bird'), main = va(bird, 'main-d5');
const e2 = explain(att('bird/main-d5', 4, { s: 'b3' }), bird, main);
assert.equal(e2.kind, 'move-order');
assert.ok(!e2.text.includes('e3'), 'must not name the line move');
// tactical: a capture that is not in the line
// (the opening is cut down to this one line so that adding sibling lines to the content never changes what this case tests)
const nf3 = va(op('portuguese-gambit'), 'nf3-nxd5'), por = { ...op('portuguese-gambit'), variations: [nf3] };
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
