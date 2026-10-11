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
      try { chess.move(m.san); } catch { fail(tag, `illegal move ${i + 1}: ${m.san}`); return; }
      if (!m.note) fail(tag, `ply ${i + 1} (${m.san}) has no note`);
      checkShapes(`${tag} ply ${i + 1}`, m.shapes);
      if (process.argv.includes('--require-evals') && typeof m.eval !== 'number') fail(tag, `ply ${i + 1} has no eval`);
    });
  }
}
if (errors) { console.error(`\n${errors} problem(s)`); process.exit(1); }
console.log('✓ content valid');
