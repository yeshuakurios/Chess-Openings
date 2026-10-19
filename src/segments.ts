import type { Opening, Shape, Variation } from './types.ts';

/** One beat of a video: a board position, what is spoken over it, and what the screen shows. Pure data, shared by the autoplay page and the render script. */
export interface Segment {
  id: string; kind: 'goal' | 'strategy' | 'move';
  sans: string[];            // moves played from the start to reach the position
  shapes: Shape[];
  text: string;              // narration ('' = silent beat)
  head: string;              // bold line on the message card
  note?: string; eval?: number;
}

export const LEAD_MS = 250, GAP_MS = 500, SILENT_MS = 1200, TAIL_MS = 1000, MS_PER_WORD = 400;
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
/** How long a segment stays on screen. `audioMs` is the measured speech length; without it the length is estimated from the word count. */
export const segmentMs = (text: string, audioMs?: number) => (text ? LEAD_MS + (audioMs ?? words(text) * MS_PER_WORD) + GAP_MS : SILENT_MS);

/** A variation is videoable once it has its own narration. */
export const hasNarration = (v: Variation) => !!v.narration?.trim();

export function buildSegments(o: Opening, v: Variation): Segment[] {
  const out: Segment[] = [];
  const g = o.goal, gv = g.board && o.variations.find(x => x.id === g.board!.variation);
  if (g.narration?.trim() && g.board && gv) out.push({ id: 'goal', kind: 'goal', sans: gv.moves.slice(0, g.board.ply).map(m => m.san), shapes: g.board.shapes, text: g.narration, head: g.title });
  const b = v.board ?? { ply: v.moves.length, shapes: [] };
  out.push({ id: 'strategy', kind: 'strategy', sans: v.moves.slice(0, b.ply).map(m => m.san), shapes: b.shapes, text: v.narration ?? '', head: v.name });
  v.moves.forEach((m, i) => {
    const n = Math.floor(i / 2) + 1;
    out.push({ id: `m${i + 1}`, kind: 'move', sans: v.moves.slice(0, i + 1).map(x => x.san), shapes: m.shapes ?? [], text: m.narration ?? '', head: `${n}${i % 2 ? '…' : '.'} ${m.san}`, note: m.note, eval: m.eval });
  });
  return out;
}
