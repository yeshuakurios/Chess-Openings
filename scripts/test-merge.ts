import assert from 'node:assert/strict';
import { createEmptyCard } from 'ts-fsrs';
import { mergeProgress } from '../src/merge.ts';

const t0 = new Date('2026-01-01'), t1 = new Date('2026-01-02');
const card = (last?: Date) => ({ ...createEmptyCard(t0), last_review: last, reps: last ? 1 : 0 });
const a = { learned: { 'x/1': true as const }, cards: { 'x/1': card(t0), 'x/2': card(t1) }, bestCombo: 2 };
const b = { learned: { 'x/2': true as const }, cards: { 'x/1': card(t1), 'x/2': card(t0), 'y/1': card() }, bestCombo: 5 };
const m = mergeProgress(a, b);
assert.deepEqual(Object.keys(m.learned).sort(), ['x/1', 'x/2']);
assert.equal(m.cards['x/1'].last_review, t1);   // b reviewed later
assert.equal(m.cards['x/2'].last_review, t1);   // a reviewed later
assert.ok(m.cards['y/1']);                      // only in b
assert.equal(m.bestCombo, 5);
console.log('✓ merge ok');
