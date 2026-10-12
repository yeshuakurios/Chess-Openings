import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Chess } from 'chess.js';
import { listContentFiles, loadOpening, type Shape } from './shared.ts';

const SQUARE = /^[a-h][1-8]$/;
const COLORS = new Set(['green', 'red', 'blue', 'yellow']);
/** Move notation (Nf3, Bb2, O-O, e5, 3...) must not appear in the plain-language goal and strategy text; shapes on the board show the squares instead. */
const NOTATION = /\b([NBRQK][a-h]?[1-8]?x?[a-h][1-8]|O-O(-O)?|[a-h]x?[a-h]?[1-8]|\d+\.{1,3})(?![a-z])/;
let errors = 0;
const fail = (file: string, msg: string) => { errors++; console.error(`✗ ${file}: ${msg}`); };

for (const file of listContentFiles()) {
  const o = loadOpening(file);
  const name = o.id ?? file;
  for (const k of ['id', 'name', 'color', 'summary', 'status'] as const) if (!o[k]) fail(name, `missing ${k}`);
  if (!o.goal?.text || !o.goal.plans?.length) fail(name, 'missing goal text/plans');
  if (!o.variations?.length) fail(name, 'no variations');
  const plain = (where: string, text: string) => { const m = NOTATION.exec(text); if (m) fail(where, `plain-language text contains notation "${m[0]}": ${text.slice(0, 60)}`); };
  plain(`${name}/summary`, o.summary ?? '');
  plain(`${name}/goal`, `${o.goal?.title} ${o.goal?.text}`);
  (o.goal?.plans ?? []).forEach(p => plain(`${name}/goal plan`, p));
  const checkShapes = (where: string, shapes: Shape[] = []) => shapes.forEach(sh => {
    if (!SQUARE.test(sh.from) || (sh.to !== undefined && !SQUARE.test(sh.to))) fail(where, `bad shape square ${sh.from}${sh.to ?? ''}`);
    if (sh.to === sh.from) fail(where, `arrow from and to are the same square ${sh.from}`);
    if (sh.color && !COLORS.has(sh.color)) fail(where, `bad shape color ${sh.color}`);
  });
  const gb = o.goal?.board;
  if (gb) {
    const gv = o.variations?.find(v => v.id === gb.variation);
    if (!gv) fail(`${name}/goal board`, `unknown variation ${gb.variation}`);
    else if (!Number.isInteger(gb.ply) || gb.ply < 0 || gb.ply > gv.moves.length) fail(`${name}/goal board`, `ply ${gb.ply} out of range`);
    checkShapes(`${name}/goal board`, gb.shapes);
  }
  const ids = new Set<string>();
  for (const v of o.variations ?? []) {
    const tag = `${name}/${v.id}`;
    if (ids.has(v.id)) fail(tag, 'duplicate variation id');
    ids.add(v.id);
    if (!v.strategy || !v.name) fail(tag, 'missing name/strategy');
    plain(`${tag}/strategy`, v.strategy ?? '');
    if (v.board) {
      if (!Number.isInteger(v.board.ply) || v.board.ply < 0 || v.board.ply > v.moves.length) fail(tag, `board ply ${v.board.ply} out of range`);
      checkShapes(`${tag} board`, v.board.shapes);
    }
    const chess = new Chess();
    v.moves.forEach((m, i) => {
      for (const w of Object.keys(m.why ?? {})) {
        const legal = chess.moves();
        if (!legal.includes(w) || w === m.san) fail(tag, `ply ${i + 1}: why["${w}"] is not a legal alternative to ${m.san}`);
      }
      const userPly = (i % 2 === 0) === (o.color === 'white');
      if ((m.mistakes || m.versus) && !userPly) fail(tag, `ply ${i + 1}: mistakes/versus belong on the trained side's moves`);
      // The text must never name the line's own move: Drill shows it right after a wrong move.
      const bare = m.san.replace(/[+#]/g, '');
      const names = (t: string) => new RegExp(`(?<![A-Za-z0-9])${bare.replace(/[-]/g, '\\-')}(?![A-Za-z0-9])`).test(t);
      const seen = new Set<string>();
      for (const x of m.mistakes ?? []) {
        const at = `${tag} ply ${i + 1} mistake ${x.san}`;
        if (seen.has(x.san)) fail(at, 'duplicate mistake');
        seen.add(x.san);
        if (!chess.moves().includes(x.san) || x.san === m.san) { fail(at, `not a legal alternative to ${m.san}`); continue; }
        if (!x.text || x.text.length > 200) fail(at, 'text missing or longer than 200 characters (the message card is small)');
        if (names(x.text)) fail(at, `text names the line's own move ${m.san}`);
        if (!Array.isArray(x.line) || x.line.length < 1 || x.line.length > 6) fail(at, 'line must have 1-6 plies');
        const c = new Chess(chess.fen());
        try { c.move(x.san); (x.line ?? []).forEach(s => c.move(s)); } catch { fail(at, `illegal move in line: ${x.san} ${(x.line ?? []).join(' ')}`); }
        if (process.argv.includes('--require-evals') && typeof x.eval !== 'number') fail(at, 'no eval');
      }
      for (const x of m.versus ?? []) {
        const at = `${tag} ply ${i + 1} versus ${x.line}`;
        const sib = o.variations.find(w => w.id === x.line);
        if (!sib || sib.id === v.id) { fail(at, 'unknown or same variation'); continue; }
        // "similar position": the identical position, or the same moves except the opponent's previous reply, and then a different move from us
        const upTo = (n: number) => v.moves.slice(0, n).every((q, k) => sib.moves[k]?.san === q.san);
        const same = !!sib.moves[i] && sib.moves[i].san !== m.san && (upTo(i) || (i >= 1 && upTo(i - 1) && sib.moves[i - 1].san !== v.moves[i - 1].san));
        if (!same) fail(at, 'is not a near-identical position with a different move');
        if (!x.text || x.text.length > 175) fail(at, 'text missing or longer than 175 characters (it shares the message card with the move note)');
        if (names(x.text)) fail(at, `text names the line's own move ${m.san}`);
      }
      try { chess.move(m.san); } catch { fail(tag, `illegal move ${i + 1}: ${m.san}`); return; }
      if (!m.note) fail(tag, `ply ${i + 1} (${m.san}) has no note`);
      checkShapes(`${tag} ply ${i + 1}`, m.shapes);
      if (process.argv.includes('--require-evals') && typeof m.eval !== 'number') fail(tag, `ply ${i + 1} has no eval`);
    });
  }
}
// answers written by the daily review: { questionId: { a, t } }
try {
  const answers = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'src', 'answers.json'), 'utf8')) as Record<string, { a?: unknown; t?: unknown }>;
  for (const [id, x] of Object.entries(answers)) if (typeof x?.a !== 'string' || !x.a.trim() || typeof x.t !== 'number') fail('answers.json', `answer ${id} needs a text "a" and a time "t"`);
} catch { fail('answers.json', 'missing or not valid JSON'); }
if (errors) { console.error(`\n${errors} problem(s)`); process.exit(1); }
console.log('✓ content valid');
