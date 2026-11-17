import { Chess } from 'chess.js';
import type { Opening, Variation } from './types.ts';

/** The line up to and including move `ply` (0-based) as numbered SAN, e.g. "1. f4 d5 2. Nf3 Nf6". */
export function notation(v: Variation, ply: number): string {
  return v.moves.slice(0, ply + 1).map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m.san}` : m.san)).join(' ');
}

/**
 * Text the owner pastes into a Claude session to ask about one move. It carries everything needed to answer without opening the app
 * (opening, line id, notation, FEN after the move, the line's own note) and a header the answer must repeat, so the owner can paste the reply into the app (Ask page > Paste explanations).
 * Pure, so it is tested without a browser.
 */
export function buildAskPrompt(o: Opening, v: Variation, ply: number, question: string): string {
  const m = v.moves[ply];
  const c = new Chess();
  for (let i = 0; i <= ply; i++) c.move(v.moves[i].san);
  const mover = ply % 2 === 0 ? 'White' : 'Black';
  return [
    `QUEUE explanation: ${o.id}/${v.id}#${ply}`,
    `Opening: ${o.name} (I play ${o.color}). Line: ${v.name}.`,
    `Moves: ${notation(v, ply)}`,
    `Move asked about: ${mover} plays ${m.san} (ply ${ply + 1}). Position after it: ${c.fen()}`,
    `The app says: ${m.note}`,
    `Reply format: a line "EXPLANATION ${o.id}/${v.id}#${ply}", then plain text under 900 characters. Do not name the move the line plays until after the position is known.`,
    `My question: ${question.trim() || 'Why this move, and why not the natural alternatives?'}`,
  ].join('\n');
}
