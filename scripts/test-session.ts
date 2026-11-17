import assert from 'node:assert/strict';
import { DAILY_GOAL } from '../src/gamify.ts';
import { PRAISE, hasMilestone, isComboMark, newTally, praise, snapshot, summarize, tallyMove } from '../src/session.ts';

// combo
let t = newTally();
for (const a of [{ ok: 1, h: 0 }, { ok: 1, h: 0 }, { ok: 1, h: 1 }, { ok: 1, h: 0 }] as const) t = tallyMove(t, a);
assert.deepEqual(t, { moves: 4, right: 4, combo: 3, best: 3, xp: 7 }); // a hint keeps the combo but does not add to it
t = tallyMove(t, { ok: 0, h: 0 });
assert.equal(t.combo, 0); assert.equal(t.best, 3); assert.equal(t.xp, 7); assert.equal(t.right, 4);
assert.ok(isComboMark(5)); assert.ok(!isComboMark(4));

// summary
const day = '2026-03-10';
const xp0 = { '2026-03-09': 20, [day]: 40 }, xp1 = { '2026-03-09': 20, [day]: 240 };
const before = snapshot(xp0, ['first-points'], ['a/x'], 1, day);
const after = snapshot(xp1, ['first-points', 'daily-goal'], ['a/x', 'b/y'], 2, day);
const s = summarize(before, after, t, xp1, day);
assert.equal(s.xp, 200); assert.equal(s.accuracy, 80); assert.equal(s.best, 3);
assert.deepEqual(s.goal, { today: 240, target: DAILY_GOAL, reachedNow: true });
assert.equal(s.streak, 2);
assert.equal(s.level, 'Gambit Rookie'); // 60 -> 260 XP crosses 150
assert.deepEqual(s.badges, ['Daily goal']);
assert.deepEqual(s.mastered, ['b/y']);
assert.equal(s.cleared, 1);
assert.ok(hasMilestone(s));
const quiet = summarize(after, after, newTally(), xp1, day);
assert.equal(quiet.accuracy, undefined); assert.equal(quiet.level, undefined);
assert.ok(!quiet.goal.reachedNow); assert.ok(!hasMilestone(quiet));

// praise stays in range
assert.equal(praise(0), PRAISE[0]); assert.equal(praise(0.9999), PRAISE[PRAISE.length - 1]); assert.equal(praise(1), PRAISE[PRAISE.length - 1]);
console.log('✓ session ok');
