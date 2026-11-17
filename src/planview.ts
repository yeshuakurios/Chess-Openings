import { Chess } from 'chess.js';
import { staticBoard, toDraw } from './board.ts';
import { esc } from './ui.ts';
import type { Opening, Shape, Variation } from './types.ts';

/** The position after the last move of the line: where the middlegame plan is drawn. */
export const planFen = (v: Variation) => { const c = new Chess(); v.moves.forEach(m => c.move(m.san)); return c.fen(); };

/** What the board shows for step `k`: that step's own drawing (so every step has one clear picture). */
export const stepShapes = (v: Variation, k: number): Shape[] => v.plan?.steps[k]?.shapes ?? [];

const KEY = '<span class="pl-key"><span><i class="green"></i>your plan</span><span><i class="blue"></i>pressure</span><span><i class="red"></i>target or danger</span><span><i class="yellow"></i>key square</span></span>';

export interface PlanOpts {
  /** Label of the last button (default "Done"). */
  doneLabel?: string;
  /** Wait this long before the screen appears, so a "line complete" message or confetti is seen first. */
  delay?: number;
}

/**
 * The end of every line, in Learn, Practice and Drill: the final position with the middlegame plan drawn on it, one step at a time
 * (a picture and one short sentence per step). Resolves when the learner closes it. A line without a plan resolves at once.
 */
export function openPlan(o: Opening, v: Variation, opts: PlanOpts = {}): Promise<void> {
  const steps = v.plan?.steps;
  if (!steps?.length) return Promise.resolve();
  return new Promise<void>(resolve => {
    const show = () => {
      document.querySelector('.mv-overlay')?.remove();
      const wrap = document.createElement('div');
      wrap.className = 'mv-overlay'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'Middlegame plan');
      wrap.innerHTML = `<main class="page mv pl">
        <div class="steps" aria-hidden="true">${steps.map(() => '<i></i>').join('')}</div>
        <div class="tag mv-title" role="status" aria-live="polite"></div>
        <h2 class="pl-head">Middlegame plan</h2>
        <div class="board-wrap hero"><div class="cg-wrap" aria-label="Final position of the line with the plan drawn on it"></div></div>
        <div class="pl-key-row">${KEY}</div>
        <div class="mv-panel pl-panel" role="status" aria-live="polite"></div>
        <div class="row mv-nav"><button class="btn" type="button" id="pl-prev">‹ Back</button><button class="btn primary" type="button" id="pl-next">Next ›</button></div></main>`;
      document.body.append(wrap);
      const cg = staticBoard(wrap.querySelector('.cg-wrap') as HTMLElement, o.color, planFen(v), []);
      const title = wrap.querySelector('.mv-title') as HTMLElement, panel = wrap.querySelector('.pl-panel') as HTMLElement;
      const dots = [...wrap.querySelectorAll<HTMLElement>('.steps i')];
      const prev = wrap.querySelector('#pl-prev') as HTMLButtonElement, next = wrap.querySelector('#pl-next') as HTMLButtonElement;
      let at = 0;
      const close = () => { wrap.remove(); resolve(); };
      const go = (n: number) => {
        at = Math.max(0, Math.min(steps.length - 1, n));
        cg.setAutoShapes(toDraw(stepShapes(v, at)));
        dots.forEach((d, i) => d.classList.toggle('on', i <= at));
        title.textContent = `${v.name} · step ${at + 1} of ${steps.length}`;
        panel.innerHTML = `<p class="pl-step"><b>${at + 1}</b><span>${esc(steps[at].text)}</span></p>`;
        prev.disabled = at === 0;
        next.textContent = at === steps.length - 1 ? (opts.doneLabel ?? 'Done') : 'Next ›';
      };
      prev.onclick = () => go(at - 1);
      next.onclick = () => (at === steps.length - 1 ? close() : go(at + 1));
      go(0);
    };
    if (opts.delay) setTimeout(show, opts.delay); else show();
  });
}
