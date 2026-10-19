import { Chess, type Square } from 'chess.js';
import { gradeMove, posKey, type Graded, type GradeTable } from './grade.ts';
import { grades } from './gradeData.ts';
import type { Opening, Variation } from './types.ts';

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
export const GLYPH: Record<string, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
const CENTER = new Set(['d4', 'd5', 'e4', 'e5']);
const FILES = 'abcdefgh';
const squares = (): Square[] => { const out: Square[] = []; for (const f of FILES) for (let r = 1; r <= 8; r++) out.push(`${f}${r}` as Square); return out; };

export type ReasonKind = 'mixup' | 'capture' | 'check' | 'attack' | 'space' | 'center' | 'develop' | 'natural' | 'sound';
/** One likely reason the move looked good at the time. `squares` are what to ring on the board. */
export interface Reason { kind: ReasonKind; icon: string; label: string; squares: Square[] }
export interface MoveShape { san: string; from: Square; to: Square; piece: string; captured?: string }

/** Everything the mistake walkthrough shows, worked out from the line, the position and the generated engine grades. Rule-based: nothing here is guessed by a model. */
export interface Story {
  color: 'white' | 'black';
  ply: number;
  before: string[];            // the moves played up to the mistake
  fen: string;                 // the position before the mistake
  played: MoveShape;
  grade?: Graded;
  reasons: Reason[];
  after: {
    reply?: MoveShape;         // the engine's best reply
    threatened: Square[];      // your pieces that are now loose or attacked by something cheaper
    lost: string[];            // piece letters the reply takes
    mine?: number;             // eval after play, from your side
    line?: number;             // eval after the line's move, from your side
  };
  better: { move: MoveShape; controls: Square[]; mine?: number; top?: { move: MoveShape; mine: number } };
}

const shapeOf = (m: { san: string; from: string; to: string; piece: string; captured?: string }): MoveShape => ({ san: m.san, from: m.from as Square, to: m.to as Square, piece: m.piece, ...(m.captured ? { captured: m.captured } : {}) });

/** Squares of the pieces of `color` that are attacked by the other side and loose or attacked by a cheaper piece, most valuable first. */
function hanging(c: Chess, color: 'w' | 'b'): Square[] {
  const other = color === 'w' ? 'b' : 'w', out: { sq: Square; v: number }[] = [];
  for (const row of c.board()) for (const p of row) {
    if (!p || p.color !== color || p.type === 'k') continue;
    const att = c.attackers(p.square, other);
    if (!att.length) continue;
    const cheapest = Math.min(...att.map(s => VALUE[c.get(s)!.type]));
    if (!c.attackers(p.square, color).length || cheapest < VALUE[p.type]) out.push({ sq: p.square, v: VALUE[p.type] });
  }
  return out.sort((a, b) => b.v - a.v).slice(0, 3).map(x => x.sq);
}

/** Enemy pieces (not pawns unless loose) that the piece now on `to` attacks. */
function targets(c: Chess, to: Square, color: 'w' | 'b'): Square[] {
  const other = color === 'w' ? 'b' : 'w', out: { sq: Square; v: number }[] = [];
  for (const row of c.board()) for (const p of row) {
    if (!p || p.color !== other || p.type === 'k') continue;
    if (!c.attackers(p.square, color).includes(to)) continue;
    if (VALUE[p.type] >= 3 || !c.attackers(p.square, other).length) out.push({ sq: p.square, v: VALUE[p.type] });
  }
  return out.sort((a, b) => b.v - a.v).slice(0, 2).map(x => x.sq);
}

