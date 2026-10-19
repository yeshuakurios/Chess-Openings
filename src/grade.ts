import { winPct } from './ui.ts';

/** What the build knows about one position where the trained side is to move (`npm run grades`). `m[san] = [eval after that move and the engine's best play, the engine's reply]`; evals are pawns from White's view. `b` is the engine's top move. */
export interface GradeEntry { b: [string, number]; m: Record<string, [number, string]> }
export type GradeTable = Record<string, GradeEntry>;

/** Position identity for the table: the FEN without the move counters. */
export const posKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

export type Grade = 'good' | 'inaccuracy' | 'mistake' | 'blunder';
/** Win-chance points (0-100 scale) lost against the engine's best move. Placeholder numbers for an opening trainer: about 0.35, 0.8 and 1.4 pawns near equality. */
export const INACCURACY = 3, MISTAKE = 7, BLUNDER = 12;
const MARK: Record<Grade, string> = { good: '', inaccuracy: '?!', mistake: '?', blunder: '??' };
const LABEL: Record<Grade, string> = { good: 'Playable', inaccuracy: 'Inaccuracy', mistake: 'Mistake', blunder: 'Blunder' };

export interface Graded {
  grade: Grade; mark: string; label: string;
  loss: number;          // pawns lost against the engine's best move, never below 0
  lossPct: number;       // the same in win-chance points
  mine: number;          // eval after the move, from the owner's side
  best: { san: string; mine: number };
  reply: string;         // the engine's best reply, '' if none
  eval: number;          // eval after the move, White's view (for the eval bar)
}
const sideSign = (color: 'white' | 'black') => (color === 'white' ? 1 : -1);

/** Grade one move from a position in the table; undefined when the position or the move is not in it. */
export function gradeMove(table: GradeTable, fen: string, san: string, color: 'white' | 'black'): Graded | undefined {
  const e = table[posKey(fen)], played = e?.m[san];
  if (!e || !played) return undefined;
  const s = sideSign(color), bestMine = e.b[1] * s, mine = played[0] * s;
  const lossPct = Math.max(0, winPct(bestMine) - winPct(mine));
  const grade: Grade = lossPct >= BLUNDER ? 'blunder' : lossPct >= MISTAKE ? 'mistake' : lossPct >= INACCURACY ? 'inaccuracy' : 'good';
  return { grade, mark: MARK[grade], label: LABEL[grade], loss: Math.max(0, bestMine - mine), lossPct, mine, best: { san: e.b[0], mine: bestMine }, reply: played[1], eval: played[0] };
}

const fmt = (n: number) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
export const fmtEval = fmt;

/** One or two sentences saying how good the move was and why it costs. Names only the move played and the engine's reply, never the line's own move, so it is safe in Drill. */
export function gradeText(g: Graded, san: string): string {
  if (g.grade === 'good') return `${san} is a sound move by the engine, but it leaves your line.`;
  const reply = g.reply ? ` After the reply ${g.reply} you stand at ${fmt(g.mine)}.` : ` You stand at ${fmt(g.mine)}.`;
  return `${g.label}: about ${g.loss.toFixed(1)} pawns worse than the best move.${reply}`;
}
