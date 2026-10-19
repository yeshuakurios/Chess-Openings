import assert from 'node:assert/strict';
import { Rating } from 'ts-fsrs';
import { FIX_DAYS, applyReview, dayOf, dueFixes, fixCounts, fixId, isOpen, mergeFixes, newFix, syncFixes, whenText } from '../src/fixes.ts';
import type { GameImport, GameMistake } from '../src/games.ts';

const DAY = 86_400_000, T0 = Date.UTC(2026, 9, 1, 12);
const gm = (o: Partial<GameMistake> = {}): GameMistake => ({ k: 'bird/main-d5', f: 'fen-a w - -', p: 4, s: 'f5', n: 1, w: 0, d: 0, l: 1, line: ['Bxf5'], t: T0 - 10 * DAY, ...o });
const imp = (mistakes: GameMistake[], recalls: GameImport['recalls'] = {}): GameImport => ({ user: 'me', at: 1, ver: 2, last: 1, games: 1, left: 1, kept: 0, mistakes, recalls });

// a new mistake becomes a card that is due right away; the same position in two lines is one card
const s1 = syncFixes({}, imp([gm(), gm({ k: 'bird/other' }), gm({ f: 'fen-b w - -', s: 'e4' })]), T0);
assert.equal(Object.keys(s1).length, 2);
const id = fixId(gm()), fx = s1[id];
assert.ok(isOpen(fx)); assert.equal(dueFixes(s1, T0).length, 2); assert.equal(whenText(fx, T0), 'Due now');
// mistakes without a position (an import from before grading) are skipped
assert.equal(Object.keys(syncFixes({}, imp([{ ...gm(), f: '' }]), T0)).length, 0);

// clean reviews on separate days clear it, but not before FIX_DAYS days and a long enough memory
let f = fx, now = T0, reviews = 0;
while (isOpen(f) && reviews < 12) { f = applyReview(f, Rating.Good, now); reviews++; now = Math.max(now + DAY, +f.card.due); }
assert.ok(!isOpen(f), 'cleared after clean reviews');
assert.ok(reviews >= FIX_DAYS && reviews <= 8, `cleared after ${reviews} clean reviews`);
assert.ok(f.card.stability >= 21 && f.days.length >= FIX_DAYS);
// two good answers on the same day are one clean day
const twice = applyReview(applyReview(fx, Rating.Good, T0), Rating.Good, T0 + 1000);
assert.equal(twice.days.length, 1);
// a slip takes a day off and brings the card back sooner than a good answer does
const good = applyReview(applyReview(fx, Rating.Good, T0), Rating.Good, T0 + DAY), slip = applyReview(good, Rating.Again, T0 + 2 * DAY);
assert.equal(slip.days.length, 1); assert.ok(+slip.card.due < +applyReview(good, Rating.Good, T0 + 2 * DAY).card.due);
assert.ok(isOpen(slip));
assert.equal(whenText({ ...fx, card: { ...fx.card, due: new Date(T0 + DAY) } }, T0), 'Back tomorrow');
assert.equal(whenText({ ...fx, card: { ...fx.card, due: new Date(T0 + 5 * DAY) } }, T0), 'Back in 5 days');
assert.equal(whenText({ ...fx, card: { ...fx.card, due: new Date(T0 + 600_000) } }, T0), 'Back later today');

// the mistake seen again in a newer game: a failed review while open, a fresh card once cleared
const again = syncFixes({ [id]: good }, imp([gm({ t: T0 + 3 * DAY })]), T0 + 4 * DAY);
assert.ok(again[id].gt === T0 + 3 * DAY && again[id].days.length < good.days.length, 'a repeat counts as a slip');
const reopened = syncFixes({ [id]: { ...f, clearedAt: T0 } }, imp([gm({ t: T0 + 3 * DAY })]), T0 + 4 * DAY);
assert.ok(isOpen(reopened[id]) && reopened[id].days.length === 0, 'a repeat reopens a cleared card');
// a re-import of the same games changes nothing
const same = syncFixes(s1, imp([gm(), gm({ f: 'fen-b w - -', s: 'e4' })]), T0 + DAY);
assert.deepEqual(Object.keys(same).sort(), Object.keys(s1).sort()); assert.equal(same[id].days.length, 0);
// later games in which the line's move was played at that position count as clean recalls
const later = syncFixes(s1, imp([gm()], { 'bird/main-d5#4': { ok: [dayOf(T0 - 5 * DAY), dayOf(T0 - 2 * DAY), dayOf(T0 - 12 * DAY)], bad: [] } }), T0);
assert.deepEqual(later[id].days, [dayOf(T0 - 5 * DAY), dayOf(T0 - 2 * DAY)], 'only days after the mistake count, oldest first');
assert.equal(later[id].gd, dayOf(T0 - 2 * DAY));
const again2 = syncFixes(later, imp([gm()], { 'bird/main-d5#4': { ok: [dayOf(T0 - 5 * DAY), dayOf(T0 - 2 * DAY)], bad: [] } }), T0);
assert.equal(again2[id].days.length, 2, 'the same recalls are not counted twice');
// the cap
const many = Array.from({ length: 130 }, (_, i) => gm({ f: `fen-${i} w - -`, s: 'a3' }));
assert.equal(Object.keys(syncFixes({}, imp(many), T0)).length, 100);
// counts and merge: the newer change per card wins
const c = fixCounts({ [id]: fx, x: { ...fx, id: 'x', clearedAt: T0 } }, T0);
assert.deepEqual(c, { open: 1, cleared: 1, due: 1 });
const m = mergeFixes({ [id]: fx }, { [id]: { ...fx, t: fx.t + 5, days: [1] }, y: { ...fx, id: 'y' } });
assert.equal(m[id].days.length, 1); assert.ok(m.y);
assert.deepEqual(mergeFixes({ [id]: { ...fx, t: fx.t + 9 } }, { [id]: fx })[id].t, fx.t + 9);
console.log('✓ fixes ok');