export function explainMistake(o: Opening, v: Variation, ply: number, san: string, table: GradeTable = grades): Story | undefined {
  const lineMove = v.moves[ply];
  if (!lineMove) return undefined;
  try {
    const c = new Chess(), before: string[] = [];
    for (let i = 0; i < ply; i++) { c.move(v.moves[i].san); before.push(v.moves[i].san); }
    const fen = c.fen(), me = c.turn(), them = me === 'w' ? 'b' : 'w', sign = o.color === 'white' ? 1 : -1;
    const afterPlayed = new Chess(fen), pm = afterPlayed.move(san);
    const afterLine = new Chess(fen), lm = afterLine.move(lineMove.san);
    const entry = table[posKey(fen)];
    const grade = gradeMove(table, fen, san, o.color);

    const reasons: Reason[] = [];
    const twin = o.variations.find(w => w.id !== v.id && w.moves.length > ply && w.moves[ply].san === san); // the owner may have mixed up two lines
    if (twin) reasons.push({ kind: 'mixup', icon: '↔', label: `Same move as in “${twin.name.split(/[:(]/)[0].trim()}”`, squares: [pm.from, pm.to] });
    if (pm.captured) reasons.push({ kind: 'capture', icon: '⚔', label: afterPlayed.attackers(pm.to, them).length ? `Takes a ${NAME[pm.captured]}` : `Looked like a free ${NAME[pm.captured]}`, squares: [pm.to] });
    if (pm.san.includes('+')) { const k = afterPlayed.board().flat().find(p => p && p.type === 'k' && p.color === them); if (k) reasons.push({ kind: 'check', icon: '+', label: 'Gives check', squares: [k.square] }); }
    const hit = targets(afterPlayed, pm.to, me);
    if (hit.length && !pm.captured) reasons.push({ kind: 'attack', icon: '➜', label: `Attacks the ${NAME[afterPlayed.get(hit[0])!.type]}`, squares: hit });
    if (pm.piece === 'p' && !pm.captured) { // a pawn push: ring the two squares it now controls
      const f = FILES.indexOf(pm.to[0]), r = Number(pm.to[1]) + (me === 'w' ? 1 : -1);
      const ctl = [f - 1, f + 1].filter(i => i >= 0 && i < 8 && r >= 1 && r <= 8).map(i => `${FILES[i]}${r}` as Square);
      if (ctl.length) reasons.push({ kind: 'space', icon: '⬆', label: 'Gains space', squares: ctl });
    }
    if (CENTER.has(pm.to)) reasons.push({ kind: 'center', icon: '◎', label: 'Takes the center', squares: [pm.to] });
    else if ((pm.piece === 'n' || pm.piece === 'b') && /[18]$/.test(pm.from) && !/[18]$/.test(pm.to)) reasons.push({ kind: 'develop', icon: GLYPH[pm.piece], label: 'Develops a piece', squares: [pm.to] });
    if (grade?.grade === 'good') reasons.push({ kind: 'sound', icon: '✓', label: 'The engine likes it too', squares: [pm.to] });
    if (!reasons.length) reasons.push({ kind: 'natural', icon: '✦', label: 'Looks natural', squares: [pm.to] });

    let reply: MoveShape | undefined;
    const played = entry?.m[san];
    if (played?.[1]) { try { const r = new Chess(afterPlayed.fen()).move(played[1]); reply = shapeOf(r); } catch { /* game over */ } }
    const threatened = hanging(afterPlayed, me);
    if (reply?.captured && !threatened.includes(reply.to)) threatened.unshift(reply.to);

    const controls: Square[] = [];
    for (const sq of squares()) if (afterLine.attackers(sq, me).includes(lm.to) && (CENTER.has(sq) || (afterLine.get(sq) && afterLine.get(sq)!.color === them && VALUE[afterLine.get(sq)!.type] >= 1))) controls.push(sq);
    const lineE = entry?.m[lineMove.san]?.[0], topSan = entry?.b[0];
    let top: { move: MoveShape; mine: number } | undefined;
    if (entry && topSan && topSan !== lineMove.san && entry.b[1] * sign - (lineE ?? entry.b[1]) * sign >= 0.2) {
      try { top = { move: shapeOf(new Chess(fen).move(topSan)), mine: entry.b[1] * sign }; } catch { /* ignore */ }
    }
    return {
      color: o.color, ply, before, fen, played: shapeOf(pm), ...(grade ? { grade } : {}), reasons,
      after: { ...(reply ? { reply } : {}), threatened: threatened.slice(0, 3), lost: reply?.captured ? [reply.captured] : [], ...(played ? { mine: played[0] * sign } : {}), ...(lineE !== undefined ? { line: lineE * sign } : {}) },
      better: { move: shapeOf(lm), controls: controls.slice(0, 5), ...(lineE !== undefined ? { mine: lineE * sign } : {}), ...(top ? { top } : {}) }
    };
  } catch { return undefined; }
}
