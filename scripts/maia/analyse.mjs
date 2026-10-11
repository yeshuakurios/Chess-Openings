import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { policy, close } from './maia.mjs';
import { Chess } from 'chess.js';
const dir = new URL('../../content/', import.meta.url).pathname;
const rows = [];
const cache = new Map();
for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const o = JSON.parse(readFileSync(dir + f, 'utf8'));
  const userIsWhite = o.color === 'white';
  for (const v of o.variations) {
    const chess = new Chess(); const played = []; let follow = 1;
    v.moves.forEach((m, i) => {
      rows.push({ o, v, i, fen: chess.fen(), played: [...played], san: m.san, mine: (i % 2 === 0) === userIsWhite });
      const mv = chess.move(m.san); played.push(mv.from + mv.to + (mv.promotion ?? ''));
    });
  }
}
const out = [];
for (const r of rows) {
  if (r.mine) continue;                          // we only need the opponent's replies
  const key = r.played.join(' ');
  if (!cache.has(key)) cache.set(key, await policy(r.played));
  const pol = cache.get(key);
  const chess = new Chess(); r.played.forEach(u => chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }));
  const san = u => {
    const c = new Chess(chess.fen()); let from = u.slice(0, 2), to = u.slice(2, 4);
    const pc = c.get(from), tg = c.get(to);
    if (pc?.type === 'k' && tg?.type === 'r' && tg.color === pc.color) to = (to[0] > from[0] ? 'g' : 'c') + to[1];   // lc0 writes castling as king-takes-rook
    return c.move({ from, to, promotion: u[4] }).san;
  };
  const top = pol.slice(0, 5).map(x => ({ san: san(x.uci), p: x.p }));
  const scripted = pol.find(x => san(x.uci) === r.san)?.p ?? 0;
  out.push({ opening: r.o.name, line: r.v.name, id: `${r.o.id}/${r.v.id}`, ply: r.i, moveNo: Math.floor(r.i / 2) + 1, color: r.i % 2 === 0 ? 'w' : 'b', scripted: r.san, pScripted: scripted, top });
}
writeFileSync(process.argv[2] ?? 'replies.json', JSON.stringify(out, null, 1));
console.log('positions queried:', cache.size, 'rows:', out.length);
close();
