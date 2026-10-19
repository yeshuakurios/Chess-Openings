import { Chess } from 'chess.js';
import type { Key } from 'chessground/types';
import { createBoard, type Board } from './board.ts';
import { esc, setEval, setMessage, setProgress } from './ui.ts';
import { whyNot } from './why.ts';
import { movePopularity } from './stats.ts';
import { addQuestion, flagKey, getProgress, isFlagged, toggleFlag } from './store.ts';
import { mistakesAt } from './games.ts';
import { key } from './content.ts';
import type { Mistake, Move, Opening, Variation } from './types.ts';

export const START_EVAL = 0.2;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface Ui { board: HTMLElement; hint: HTMLButtonElement; prev: HTMLButtonElement; fwd: HTMLButtonElement; resume?: HTMLButtonElement; flag?: HTMLButtonElement; ask?: HTMLButtonElement }

export const FLAG_TEXT = { off: 'Need more explanation', on: 'Flagged ✓ (tap to undo)' };
export const ASK_TEXT = { idle: 'Ask a question', saved: 'Question saved ✓' };
/** The mistakes to play out at move `ply` of a line: from the owner's chess.com games when imported, the hand-written ones otherwise. */
const mistakesFor = (o: Opening, v: Variation, ply: number) => mistakesAt(getProgress().games, key(o, v), ply, v.moves[ply]?.mistakes);
/** Wire an "Ask a question" button to one move: a native prompt takes the text, the question is stored with the move's id. */
function wireAsk(btn: HTMLButtonElement | undefined, k: string, ply: () => number | undefined) {
  if (!btn) return () => {};
  const sync = () => { btn.disabled = ply() === undefined; };
  btn.onclick = () => {
    const p = ply(); if (p === undefined) return;
    const text = prompt('Your question about this move. It is stored and answered in the daily review:');
    if (text && addQuestion(text, flagKey(k, p))) { btn.textContent = ASK_TEXT.saved; setTimeout(() => { btn.textContent = ASK_TEXT.idle; }, 2500); }
  };
  sync();
  return sync;
}
/** Wire a "Need more explanation" button to one move of the line. `ply()` says which move the button is about right now (or undefined for none). */
function wireFlag(btn: HTMLButtonElement | undefined, k: string, ply: () => number | undefined) {
  if (!btn) return () => {};
  const sync = () => { const p = ply(); btn.disabled = p === undefined; btn.textContent = p !== undefined && isFlagged(flagKey(k, p)) ? FLAG_TEXT.on : FLAG_TEXT.off; };
  btn.onclick = () => { const p = ply(); if (p !== undefined) { toggleFlag(flagKey(k, p)); sync(); } };
  sync();
  return sync;
}

/** The move's note, then (after the answer is known) how it differs from the same spot in a sibling line. */
export function noteWithVersus(m: Move): string {
  return m.note + (m.versus?.length ? m.versus.map(x => `<div class="vs">${esc(x.text)}</div>`).join('') : '');
}

/** Play a common mistake out on the board: the wrong move, then the punishment, then the lesson. Leaves the final position and message up; the caller puts the line back. */
export async function showMistake(board: Board, fen: string, x: Mistake, stopped: () => boolean): Promise<boolean> {
  const c = new Chess(fen);
  const head = `<b>${x.san} isn't part of this line.</b>`;
  board.lock(); board.clearArrow();
  setMessage(`${head}<br>Watch what happens.`);
  await wait(550);
  for (const san of [x.san, ...x.line]) {
    if (stopped()) return false;
    const mv = c.move(san);
    board.show(c, [mv.from as Key, mv.to as Key]);
    await wait(san === x.san ? 800 : 900);
  }
  if (typeof x.eval === 'number') setEval(x.eval);
  setMessage(`<b>${x.san}?</b> ${x.text}`); // the head already said it; keep the card for the lesson
  return true;
}

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
    // the move the button is about: the one being asked now, or the one on screen when looking back, or the last one when the line is done
    const flagPly = () => (busy ? undefined : finished ? v.moves.length - 1 : live() ? idx : view - 1 >= 0 ? view - 1 : undefined);
    const syncFlag = wireFlag(ui.flag, key(o, v), flagPly), syncAsk = wireAsk(ui.ask, key(o, v), flagPly);
    const syncArrows = () => { ui.prev.disabled = busy || view === 0; ui.fwd.disabled = busy || live(); syncFlag(); syncAsk(); };
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
      setMessage(k ? `<b>${moveLabel(k - 1, v.moves[k - 1].san)}</b> ${noteWithVersus(v.moves[k - 1])}` : 'Start position.');
      syncArrows();
    };
    ui.prev.onclick = () => { if (!busy && view > 0) showView(view - 1); };
    ui.fwd.onclick = () => { if (busy || live()) return; if (view + 1 === idx) { showLive(); setEval(v.moves[idx - 1].eval); setProgress(idx / v.moves.length); setMessage(noteWithVersus(v.moves[idx - 1])); } else showView(view + 1); };

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
    // A known common slip: show the consequence on the board, then put the position back so the user can try again.
    const demo = async (x: Mistake) => {
      busy = true; syncArrows();
      const shown = await showMistake(board, chess.fen(), x, opts.stopped);
      if (!shown || opts.stopped()) return;
      const back = ui.resume;
      if (back) { back.hidden = false; await new Promise<void>(res => { back.onclick = () => res(); }); back.hidden = true; if (opts.stopped()) return; } else await wait(2500);
      busy = false; turnStart = performance.now(); // the time spent watching is not thinking time
      setEval(idx ? v.moves[idx - 1].eval : START_EVAL);
      setMessage('Back in the line. Find the move that fits the plan.');
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
        setMessage(noteWithVersus(v.moves[idx - 1]));
        void next();
      } else {
        chess.undo(); mistakes++;
        const x = mistakesFor(o, v, idx).find(q => q.san === m.san);
        if (x) void demo(x);
        else {
          setMessage(whyNot(o, v.moves[idx], m, v, idx));
          board.allowMoves(chess, o.color, onMove, last);
        }
      }
    };
    ui.hint.onclick = () => { if (!finished && !busy && live() && idx < v.moves.length && chess.turn() === user) { mistakes++; hinted = true; const e = expected(); board.arrow(e.from as Key, e.to as Key); } };
    if (opts.startPly) { // spot check: set the position up without animation, then play on from there
      for (let i = 0; i < opts.startPly; i++) { const m = chess.move(v.moves[i].san); last = [m.from as Key, m.to as Key]; lasts[++idx] = last; }
      view = idx; setEval(v.moves[idx - 1].eval); setProgress(idx / v.moves.length);
      setMessage('<b>Spot check</b><br>Pick up the line from this position.');
    }
    void next();
  });
}

