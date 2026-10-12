// Dev helper for authoring common-mistake lines: npm run pv -- "e4 d5 exd5 Nxd5" "d4 Nf6 ..."
// For each move list it prints the engine's best continuation (5 plies) and the eval at the end of it (pawns, White's view).
import { createRequire } from 'node:module';
import { Chess } from 'chess.js';

const PLIES = Number(process.env.PLIES ?? 5), DEPTH = Number(process.env.DEPTH ?? 16);
const require = createRequire(import.meta.url);
const engine = require('stockfish')('lite-single', onLine);
let pv: string[] = [], cp = 0, done: (() => void) | null = null;
function onLine(line: string) {
  const m = /^info depth \d+.* score (cp|mate) (-?\d+).* pv (.+)$/.exec(line);
  if (m) { cp = m[1] === 'cp' ? Number(m[2]) : (Number(m[2]) > 0 ? 10000 : -10000); pv = m[3].split(' '); }
  if (line.startsWith('bestmove') && done) { const d = done; done = null; d(); }
}
const run = (fen: string) => new Promise<void>(res => { pv = []; cp = 0; done = res; engine.processCommand(`position fen ${fen}`); engine.processCommand(`go depth ${DEPTH}`); });
engine.processCommand('uci');
for (const arg of process.argv.slice(2)) {
  const c = new Chess();
  try { arg.split(/\s+/).filter(Boolean).forEach(s => c.move(s)); } catch { console.log(`${arg}\n   ILLEGAL`); continue; }
  const sign = c.turn() === 'w' ? 1 : -1, start = c.fen();
  await run(start);
  const out: string[] = [], d = new Chess(start);
  for (const u of pv.slice(0, PLIES)) { try { out.push(d.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san); } catch { break; } }
  console.log(`${arg.split(/\s+/).slice(-3).join(' ')}\n   ${out.join(' ')}  | ${(Math.round(sign * cp / 10) / 10).toFixed(1)}`);
}
engine.terminate();
