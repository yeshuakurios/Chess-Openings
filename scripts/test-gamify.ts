import assert from 'node:assert/strict';
import { BADGES, DAILY_GOAL, TITLES, earnedNow, levelFor, streaks, totalXp, xpForAttempt } from '../src/gamify.ts';

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

// levels
assert.deepEqual(levelFor(0), { n: 1, title: 'Pawn Pusher', into: 0, span: 150, next: 'Gambit Rookie' });
assert.equal(levelFor(149).n, 1);
assert.equal(levelFor(150).title, 'Gambit Rookie');
assert.deepEqual(levelFor(200), { n: 2, title: 'Gambit Rookie', into: 50, span: 250, next: 'Coffeehouse Hustler' });
assert.deepEqual(levelFor(99_999), { n: TITLES.length, title: 'World Champion', into: 99_999 - 50000, span: 0 });
for (let i = 2; i < TITLES.length; i++) assert.ok(TITLES[i].xp - TITLES[i - 1].xp > TITLES[i - 1].xp - TITLES[i - 2].xp, 'each level costs more than the last');
assert.equal(new Set(TITLES.map(t => t.title)).size, TITLES.length);
console.log('✓ gamify ok');
