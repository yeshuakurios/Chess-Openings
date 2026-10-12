import { Chess } from 'chess.js';
import type { Key } from 'chessground/types';
import { createBoard } from './board.ts';
import { findOpening, findVariation } from './content.ts';
import { START_EVAL } from './play.ts';
import { buildSegments, segmentMs, TAIL_MS } from './segments.ts';
import { esc, screenShell, setEval, setMessage, setProgress } from './ui.ts';

declare global { interface Window { __autoplayDurations?: number[]; __autoplayStart?: number; __autoplayDone?: boolean } }

/** `?autoplay=<opening>[/<variation>]`: steps through the narrated line and sets `window.__autoplayDone`. The render script injects exact per-segment durations in `window.__autoplayDurations`; otherwise they are estimated from the narration length. */
export async function runAutoplay(spec: string) {
  const [oid, vid] = spec.split('/');
  const o = findOpening(oid), v = o && (vid ? findVariation(o, vid) : o.variations[0]);
  const app = document.getElementById('app')!;
  if (!o || !v) { app.textContent = `Unknown opening or variation: ${spec}`; return; }
  const segs = buildSegments(o, v);
  const durs = window.__autoplayDurations ?? segs.map(s => segmentMs(s.text));
  document.body.classList.add('autoplay');
  app.innerHTML = screenShell(esc(o.name), esc(v.name), '');
  const board = createBoard(document.getElementById('board')!, o.color);
  const wait = (ms: number) => new Promise(r => setTimeout(r, Math.max(0, ms)));

  const t0 = window.__autoplayStart = Date.now();
  let at = t0;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i], chess = new Chess();
    let last: [Key, Key] | undefined;
    for (const san of s.sans) { const m = chess.move(san); last = [m.from as Key, m.to as Key]; }
    board.show(chess, s.kind === 'move' ? last : undefined);
    board.shapes(s.shapes);
    setEval(s.eval ?? START_EVAL); setProgress(i / segs.length);
    setMessage(`<b>${esc(s.head)}</b>${s.note ? `<br>${esc(s.note)}` : ''}`);
    at += durs[i];
    await wait(at - Date.now()); // absolute schedule, so timer drift never accumulates
  }
  setProgress(1);
  await wait(at + TAIL_MS - Date.now());
  window.__autoplayDone = true;
  document.body.dataset.autoplay = 'done';
}
