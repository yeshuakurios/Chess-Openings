import type { Move, Opening } from './types.ts';

const PIECE: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const fmt = (n: number) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));

/** Why a wrong move is not in the line. Never names the line's own move, so Drill is not given away. */
export function whyNot(o: Opening, line: Move, tried: { san: string; captured?: string }): string {
  const head = `${tried.san} isn't part of this line.`;
  const authored = line.why?.[tried.san];
  if (authored) return `${head} ${authored}`;
  const alt = line.caps?.find(c => c.san === tried.san);
  if (!alt) return head;
  const what = tried.captured ? `It takes a ${PIECE[tried.captured]}, but` : 'It gives check, but';
  const worse = (line.eval - alt.eval) * (o.color === 'white' ? 1 : -1); // > 0: worse for the user than the line
  const reply = alt.reply ? `the engine's best reply is ${alt.reply} (${fmt(alt.eval)})` : 'the engine finds a good answer';
  const verdict = worse >= 0.5 ? `, and you end up about ${worse.toFixed(1)} pawns worse than in the line.`
    : worse >= 0.2 ? ', and you end up a little worse than in the line.' : '. It is playable, but this course has a different move here.';
  return `${head} ${what} ${reply}${verdict}`;
}

