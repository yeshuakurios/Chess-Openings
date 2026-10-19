import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { gradeMove, gradeText, posKey, type GradeTable } from '../src/grade.ts';
import { grades } from '../src/gradeData.ts';
import { gameMistakeText, mistakesAt, type GameImport, type GameMistake } from '../src/games.ts';
import { listContentFiles, loadOpening } from './shared.ts';

const start = new Chess().fen();
const table: GradeTable = { [posKey(start)]: { b: ['e4', 0.3], m: { e4: [0.3, 'e5'], d4: [0.2, 'd5'], a3: [-0.1, 'e5'], f3: [-0.9, 'e5'], f4: [-0.4, 'd5'], g4: [-2.5, 'd5'] } } };
// White's side: the engine's best is +0.3
assert.equal(gradeMove(table, start, 'e4', 'white')!.grade, 'good');
assert.equal(gradeMove(table, start, 'd4', 'white')!.grade, 'good');
assert.equal(gradeMove(table, start, 'f4', 'white')!.grade, 'inaccuracy');
assert.equal(gradeMove(table, start, 'f3', 'white')!.grade, 'mistake');
assert.equal(gradeMove(table, start, 'g4', 'white')!.grade, 'blunder');
assert.equal(gradeMove(table, start, 'h5', 'white'), undefined, 'a move that is not in the table');
assert.equal(gradeMove(table, 'nonsense w - -', 'e4', 'white'), undefined, 'a position that is not in the table');
const g4 = gradeMove(table, start, 'g4', 'white')!;
assert.equal(g4.mark, '??'); assert.ok(Math.abs(g4.loss - 2.8) < 1e-9); assert.equal(g4.reply, 'd5'); assert.equal(g4.mine, -2.5); assert.equal(g4.eval, -2.5);
// Black's side: signs flip (the same table row read for Black: +0.3 for White is -0.3 for Black)
const bk = gradeMove(table, start, 'g4', 'black')!;
assert.equal(bk.grade, 'good', 'a move that is better for Black than the best is never a loss');
assert.equal(bk.loss, 0);
// text names the move played and the engine's reply, never anything else from the table
const t = gradeText(g4, 'g4');
assert.ok(t.includes('Blunder') && t.includes('2.8 pawns') && t.includes('d5') && t.includes('-2.5'));
assert.ok(!t.includes('e4'), 'must not name the best move');
assert.ok(gradeText(gradeMove(table, start, 'd4', 'white')!, 'd4').includes('leaves your line'));
// game mistakes get graded text, a mark and the eval for the bar
const mk = (s: string): GameMistake => ({ k: 'x/y', f: posKey(start), p: 0, s, n: 2, w: 1, d: 0, l: 1, line: ['d5'], t: 1 });
const imp: GameImport = { user: 'me', at: 1, last: 1, games: 2, left: 2, kept: 0, mistakes: [mk('g4'), mk('d4')] };
const out = mistakesAt(imp, 'x/y', 0, undefined, 'white', table);
assert.equal(out[0].mark, '??'); assert.equal(out[0].eval, -2.5); assert.ok(out[0].text.includes('Blunder') && out[0].text.includes('1 won, 0 drawn, 1 lost'));
assert.equal(out[1].mark, ''); assert.equal(out[1].eval, 0.2);
assert.ok(!gameMistakeText(mk('g4'), gradeMove(table, start, 'g4', 'white')).includes('e4'));
assert.equal(mistakesAt(imp, 'x/y', 0, undefined, undefined, table)[0].mark, undefined, 'no side given: plain text');
// the generated table covers every position where the trained side moves in the content, and every line move is in it
let positions = 0;
for (const f of listContentFiles()) {
  const o = loadOpening(f);
  for (const v of o.variations) {
    const c = new Chess();
    for (const [i, m] of v.moves.entries()) {
      if ((i % 2 === 0) === (o.color === 'white')) {
        const e = grades[posKey(c.fen())]; positions++;
        assert.ok(e, `no grades for ${o.id}/${v.id} move ${i + 1}: run npm run grades`);
        assert.ok(e.m[m.san], `line move ${m.san} missing in ${o.id}/${v.id}`);
        assert.equal(Object.keys(e.m).length, c.moves().length, 'every legal move is graded');
      }
      c.move(m.san);
    }
  }
}
console.log(`✓ grade ok (${positions} positions covered)`);
