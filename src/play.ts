import { Chess } from 'chess.js';
import type { Key } from 'chessground/types';
import { createBoard } from './board.ts';
import { setEval, setMessage, setProgress } from './ui.ts';
import { whyNot } from './why.ts';
import { movePopularity } from './stats.ts';
import type { Opening, Variation } from './types.ts';

export const START_EVAL = 0.2;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface Ui { board: HTMLElement; hint: HTMLButtonElement; prev: HTMLButtonElement; fwd: HTMLButtonElement }

/** The user plays their side from memory. Only the line's move is accepted. Arrows let them look back and forth. Resolves with the mistake count. */
export function playLine(ui: Ui, o: Opening, v: Variation, opts: { stopped: () => boolean; startPly?: number; onAttempt?: (a: { p: number; ok: 0 | 1; h: 0 | 1; ms: number; s?: string }) => void }): Promise<number> {
  return new Promise(resolve => {
    const chess = new Chess();
    const board = createBoard(ui.board, o.color);
    const user = o.color === 'white' ? 'w' : 'b';
    let idx = 0, view = 0, mistakes = 0, busy = false, finished = false;
    let turnPly = -1, turnStart = 0, hinted = false; // timing and hint state for the position being played
    let last: [Key, Key] | undefined;
    const lasts: ([Key, Key] | undefined)[] = [undefined]; // lasts[k] = last move after k plies
    setEval(START_EVAL); setProgress(0);
    setMessage(`<b>${v.name}</b><br>Play your moves from memory.`);

    const at = (k: number) => { const c = new Chess(); for (let i = 0; i < k; i++) c.move(v.moves[i].san); return c; };
    const live = () => view === idx;
    const syncArrows = () => { ui.prev.disabled = busy || view === 0; ui.fwd.disabled = busy || live(); };
    const showLive = () => {
      view = idx; board.clearArrow(); syncArrows();
      if (finished) { board.show(chess, last); return; }
      if (chess.turn() === user) {
        if (turnPly !== idx) { turnPly = idx; turnStart = performance.now(); hinted = false; }
        board.allowMoves(chess, o.color, onMove, last);
      } else board.show(chess, last);
    };
    const showView = (k: number) => {
      view = k; board.lock(); board.clearArrow();
      board.show(at(k), lasts[k]);
      setEval(k ? v.moves[k - 1].eval : START_EVAL); setProgress(k / v.moves.length);
      setMessage(k ? `<b>${moveLabel(k - 1, v.moves[k - 1].san)}</b> ${v.moves[k - 1].note}` : 'Start position.');
      syncArrows();
    };
    ui.prev.onclick = () => { if (!busy && view > 0) showView(view - 1); };
    ui.fwd.onclick = () => { if (busy || live()) return; if (view + 1 === idx) { showLive(); setEval(v.moves[idx - 1].eval); setProgress(idx / v.moves.length); setMessage(v.moves[idx - 1].note); } else showView(view + 1); };

    const finish = () => {
      finished = true; board.lock(); board.clearArrow(); setProgress(1); syncArrows();
      setMessage(mistakes === 0 ? '<b>Flawless.</b> Line complete.' : `<b>Line complete</b> with ${mistakes} mistake${mistakes > 1 ? 's' : ''}.`, true);
      ui.hint.onclick = null;
      resolve(mistakes);
    };
    const apply = (san: string) => {
      const m = chess.move(san);
      last = [m.from as Key, m.to as Key]; lasts[++idx] = last; view = idx;
      setEval(v.moves[idx - 1].eval); setProgress(idx / v.moves.length);
    };
    const next = async () => {
      if (opts.stopped()) return;
      busy = true; syncArrows();
      while (idx < v.moves.length && chess.turn() !== user) {
        board.show(chess, last); await wait(450); if (opts.stopped()) return;
        apply(v.moves[idx].san);
      }
      busy = false;
      if (idx >= v.moves.length) { board.show(chess, last); return finish(); }
      showLive();
    };
    const expected = () => chess.moves({ verbose: true }).find(m => m.san === v.moves[idx].san)!;
    const onMove = (from: Key, to: Key) => {
      board.clearArrow();
      const m = chess.move({ from, to, promotion: 'q' });
      const ok = m.san === v.moves[idx].san;
      opts.onAttempt?.({ p: idx, ok: ok ? 1 : 0, h: hinted ? 1 : 0, ms: Math.round(performance.now() - turnStart), ...(ok ? {} : { s: m.san }) });
      if (ok) {
        last = [from, to]; lasts[++idx] = last; view = idx;
        setEval(v.moves[idx - 1].eval); setProgress(idx / v.moves.length);
        setMessage(v.moves[idx - 1].note);
        void next();
      } else {
        chess.undo(); mistakes++;
        setMessage(whyNot(o, v.moves[idx], m));
        board.allowMoves(chess, o.color, onMove, last);
      }
    };
    ui.hint.onclick = () => { if (!finished && live() && idx < v.moves.length && chess.turn() === user) { mistakes++; hinted = true; const e = expected(); board.arrow(e.from as Key, e.to as Key); } };
    if (opts.startPly) { // spot check: set the position up without animation, then play on from there
      for (let i = 0; i < opts.startPly; i++) { const m = chess.move(v.moves[i].san); last = [m.from as Key, m.to as Key]; lasts[++idx] = last; }
      view = idx; setEval(v.moves[idx - 1].eval); setProgress(idx / v.moves.length);
      setMessage('<b>Spot check</b><br>Pick up the line from this position.');
    }
    void next();
  });
}

/** Step-through walkthrough used by Learn mode. */
export function walkLine(ui: Ui, o: Opening, v: Variation, controls: { next: HTMLButtonElement; prev: HTMLButtonElement }, onEnd: () => void, onStep?: (idx: number) => void) {
  const board = createBoard(ui.board, o.color);
  let idx = 0;
  const render = () => {
    const chess = new Chess(); let last: [Key, Key] | undefined;
    for (let i = 0; i < idx; i++) { const m = chess.move(v.moves[i].san); last = [m.from as Key, m.to as Key]; }
    board.show(chess, last); board.shapes(idx ? v.moves[idx - 1].shapes : []);
    setEval(idx ? v.moves[idx - 1].eval : START_EVAL); setProgress(idx / v.moves.length);
    const m = v.moves[idx - 1];
    const pop = idx ? movePopularity(m, (idx - 1) % 2 === 0 === (o.color === 'white')) : '';
    setMessage(idx ? `<b>${moveLabel(idx - 1, m.san)}</b> ${m.note}${pop ? `<div class="stat">${pop}</div>` : ''}` : 'Press next to step through the line.');
    controls.prev.disabled = idx === 0;
    controls.next.textContent = idx === v.moves.length ? 'Finish' : 'Next';
    onStep?.(idx);
  };
  controls.next.onclick = () => { if (idx === v.moves.length) return onEnd(); idx++; render(); };
  controls.prev.onclick = () => { if (idx > 0) { idx--; render(); } };
  render();
}
export const moveLabel = (ply: number, san: string) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '…'} ${san}`;
