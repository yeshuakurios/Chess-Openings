// Build-time only: runs Stockfish (Node) and writes src/grades.json: for every position where the trained side is to move in any line,
// the engine's eval (pawns, White's view) after EACH legal move, plus its best reply. The app uses it to grade any move the owner played
// (in a chess.com game or in Practice/Drill) without an engine at runtime. Positions already in the file are skipped, so a content change
// only costs the new positions. `npm run grades` (DEPTH=12 by default; the file is generated, never edited by hand).
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Chess } from 'chess.js';
import { listContentFiles, loadOpening } from './shared.ts';
import { posKey, type GradeTable } from '../src/grade.ts';

const DEPTH = Number(process.env.DEPTH ?? 12);
const OUT = join(import.meta.dirname, '..', 'src', 'grades.json');
const require = createRequire(import.meta.url);
const engine = require('stockfish')('lite-single', onLine);
let pvs = new Map<number, { cp: number; pv: string[] }>(); let done: (() => void) | null = null;
function onLine(line: string) {
  const m = /^info depth (\d+).* multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)$/.exec(line);
  if (m) pvs.set(Number(m[2]), { cp: m[3] === 'cp' ? Number(m[4]) : (Number(m[4]) > 0 ? 2000 : -2000), pv: m[5].split(' ') });
  if (line.startsWith('bestmove') && done) { const d = done; done = null; d(); }
}
const search = (fen: string, n: number) => new Promise<Map<number, { cp: number; pv: string[] }>>(res => {
  pvs = new Map(); done = () => res(pvs);
  engine.processCommand(`setoption name MultiPV value ${n}`);
  engine.processCommand(`position fen ${fen}`); engine.processCommand(`go depth ${DEPTH}`);
});
const pawns = (cp: number) => Math.round(cp / 10) / 10;

const table: GradeTable = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const todo = new Map<string, string>(); // position key -> full FEN
for (const file of listContentFiles()) {
  const o = loadOpening(file);
  for (const v of o.variations) {
    const c = new Chess();
    for (const [i, m] of v.moves.entries()) {
      if ((i % 2 === 0) === (o.color === 'white')) { const k = posKey(c.fen()); if (!table[k] && !todo.has(k)) todo.set(k, c.fen()); }
      c.move(m.san);
    }
  }
}
console.log(`${todo.size} positions to grade at depth ${DEPTH} (${Object.keys(table).length} already done)`);
engine.processCommand('uci');
let n = 0;
for (const [k, fen] of todo) {
  const c = new Chess(fen), legal = c.moves({ verbose: true }), white = c.turn() === 'w';
  const res = await search(fen, legal.length);
  const moves: Record<string, [number, string]> = {};
  let best: [string, number] | undefined;
  for (const r of [...res.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1])) {
    const mv = legal.find(x => x.from + x.to + (x.promotion ?? '') === r.pv[0]); if (!mv) continue;
    const after = new Chess(fen); after.move(mv.san);
    let reply = '';
    try { if (r.pv[1]) reply = after.move({ from: r.pv[1].slice(0, 2), to: r.pv[1].slice(2, 4), promotion: r.pv[1][4] }).san; } catch { /* game over */ }
    const ev = pawns(white ? r.cp : -r.cp);
    moves[mv.san] = [ev, reply];
    if (!best) best = [mv.san, ev];
  }
  if (best) table[k] = { b: best, m: moves };
  if (++n % 20 === 0) { writeFileSync(OUT, JSON.stringify(table) + '\n'); console.log(`${n}/${todo.size}`); }
}
writeFileSync(OUT, JSON.stringify(table) + '\n');
console.log(`done: ${Object.keys(table).length} positions`);
engine.terminate();
