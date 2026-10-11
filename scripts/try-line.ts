// Dev helper: npm run try -- "d4 Nf6 c4 e5 ..."   prints the eval after every move (pawns, White's view)
import { createRequire } from 'node:module';
import { Chess } from 'chess.js';

const require = createRequire(import.meta.url);
const engine = require('stockfish')('lite-single', onLine);
let waiting: ((cp: number) => void) | null = null; let last = 0; let turn = 'w';
function onLine(line: string) {
  const m = /score (cp|mate) (-?\d+)/.exec(line);
  if (m) last = m[1] === 'cp' ? Number(m[2]) : (Number(m[2]) > 0 ? 10000 : -10000);
  if (line.startsWith('bestmove') && waiting) { const w = waiting; waiting = null; w(turn === 'w' ? last : -last); }
}
const ev = (fen: string) => new Promise<number>(res => {
  waiting = res; turn = fen.split(' ')[1]; last = 0;
  engine.processCommand(`position fen ${fen}`); engine.processCommand(`go depth ${process.env.DEPTH ?? 16}`);
});
engine.processCommand('uci');
const chess = new Chess();
const out: string[] = [];
for (const san of (process.argv[2] ?? '').split(/\s+/).filter(Boolean)) {
  chess.move(san);
  out.push(`${san} ${(Math.round((await ev(chess.fen())) / 10) / 10)}`);
}
console.log(out.join(' | '));
engine.terminate();
