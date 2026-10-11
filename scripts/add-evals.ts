// Build-time only: runs Stockfish (Node) and writes eval (pawns, White's view) onto every move.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { listContentFiles, loadOpening } from './shared.ts';

const DEPTH = Number(process.env.DEPTH ?? 16);
const require = createRequire(import.meta.url);
const engine = require('stockfish')('lite-single', onLine);
let waiting: ((cp: number) => void) | null = null;
let last = 0;
let turn: 'w' | 'b' = 'w';

function onLine(line: string) {
  const m = /score (cp|mate) (-?\d+)/.exec(line);
  if (m) last = m[1] === 'cp' ? Number(m[2]) : (Number(m[2]) > 0 ? 10000 : -10000);
  if (line.startsWith('bestmove') && waiting) {
    const cp = turn === 'w' ? last : -last; // engine reports from side to move
    const w = waiting; waiting = null; w(cp);
  }
}
const evalFen = (fen: string) => new Promise<number>(res => {
  waiting = res; turn = fen.split(' ')[1] as 'w' | 'b'; last = 0;
  engine.processCommand(`position fen ${fen}`);
  engine.processCommand(`go depth ${DEPTH}`);
});

engine.processCommand('uci');
for (const file of listContentFiles()) {
  const o = loadOpening(file);
  for (const v of o.variations) {
    const chess = new Chess();
    for (const m of v.moves) {
      chess.move(m.san);
      m.eval = Math.round((await evalFen(chess.fen())) / 10) / 10; // centipawns -> pawns, 1 dp
    }
    console.log(`${o.id}/${v.id}: ${v.moves.map(m => `${m.san} ${m.eval}`).join(' | ')}`);
  }
  writeFileSync(file, JSON.stringify(o, null, 2) + '\n');
}
engine.terminate();
