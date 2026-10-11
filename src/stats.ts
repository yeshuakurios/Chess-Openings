import type { Move, Opening, Variation } from './types.ts';

/** Below this many games at a position the percentages are noise, so say so instead. */
export const MIN_GAMES = 50;

const pctText = (frac: number) => {
  const p = Math.round(frac * 100);
  return p === 0 && frac > 0 ? 'under 1%' : `${p}%`;
};

/** One line of real-game context for a move (from `npm run stats`), or '' when the move has no stats. */
export function movePopularity(m: Move, userMove: boolean): string {
  const s = m.stats;
  if (!s) return '';
  if (s.total < MIN_GAMES) return 'Too few games reach this position to say how common it is.';
  const share = pctText(s.n / s.total);
  if (userMove) return `Among players rated around 1000, ${share} choose this move here.`;
  const also = (s.alts ?? []).filter(a => a.n > 0).slice(0, 2).map(a => `${a.san} ${pctText(a.n / s.total)}`);
  return `Among players rated around 1000, ${share} reply this way.${also.length ? ` Also common: ${also.join(', ')}.` : ''}`;
}

/** Chance that an opponent following real 1000-level habits walks into this line, as a fraction.
 * Multiplies how often each opponent reply is played; the opening's first move is skipped when the opponent makes it,
 * because the user already chose the opening. Undefined when stats are missing or too thin anywhere on the line. */
export function lineReach(o: Opening, v: Variation): number | undefined {
  let reach = 1;
  for (const [i, m] of v.moves.entries()) {
    const userMove = (i % 2 === 0) === (o.color === 'white');
    if (userMove || i === 0) continue;
    const s = m.stats;
    if (!s || s.total < MIN_GAMES) return undefined;
    reach *= s.n / s.total;
  }
  return reach;
}

export function reachText(reach: number | undefined): string {
  if (reach === undefined) return '';
  return `Opponents around 1000 walk into this line in about ${pctText(reach)} of games.`;
}
