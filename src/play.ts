import { Chess } from 'chess.js';
import type { Key } from 'chessground/types';
import { createBoard } from './board.ts';
import { setEval, setMessage, setProgress } from './ui.ts';
import type { Opening, Variation } from './types.ts';

export const START_EVAL = 0.2;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface Ui { board: HTMLElement; hint: HTMLButtonElement }

/** The user plays their side from memory. Only the line's move is accepted. Resolves with the mistake count. */
export function playLine(ui: Ui, o: Opening, v: Variation, opts: { stopped: () => boolean }): Promise<number> {
  return new Promise(resolve => {
    const chess = new Chess();
    const board = createBoard(ui.board, o.color);
    const user = o.color === 'white' ? 'w' : 'b';
    let idx = 0, mistakes = 0, last: [Key, Key] | undefined;
    setEval(START_EVAL); setProgress(0);
    setMessage(`<b>${v.name}</b><br>Play your moves from memory.`);

    const finish = () => {
      board.lock(); board.clearArrow(); setProgress(1);
      setMessage(mistakes === 0 ? '<b>Flawless.</b> Line complete.' : `<b>Line complete</b> with ${mistakes} mistake${mistakes > 1 ? 's' : ''}.`, true);
      ui.hint.onclick = null;
      resolve(mistakes);
    };
    const apply = (san: string) => {
      const m = chess.move(san);
      last = [m.from as Key, m.to as Key];
      idx++; setEval(v.moves[idx - 1].eval); setProgress(idx / v.moves.length);
    };
    const next = async () => {
      if (opts.stopped()) return;
      while (idx < v.moves.length && chess.turn() !== user) {
        board.show(chess, last); await wait(450); if (opts.stopped()) return;
        apply(v.moves[idx].san);
      }
      if (idx >= v.moves.length) { board.show(chess, last); return finish(); }
      board.allowMoves(chess, o.color, onMove);
    };
    const expected = () => chess.moves({ verbose: true }).find(m => m.san === v.moves[idx].san)!;
    const onMove = (from: Key, to: Key) => {
      board.clearArrow();
      const m = chess.move({ from, to, promotion: 'q' });
      if (m.san === v.moves[idx].san) {
        last = [from, to]; idx++; setEval(v.moves[idx - 1].eval); setProgress(idx / v.moves.length);
        setMessage(v.moves[idx - 1].note);
        void next();
      } else {
        chess.undo(); mistakes++;
        setMessage("That move isn't part of this line.");
        board.allowMoves(chess, o.color, onMove);
      }
    };
    ui.hint.onclick = () => { if (idx < v.moves.length && chess.turn() === user) { mistakes++; const e = expected(); board.arrow(e.from as Key, e.to as Key); } };
    void next();
  });
}

/** Step-through walkthrough used by Learn mode. */
export function walkLine(ui: Ui, o: Opening, v: Variation, controls: { next: HTMLButtonElement; prev: HTMLButtonElement }, onEnd: () => void) {
  const board = createBoard(ui.board, o.color);
  let idx = 0;
  const render = () => {
    const chess = new Chess(); let last: [Key, Key] | undefined;
    for (let i = 0; i < idx; i++) { const m = chess.move(v.moves[i].san); last = [m.from as Key, m.to as Key]; }
    board.show(chess, last);
    setEval(idx ? v.moves[idx - 1].eval : START_EVAL); setProgress(idx / v.moves.length);
    const m = v.moves[idx - 1];
    setMessage(idx ? `<b>${moveLabel(idx - 1, m.san)}</b> ${m.note}` : 'Press next to step through the line.');
    controls.prev.disabled = idx === 0;
    controls.next.textContent = idx === v.moves.length ? 'Finish' : 'Next';
  };
  controls.next.onclick = () => { if (idx === v.moves.length) return onEnd(); idx++; render(); };
  controls.prev.onclick = () => { if (idx > 0) { idx--; render(); } };
  render();
}
export const moveLabel = (ply: number, san: string) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '…'} ${san}`;
