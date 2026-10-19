import { Chess } from 'chess.js';
import type { Key } from 'chessground/types';
import { staticBoard, toDraw } from './board.ts';
import { MIN_GAMES } from './stats.ts';
import { START_EVAL, moveLabel } from './play.ts';
import { esc, winPct } from './ui.ts';
import type { Opening, Shape, Variation } from './types.ts';

/** A change of this many pawns in the owner's favour (or against) gets a coloured dot on the move. */
const SWING = 0.4;
const fmt = (n: number) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));

interface Pos { fen: string; last?: [Key, Key]; shapes: Shape[] }

/** Where the line viewer goes. Fill it with mountLineViewer once the element is visible (Chessground needs a sized element). */
export const lineViewerSlot = (id: string) => `<div class="lv" id="${id}"></div>`;

/**
 * Move-by-move picture of a line: a board with an arrow for each move (green for yours, blue for the opponent's), the eval, a one-line caption,
 * and a strip of moves to tap. Moves that have hand-made shapes show those; the plan board's shapes show at its position.
 */
export function mountLineViewer(host: HTMLElement, o: Opening, v: Variation, startAt = v.board?.ply ?? v.moves.length) {
  const mineAt = (i: number) => (i % 2 === 0) === (o.color === 'white');
  const chess = new Chess();
  const pos: Pos[] = [{ fen: chess.fen(), shapes: [] }];
  v.moves.forEach((m, i) => {
    const mv = chess.move(m.san);
    const arrow: Shape = { from: mv.from, to: mv.to, color: mineAt(i) ? 'green' : 'blue' };
    pos.push({ fen: chess.fen(), last: [mv.from as Key, mv.to as Key], shapes: v.board?.ply === i + 1 ? v.board.shapes : m.shapes?.length ? m.shapes : [arrow] });
  });
  const evalAt = (k: number) => (k ? v.moves[k - 1].eval : START_EVAL);
  /** How much move i changed the eval, from the owner's point of view. */
  const swing = (i: number) => (evalAt(i + 1) - evalAt(i)) * (o.color === 'white' ? 1 : -1);

  host.innerHTML = `<div class="board-wrap small"><div class="cg-wrap" aria-label="Line board"></div></div>
    <div class="lv-eval" aria-hidden="true"><i></i><span></span></div>
    <div class="lv-cap" role="status" aria-live="polite"></div>
    <div class="lv-strip" role="group" aria-label="Moves">${v.moves.map((m, i) => {
      const s = swing(i), dot = s >= SWING ? 'good' : s <= -SWING ? 'bad' : '';
      return `<button type="button" class="chip ${mineAt(i) ? 'mine' : 'theirs'}" data-i="${i + 1}">${esc(moveLabel(i, m.san))}${dot ? `<u class="${dot}"></u>` : ''}</button>`;
    }).join('')}</div>
    <div class="lv-ctl"><button type="button" class="ctl" data-d="-1" aria-label="Previous move">‹</button>
      <span class="lv-key"><i class="mine"></i>yours <i class="theirs"></i>opponent <u class="good"></u>better for you <u class="bad"></u>worse</span>
      <button type="button" class="ctl" data-d="1" aria-label="Next move">›</button></div>`;
  const cg = staticBoard(host.querySelector('.cg-wrap') as HTMLElement, o.color, pos[startAt].fen, pos[startAt].shapes);
  const strip = host.querySelector('.lv-strip') as HTMLElement, fill = host.querySelector('.lv-eval i') as HTMLElement, label = host.querySelector('.lv-eval span') as HTMLElement;
  const cap = host.querySelector('.lv-cap') as HTMLElement;
  const chips = [...strip.querySelectorAll<HTMLElement>('.chip')];
  let at = startAt;
  const show = (k: number) => {
    at = Math.max(0, Math.min(v.moves.length, k));
    const p = pos[at];
    cg.set({ fen: p.fen, lastMove: p.last });
    cg.setAutoShapes(toDraw(p.shapes));
    const e = evalAt(at);
    fill.style.width = `${winPct(e).toFixed(1)}%`; label.textContent = fmt(e);
    const m = at ? v.moves[at - 1] : undefined;
    const pct = m?.stats && m.stats.total >= MIN_GAMES ? Math.round((m.stats.n / m.stats.total) * 100) : undefined;
    cap.innerHTML = m ? `<b>${esc(moveLabel(at - 1, m.san))}</b> ${esc(m.note)}${pct !== undefined ? `<span class="lv-pct">${pct < 1 ? '<1' : pct}% play this</span>` : ''}` : 'Start position. Tap a move or press ›.';
    chips.forEach((c, i) => { c.classList.toggle('on', i + 1 === at); if (i + 1 === at) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current'); });
    const on = chips[at - 1];
    if (on) strip.scrollTo({ left: on.offsetLeft - strip.clientWidth / 2 + on.clientWidth / 2, behavior: 'smooth' });
    (host.querySelector('[data-d="-1"]') as HTMLButtonElement).disabled = at === 0;
    (host.querySelector('[data-d="1"]') as HTMLButtonElement).disabled = at === v.moves.length;
  };
  host.onclick = e => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-i],[data-d]');
    if (!t) return;
    show(t.dataset.i ? Number(t.dataset.i) : at + Number(t.dataset.d));
  };
  show(startAt);
}
