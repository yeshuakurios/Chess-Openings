import { Chess } from 'chess.js';
import { listContentFiles, loadOpening } from './shared.ts';

let errors = 0;
const fail = (file: string, msg: string) => { errors++; console.error(`✗ ${file}: ${msg}`); };

for (const file of listContentFiles()) {
  const o = loadOpening(file);
  const name = o.id ?? file;
  for (const k of ['id', 'name', 'color', 'summary', 'status'] as const) if (!o[k]) fail(name, `missing ${k}`);
  if (!o.goal?.text || !o.goal.plans?.length) fail(name, 'missing goal text/plans');
  if (!o.variations?.length) fail(name, 'no variations');
  const ids = new Set<string>();
  for (const v of o.variations ?? []) {
    const tag = `${name}/${v.id}`;
    if (ids.has(v.id)) fail(tag, 'duplicate variation id');
    ids.add(v.id);
    if (!v.strategy || !v.name) fail(tag, 'missing name/strategy');
    const chess = new Chess();
    v.moves.forEach((m, i) => {
      try { chess.move(m.san); } catch { fail(tag, `illegal move ${i + 1}: ${m.san}`); return; }
      if (!m.note) fail(tag, `ply ${i + 1} (${m.san}) has no note`);
      if (process.argv.includes('--require-evals') && typeof m.eval !== 'number') fail(tag, `ply ${i + 1} has no eval`);
    });
  }
}
if (errors) { console.error(`\n${errors} problem(s)`); process.exit(1); }
console.log('✓ content valid');