/** Step-through walkthrough used by Learn mode. On a move with known slips, a button plays the common mistake out before going on. */
export function walkLine(ui: Ui, o: Opening, v: Variation, controls: { next: HTMLButtonElement; prev: HTMLButtonElement; trap?: HTMLButtonElement; flag?: HTMLButtonElement; ask?: HTMLButtonElement }, onEnd: () => void) {
  const board = createBoard(ui.board, o.color);
  let idx = 0, demoing = false, shown = 0, token = 0;
  const learnPly = () => (idx > 0 && !demoing ? idx - 1 : undefined);
  const syncFlag = wireFlag(controls.flag, key(o, v), learnPly), syncAsk = wireAsk(controls.ask, key(o, v), learnPly);
  const render = () => {
    token++; demoing = false;
    const chess = new Chess(); let last: [Key, Key] | undefined;
    for (let i = 0; i < idx; i++) { const m = chess.move(v.moves[i].san); last = [m.from as Key, m.to as Key]; }
    board.show(chess, last); board.shapes(idx ? v.moves[idx - 1].shapes : []);
    setEval(idx ? v.moves[idx - 1].eval : START_EVAL); setProgress(idx / v.moves.length);
    const m = v.moves[idx - 1];
    const pop = idx && !m.versus?.length ? movePopularity(m, (idx - 1) % 2 === 0 === (o.color === 'white')) : ''; // the contrast text needs the room
    setMessage(idx ? `<b>${moveLabel(idx - 1, m.san)}</b> ${noteWithVersus(m)}${pop ? `<div class="stat">${pop}</div>` : ''}` : 'Press next to step through the line.');
    controls.prev.disabled = idx === 0;
    controls.next.textContent = idx === v.moves.length ? 'Finish' : 'Next';
    syncFlag(); syncAsk();
    if (controls.trap) {
      const n = idx ? mistakesFor(o, v, idx - 1).length : 0;
      controls.trap.hidden = !n; controls.trap.disabled = false;
      controls.trap.textContent = n > 1 ? `Common mistakes (${n})` : 'Common mistake';
    }
  };
  const showTrap = async () => {
    const list = idx ? mistakesFor(o, v, idx - 1) : [];
    if (!list.length) return;
    const x = list[shown++ % list.length], my = ++token;
    demoing = true; syncFlag(); syncAsk(); controls.prev.disabled = true; controls.trap!.disabled = true; controls.next.disabled = true;
    const before = new Chess(); for (let i = 0; i < idx - 1; i++) before.move(v.moves[i].san);
    await showMistake(board, before.fen(), x, () => my !== token);
    if (my !== token) return;
    controls.next.disabled = false; controls.trap!.disabled = list.length < 2;
    controls.next.textContent = 'Back to the line';
  };
  controls.trap && (controls.trap.onclick = () => void showTrap());
  controls.next.onclick = () => { if (demoing) return render(); if (idx === v.moves.length) return onEnd(); idx++; shown = 0; render(); };
  controls.prev.onclick = () => { if (idx > 0) { idx--; shown = 0; render(); } };
  render();
}
export const moveLabel = (ply: number, san: string) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? '.' : '…'} ${san}`;
