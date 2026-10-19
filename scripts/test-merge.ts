import assert from 'node:assert/strict';
import { createEmptyCard } from 'ts-fsrs';
import { MAX_ATTEMPTS, mergeAttempts, mergeProgress } from '../src/merge.ts';

const att = (id: string, t: number) => ({ id, k: 'x/1', p: 0, ok: 1 as const, h: 0 as const, ms: 900, t, m: 'd' as const });
const t0 = new Date('2026-01-01'), t1 = new Date('2026-01-02');
const card = (last?: Date) => ({ ...createEmptyCard(t0), last_review: last, reps: last ? 1 : 0 });
const a = { learned: { 'x/1': true as const }, cards: { 'x/1': card(t0), 'x/2': card(t1) }, bestCombo: 2, attempts: [att('a', 1), att('s', 2)], xp: { '2026-03-01': 10, '2026-03-02': 4 }, badges: { 'first-points': '2026-03-02' }, flags: { 'x/1#2': 100, 'x/1#4': 50 }, flagsClearedAt: 0, questions: [{ id: 'q1', t: 1, q: 'Why?' }, { id: 'q2', t: 3, q: 'And this?', k: 'x/1#2' }] };
const b = { learned: { 'x/2': true as const }, cards: { 'x/1': card(t1), 'x/2': card(t0), 'y/1': card() }, bestCombo: 5, attempts: [att('s', 2), att('b', 3)], xp: { '2026-03-01': 7, '2026-03-03': 5 }, badges: { 'first-points': '2026-03-01', 'streak-3': '2026-03-03' }, flags: { 'x/2#0': 200 }, flagsClearedAt: 60, questions: [{ id: 'q2', t: 3, q: 'And this?', k: 'x/1#2' }, { id: 'q3', t: 2, q: 'Third' }] };
const m = mergeProgress(a, b);
assert.deepEqual(Object.keys(m.learned).sort(), ['x/1', 'x/2']);
assert.equal(m.cards['x/1'].last_review, t1);   // b reviewed later
assert.equal(m.cards['x/2'].last_review, t1);   // a reviewed later
assert.ok(m.cards['y/1']);                      // only in b
assert.equal(m.bestCombo, 5);
assert.deepEqual(m.xp, { '2026-03-01': 10, '2026-03-02': 4, '2026-03-03': 5 });   // per-day max: the same day on two devices is not added twice
assert.deepEqual(m.badges, { 'first-points': '2026-03-01', 'streak-3': '2026-03-03' }); // union, earliest date wins
assert.deepEqual(m.attempts.map(x => x.id), ['a', 's', 'b']); // union by id, oldest first
assert.deepEqual(m.flags, { 'x/1#2': 100, 'x/2#0': 200 }); // union; the clear at 60 removed the older flag from the other device
assert.equal(m.flagsClearedAt, 60);
assert.deepEqual(m.questions.map(x => x.id), ['q1', 'q3', 'q2']); // union by id, oldest first, no duplicate of q2
const many = Array.from({ length: MAX_ATTEMPTS + 10 }, (_, i) => att('n' + i, i));
const capped = mergeAttempts(many, []);
assert.equal(capped.length, MAX_ATTEMPTS);
assert.equal(capped[0].id, 'n10');            // oldest dropped
// imported chess.com games: the newer import wins, including an empty one that restores the hand-written mistakes
const imp = (at: number, n: number) => ({ user: 'me', at, games: n, left: 0, kept: 0, mistakes: [] });
assert.equal(mergeProgress({ ...a, games: imp(1, 1) }, { ...b, games: imp(2, 2) }).games?.games, 2);
assert.equal(mergeProgress({ ...a, games: imp(5, 1) }, { ...b, games: imp(2, 2) }).games?.games, 1);
assert.equal(mergeProgress({ ...a, games: imp(1, 1) }, b).games?.games, 1);
assert.equal(mergeProgress(a, b).games, undefined);
console.log('✓ merge ok');
