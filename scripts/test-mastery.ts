import assert from 'node:assert/strict';
import { createEmptyCard } from 'ts-fsrs';
import { lineMastery, hadSpotCheckToday, pickSpotCheck, positionState, userPositions } from '../src/mastery.ts';
import type { Attempt } from '../src/store.ts';

const DAY = 24 * 3600_000, T0 = new Date('2026-03-01T12:00:00').getTime();
let n = 0;
const att = (p: number, dayOffset: number, o: Partial<Attempt> = {}): Attempt =>
  ({ id: 'a' + n++, k: 'x/1', p, ok: 1, h: 0, ms: 2000, t: T0 + dayOffset * DAY, m: 'd', ...o });
const LEN = 8, WHITE = 'white' as const;               // white positions: 0,2,4,6
const POS = userPositions(LEN, WHITE);
assert.deepEqual(POS, [0, 2, 4, 6]);
assert.deepEqual(userPositions(LEN, 'black'), [1, 3, 5, 7]);
const clean = (day: number, extra: Partial<Attempt> = {}) => POS.map(p => att(p, day, extra));
const card = (stability: number) => ({ ...createEmptyCard(new Date(T0)), stability, reps: 3 });
const level = (a: Attempt[], c?: ReturnType<typeof card>) => lineMastery('x/1', WHITE, LEN, a, c).level;

assert.equal(level([]), 'New');
assert.equal(level([att(0, 0, { ok: 0 }), att(0, 0.001), ...POS.slice(1).map(p => att(p, 0))]), 'Learning'); // a wrong move at one position
assert.equal(level(clean(0)), 'Familiar');
assert.equal(level([...clean(0), ...clean(1)], card(8)), 'Solid');
assert.equal(level([...clean(0), ...clean(1)], card(3)), 'Familiar');            // not stable enough yet
assert.equal(level([...clean(0), ...clean(0.2)], card(30)), 'Familiar');         // same day does not count twice
assert.equal(level([...clean(0), ...clean(1), ...clean(2)], card(30)), 'Solid'); // needs out-of-order recall
const ooo = (day: number) => POS.slice(0, 2).map(p => att(p, day, { o: 1 }));
assert.equal(level([...clean(0), ...clean(1), ...clean(2), ...ooo(3)], card(30)), 'Mastered');
// hint and slow moves are not clean
assert.equal(positionState([att(0, 0, { h: 1 })]).score, 0);
assert.equal(positionState([att(0, 0, { ms: 20000 })]).score, 0);
// soft slip: one wrong move at one position takes one day off that position only
const slip = [att(4, 3, { ok: 0 }), att(4, 3.001)];
const after = lineMastery('x/1', WHITE, LEN, [...clean(0), ...clean(1), ...clean(2), ...ooo(3), ...slip], card(30));
assert.equal(after.states.get(4)!.score, 2);   // three clean days, minus one for the slip
assert.equal(after.states.get(6)!.score, 3);   // other positions untouched
assert.equal(after.level, 'Solid');                                              // lowered, not reset
// a slip does not push the score below zero, and a later clean day counts again
assert.equal(positionState([att(0, 0, { ok: 0 }), att(0, 0.001)]).score, 0);
assert.equal(positionState([att(0, 0), att(0, 1, { ok: 0 }), att(0, 1.001), att(0, 2)]).score, 1);
// spot checks
const m = lineMastery('x/1', WHITE, LEN, [...clean(0), ...ooo(1)], card(8));
assert.ok([4, 6].includes(pickSpotCheck(m, () => 0)!));                          // prefers positions never recalled from the middle
assert.equal(pickSpotCheck(lineMastery('x/1', WHITE, 1, [], undefined)), undefined);
assert.ok(hadSpotCheckToday('x/1', ooo(0), T0 + 1000));
assert.ok(!hadSpotCheckToday('x/1', ooo(0), T0 + 3 * DAY));
console.log('✓ mastery ok');
