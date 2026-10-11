import assert from 'node:assert/strict';
import { BADGES, DAILY_GOAL, earnedNow, streaks, totalXp, xpForAttempt } from '../src/gamify.ts';

assert.equal(xpForAttempt({ ok: 1, h: 0 }), 2);
assert.equal(xpForAttempt({ ok: 1, h: 1 }), 1);
assert.equal(xpForAttempt({ ok: 0, h: 0 }), 0);
assert.equal(totalXp({ a: 3, b: 4 }), 7);

// streaks
const days = (...d: string[]) => Object.fromEntries(d.map(x => [x, 5]));
assert.deepEqual(streaks({}, '2026-03-10'), { current: 0, best: 0 });
assert.deepEqual(streaks(days('2026-03-08', '2026-03-09', '2026-03-10'), '2026-03-10'), { current: 3, best: 3 });
assert.deepEqual(streaks(days('2026-03-08', '2026-03-09'), '2026-03-10'), { current: 2, best: 2 });   // today still open: streak alive
assert.deepEqual(streaks(days('2026-03-07', '2026-03-08'), '2026-03-10'), { current: 0, best: 2 });   // a missed day breaks it
assert.deepEqual(streaks(days('2026-03-01', '2026-03-02', '2026-03-03', '2026-03-05', '2026-03-06'), '2026-03-06'), { current: 2, best: 3 });
assert.deepEqual(streaks({ '2026-03-09': 0, '2026-03-10': 4 }, '2026-03-10'), { current: 1, best: 1 }); // zero-XP days do not count
assert.deepEqual(streaks(days('2026-02-28', '2026-03-01'), '2026-03-01'), { current: 2, best: 2 });    // across a month end

// badges
const ids = (s: Parameters<typeof earnedNow>[0]) => earnedNow(s);
assert.deepEqual(ids({ xp: {}, levels: ['New'] }), []);
assert.deepEqual(ids({ xp: { '2026-03-01': 3 }, levels: ['Learning'] }), ['first-points']);
assert.ok(ids({ xp: { '2026-03-01': DAILY_GOAL }, levels: [] }).includes('daily-goal'));
assert.ok(ids({ xp: days('2026-03-01', '2026-03-02', '2026-03-03'), levels: [] }).includes('streak-3'));
assert.ok(!ids({ xp: days('2026-03-01', '2026-03-02', '2026-03-04'), levels: [] }).includes('streak-3'));
assert.ok(ids({ xp: {}, levels: ['New', 'Solid'] }).includes('familiar'));                 // a higher level also earns the lower badges
assert.ok(ids({ xp: {}, levels: ['New', 'Solid'] }).includes('solid'));
assert.ok(!ids({ xp: {}, levels: ['Familiar'] }).includes('solid'));
assert.ok(ids({ xp: {}, levels: ['Mastered'] }).includes('mastered'));
assert.equal(new Set(BADGES.map(b => b.id)).size, BADGES.length);                           // unique ids
console.log('✓ gamify ok');
