// Dev helper for authoring common-mistake lines: npm run probe -- <opening-id> [variation-id]
// For every move of the trained side it lists the other legal moves that cost real eval (pawns lost vs the line move),
// with the engine's best continuation, so a human can pick the natural slips and write them up. Nothing here is shipped.
import { createRequire } from 'node:module';
import { Chess } from 'chess.js';
import { listContentFiles, loadOpening } from './shared.ts';

const DEPTH = Number(process.env.DEPTH ?? 12), MIN_LOSS = Number(process.env.MIN_LOSS ?? 0.6), PLIES = 5;
const require = createRequire(import.meta.url);
const engine = require('stockfish')('lite-single', onLine);
let pvs = new Map<number, { cp: number; pv: string[] }>(); let done: (() => void) | null = null;
function onLine(line: string) {
  const m = /^info depth (\d+).* multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)$/.exec(line);
  if (m) pvs.set(Number(m[2]), { cp: m[3] === 'cp' ? Number(m[4]) : (Number(m[4]) > 0 ? 10000 : -10000), pv: m[5].split(' ') });
  if (line.startsWith('bestmove') && done) { const d = done; done = null; d(); }
}
const search = (fen: string, n: number) => new Promise<Map<number, { cp: number; pv: string[] }>>(res => {
  pvs = new Map(); done = () => res(pvs);
  engine.processCommand(`setoption name MultiPV value ${n}`);
  engine.processCommand(`position fen ${fen}`); engine.processCommand(`go depth ${DEPTH}`);
});
const sanLine = (fen: string, uci: string[]) => {
  const c = new Chess(fen), out: string[] = [];
  for (const u of uci.slice(0, PLIES)) { try { out.push(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san); } catch { break; } }
  return out;
};
engine.processCommand('uci');
const [oid, vid] = process.argv.slice(2);
for (const file of listContentFiles()) {
  const o = loadOpening(file); if (o.id !== oid) continue;
  for (const v of o.variations) {
    if (vid && v.id !== vid) continue;
    console.log(`\n## ${o.id}/${v.id}  ${v.moves.map(m => m.san).join(' ')}`);
    const chess = new Chess();
    for (const [i, m] of v.moves.entries()) {
      if ((i % 2 === 0) === (o.color === 'white')) {
        const sign = 1, n = chess.moves().length; // the engine scores from the side to move, which is the trained side here
        const res = await search(chess.fen(), Math.min(n, 30));
        const lineMove = chess.moves({ verbose: true }).find(x => x.san === m.san)!;
        const best = [...res.values()].find(r => r.pv[0] === lineMove.from + lineMove.to + (lineMove.promotion ?? ''));
        const ref = (best?.cp ?? res.get(1)!.cp) * sign;
        console.log(`ply ${i + 1} (${Math.floor(i / 2) + 1}${i % 2 ? '...' : '.'}) line ${m.san} ${ref / 100}`);
        const rows = [...res.values()].map(r => {
          const mv = chess.moves({ verbose: true }).find(x => x.from + x.to + (x.promotion ?? '') === r.pv[0]);
          return mv && mv.san !== m.san ? { san: mv.san, loss: (ref - r.cp * sign) / 100, pv: sanLine(chess.fen(), r.pv) } : null;
        }).filter((r): r is NonNullable<typeof r> => !!r && r.loss >= MIN_LOSS && r.loss <= 6).sort((a, b) => a.loss - b.loss);
        for (const r of rows) console.log(`   ${r.san.padEnd(7)} -${r.loss.toFixed(1)}  ${r.pv.join(' ')}`);
      }
      chess.move(m.san);
    }
  }
}
engine.terminate();
