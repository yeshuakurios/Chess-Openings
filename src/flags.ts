import type { Opening, Variation } from './types.ts';

/** A switch with the time it was last flipped, so the newest change wins when two devices sync. */
export interface Stamped { on: boolean; t: number }

/** Key of one move in the "Needs more explanation" list: line key plus the move's index in the line. */
export const flagKey = (line: string, ply: number) => `${line}#${ply}`;
export const splitFlagKey = (k: string): [string, number] => { const i = k.lastIndexOf('#'); return [k.slice(0, i), Number(k.slice(i + 1))]; };
const label = (ply: number, san: string) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '…'} ${san}`;

/** Plain text to paste to Claude: every flagged move with the note the app shows for it today, grouped by line. */
export function flagReport(flags: Record<string, Stamped>, lookup: (line: string) => [Opening, Variation] | undefined): string {
  const byLine = new Map<string, number[]>();
  for (const [k, f] of Object.entries(flags)) {
    if (!f.on) continue;
    const [line, ply] = splitFlagKey(k);
    byLine.set(line, [...(byLine.get(line) ?? []), ply]);
  }
  if (!byLine.size) return '';
  const total = [...byLine.values()].reduce((n, l) => n + l.length, 0);
  const out = [`Moves that need more explanation (${total}). Please write a fuller explanation for each:`];
  for (const [line, plies] of byLine) {
    const found = lookup(line);
    out.push('', found ? `${found[0].name}: ${found[1].name} (${line})` : line);
    for (const p of plies.sort((a, b) => a - b)) {
      const m = found?.[1].moves[p];
      out.push(m ? `- ${label(p, m.san)}: ${m.note}` : `- move index ${p}`);
    }
  }
  return out.join('\n');
}
