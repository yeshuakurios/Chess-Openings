import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { explainMistake } from '../src/mistakestory.ts';
import { grades } from '../src/gradeData.ts';
import { posKey } from '../src/grade.ts';
import { listContentFiles, loadOpening } from './shared.ts';
import type { Opening } from '../src/types.ts';

const all = listContentFiles().map(f => loadOpening(f)) as unknown as Opening[];
const bird = all.find(o => o.id === 'bird')!, v = bird.variations.find(x => x.id === 'main-d5')!;
const ply = 4, lineSan = v.moves[ply].san;
const s = explainMistake(bird, v, ply, 'f5')!;
assert.ok(s, 'story built');
assert.equal(s.before.join(' '), v.moves.slice(0, ply).map(m => m.san).join(' '), 'all moves up to the mistake');
assert.equal(s.played.san, 'f5'); assert.equal(s.played.from, 'f4'); assert.equal(s.played.to, 'f5'); assert.equal(s.played.piece, 'p');
assert.equal(s.better.move.san, lineSan, 'the line move is what to play instead');
assert.equal(s.grade?.grade, 'blunder');
assert.ok(s.reasons.length >= 1 && s.reasons.every(r => r.squares.length >= 1), 'every reason has squares to ring');
assert.ok(s.after.reply, "the engine's reply is known");
assert.ok(s.after.mine !== undefined && s.after.line !== undefined && s.after.mine < s.after.line, 'the move lost eval against the line');
assert.ok(s.after.threatened.every(q => /^[a-h][1-8]$/.test(q)));
// a capture reason: take a defended pawn at the first chance the position offers one
let found = 0;
for (const o of all) for (const w of o.variations) {
  const c = new Chess();
  for (const [i, m] of w.moves.entries()) {
    if ((i % 2 === 0) === (o.color === 'white')) {
      const cap = c.moves({ verbose: true }).find(x => x.captured && x.san !== m.san);
      if (cap && grades[posKey(c.fen())]?.m[cap.san]) {
        const st = explainMistake(o, w, i, cap.san)!;
        assert.ok(st, `story for ${o.id}/${w.id} ${cap.san}`);
        assert.ok(st.reasons.some(r => r.kind === 'capture'), 'a capture is labelled as one');
        assert.deepEqual(st.reasons.find(r => r.kind === 'capture')!.squares, [cap.to]);
        found++; break;
      }
    }
    c.move(m.san);
  }
  if (found >= 3) break;
}
assert.ok(found >= 1, 'found a capture case');
// no engine data for the position: the story still builds, without evals
const none = explainMistake(bird, v, ply, 'f5', {})!;
assert.ok(none && none.after.mine === undefined && none.grade === undefined && none.after.reply === undefined);
// a move that is not legal there, or a ply past the line: no story
assert.equal(explainMistake(bird, v, ply, 'Qh8'), undefined);
assert.equal(explainMistake(bird, v, 99, 'f5'), undefined);
console.log('✓ mistake story ok');
