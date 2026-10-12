import assert from 'node:assert/strict';
import { createEmptyCard } from 'ts-fsrs';
import { MAX_ATTEMPTS, mergeAttempts, mergeProgress } from '../src/merge.ts';

const att = (id: string, t: number) => ({ id, k: 'x/1', p: 0, ok: 1 as const, h: 0 as const, ms: 900, t, m: 'd' as const });
const t0 = new Date('2026-01-01'), t1 = new Date('2026-01-02');
const card = (last?: Date) => ({ ...createEmptyCard(t0), last_review: last, reps: last ? 1 : 0 });
const a = { learned: { 'x/1': true as const }, cards: { 'x/1': card(t0), 'x/2': card(t1) }, bestCombo: 2, attempts: [att('a', 1), att('s', 2)], xp: { '2026-03-01': 10, '2026-03-02': 4 }, badges: { 'first-points': '2026-03-02' }, shelf: { bird: { on: true, t: 10 }, modern: { on: true, t: 5 } }, flags: { 'x/1#2': { on: true, t: 4 }, 'x/1#4': { on: true, t: 9 } } };
const b = { learned: { 'x/2': true as const }, cards: { 'x/1': card(t1), 'x/2': card(t0), 'y/1': card() }, bestCombo: 5, attempts: [att('s', 2), att('b', 3)], xp: { '2026-03-01': 7, '2026-03-03': 5 }, badges: { 'first-points': '2026-03-01', 'streak-3': '2026-03-03' }, shelf: { bird: { on: false, t: 20 }, modern: { on: false, t: 1 } }, flags: { 'x/1#2': { on: true, t: 3 }, 'x/1#4': { on: false, t: 12 } } };
const m = mergeProgress(a, b);
assert.deepEqual(Object.keys(m.learned).sort(), ['x/1', 'x/2']);
assert.equal(m.cards['x/1'].last_review, t1);   // b reviewed later
assert.equal(m.cards['x/2'].last_review, t1);   // a reviewed later
assert.ok(m.cards['y/1']);                      // only in b
assert.equal(m.bestCombo, 5);
assert.deepEqual(m.xp, { '2026-03-01': 10, '2026-03-02': 4, '2026-03-03': 5 });   // per-day max: the same day on two devices is not added twice
assert.deepEqual(m.badges, { 'first-points': '2026-03-01', 'streak-3': '2026-03-03' }); // union, earliest date wins
assert.deepEqual(m.shelf, { bird: { on: false, t: 20 }, modern: { on: true, t: 5 } }); // newest change per opening wins
assert.deepEqual(m.flags, { 'x/1#2': { on: true, t: 4 }, 'x/1#4': { on: false, t: 12 } }); // a flag cleared later on another device stays cleared
assert.deepEqual(mergeProgress(a, { ...b, shelf: undefined as never, flags: undefined as never }).flags, a.flags);
assert.deepEqual(mergeProgress(a, { ...b, shelf: undefined as never }).shelf, a.shelf); // older synced copies have no shelf
assert.deepEqual(m.attempts.map(x => x.id), ['a', 's', 'b']); // union by id, oldest first
const many = Array.from({ length: MAX_ATTEMPTS + 10 }, (_, i) => att('n' + i, i));
const capped = mergeAttempts(many, []);
assert.equal(capped.length, MAX_ATTEMPTS);
assert.equal(capped[0].id, 'n10');            // oldest dropped
console.log('✓ merge ok');
