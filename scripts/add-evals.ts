// Build-time only: runs Stockfish (Node) and writes eval (pawns, White's view) onto every move.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { listContentFiles, loadOpening } from './shared.ts';

const DEPTH = Number(process.env.DEPTH ?? 16);
const require = createRequire(import.meta.url);
const engine = require('stockfish')('lite-single', onLine);
let waiting: ((r: { cp: number; best: string }) => void) | null = null;
let last = 0;
let turn: 'w' | 'b' = 'w';

function onLine(line: string) {
  const m = /score (cp|mate) (-?\d+)/.exec(line);
  if (m) last = m[1] === 'cp' ? Number(m[2]) : (Number(m[2]) > 0 ? 10000 : -10000);
  if (line.startsWith('bestmove') && waiting) {
    const cp = turn === 'w' ? last : -last; // engine reports from side to move
    const w = waiting; waiting = null; w({ cp, best: line.split(' ')[1] });
  }
}
const evalFen = (fen: string) => new Promise<{ cp: number; best: string }>(res => {
  waiting = res; turn = fen.split(' ')[1] as 'w' | 'b'; last = 0;
  engine.processCommand(`position fen ${fen}`);
  engine.processCommand(`go depth ${DEPTH}`);
});

engine.processCommand('uci');
for (const file of listContentFiles()) {
  const o = loadOpening(file);
  for (const v of o.variations) {
    const chess = new Chess();
    const round = (cp: number) => Math.round(cp / 10) / 10; // centipawns -> pawns, 1 dp
    for (const [i, m] of v.moves.entries()) {
      const userMove = (i % 2 === 0) === (o.color === 'white');
      if (userMove) {
        // every other capture or check the user might try here, with the engine's best reply
        const alts: { san: string; reply: string; eval: number }[] = [];
        for (const alt of chess.moves({ verbose: true })) {
          if (alt.san === m.san || !(alt.captured || alt.san.includes('+'))) continue;
          const c = new Chess(chess.fen()); c.move(alt.san);
          const { cp, best } = await evalFen(c.fen());
          let reply = '';
          try { reply = c.move({ from: best.slice(0, 2), to: best.slice(2, 4), promotion: best[4] }).san; } catch { /* game over */ }
          alts.push({ san: alt.san, reply, eval: round(cp) });
        }
        if (alts.length) m.caps = alts; else delete m.caps;
      }
      chess.move(m.san);
      m.eval = round((await evalFen(chess.fen())).cp);
    }
    console.log(`${o.id}/${v.id}: ${v.moves.map(m => `${m.san} ${m.eval}`).join(' | ')}`);
  }
  writeFileSync(file, JSON.stringify(o, null, 2) + '\n');
}
engine.terminate();
