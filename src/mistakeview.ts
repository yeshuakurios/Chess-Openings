import { Chess } from 'chess.js';
import type { Key } from 'chessground/types';
import type { Api } from 'chessground/api';
import { staticBoard, toDraw } from './board.ts';
import { moveLabel } from './play.ts';
import { esc, winPct } from './ui.ts';
import { GLYPH, type MoveShape, type Story } from './mistakestory.ts';
import type { Opening, Shape, Variation } from './types.ts';

// ---------- the walkthrough ----------
const STEPS = ['The game so far', 'Your move', 'Why it tempted you', 'Why it fails', 'Do this instead'];
const fmt = (n: number) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
const ring = (sq: string, color: Shape['color'] = 'yellow'): Shape => ({ from: sq, color });
const arrow = (m: MoveShape, color: Shape['color']): Shape => ({ from: m.from, to: m.to, color });
const bar = (mine: number, label: string, cls = '') => `<div class="mv-row"><span>${label}</span><div class="mv-bar ${cls}"><i style="width:${winPct(mine).toFixed(1)}%"></i></div><b>${fmt(mine)}</b></div>`;

export interface StoryCtx { o: Opening; v: Variation; backHref: string; practiceHref: string }

/** Draws the five-step walkthrough into `host`: the moves so far, your move, why it tempted you, why it fails, what to play. Boards and bars carry the story; the words are labels. */
export function mountMistakeStory(host: HTMLElement, s: Story, ctx: StoryCtx, alive: () => boolean) {
  const { o, v } = ctx;
  host.innerHTML = `<main class="page mv"><a class="back" data-goback href="${esc(ctx.backHref)}">← Back</a>
    <div class="steps" aria-hidden="true">${STEPS.map(() => '<i></i>').join('')}</div>
    <div class="tag mv-title" role="status" aria-live="polite"></div>
    <div class="board-wrap hero"><div class="cg-wrap" aria-label="Board"></div></div>
    <div class="mv-panel"></div>
    <div class="row mv-nav"><button class="btn" type="button" id="mv-prev">‹ Back</button><button class="btn primary" type="button" id="mv-next">Next ›</button></div></main>`;
  const cg: Api = staticBoard(host.querySelector('.cg-wrap') as HTMLElement, o.color, new Chess().fen(), []);
  const panel = host.querySelector('.mv-panel') as HTMLElement, title = host.querySelector('.mv-title') as HTMLElement;
  const dots = [...host.querySelectorAll<HTMLElement>('.steps i')];
  const prev = host.querySelector('#mv-prev') as HTMLButtonElement, next = host.querySelector('#mv-next') as HTMLButtonElement;
  const mine = o.color === 'white';
  let step = 0, timer: ReturnType<typeof setInterval> | undefined, picked = 0;
  const stop = () => { if (timer) { clearInterval(timer); timer = undefined; } };
  const draw = (fen: string, shapes: Shape[], last?: [Key, Key]) => { cg.set({ fen, lastMove: last }); cg.setAutoShapes(toDraw(shapes)); };
  const replay = (k: number) => { const c = new Chess(); let last: [Key, Key] | undefined; for (let i = 0; i < k; i++) { const m = c.move(s.before[i]); last = [m.from as Key, m.to as Key]; } return { fen: c.fen(), last, move: k ? c.history({ verbose: true })[k - 1] : undefined }; };
  const afterPlayedFen = () => { const c = new Chess(s.fen); c.move(s.played.san); return c.fen(); };

  const step1 = () => {
    let k = 0;
    const strip = s.before.map((m, i) => `<button type="button" class="chip ${(i % 2 === 0) === mine ? 'mine' : 'theirs'}" data-i="${i + 1}">${esc(moveLabel(i, m))}</button>`).join('');
    panel.innerHTML = `<div class="lv-strip" role="group" aria-label="Moves so far">${strip}</div>
      <div class="row mv-play"><button class="ctl" type="button" data-d="-1" aria-label="Previous move">‹</button><button class="ctl" type="button" id="mv-auto" aria-label="Play">▶</button><button class="ctl" type="button" data-d="1" aria-label="Next move">›</button></div>`;
    const chips = [...panel.querySelectorAll<HTMLElement>('.chip')], strip$ = panel.querySelector('.lv-strip') as HTMLElement;
    const show = (n: number) => {
      k = Math.max(0, Math.min(s.before.length, n));
      const r = replay(k), m = r.move;
      draw(r.fen, m ? [{ from: m.from, to: m.to, color: (k - 1) % 2 === 0 === mine ? 'green' : 'blue' }] : [], r.last);
      chips.forEach((c, i) => c.classList.toggle('on', i + 1 === k));
      const on = chips[k - 1]; if (on) strip$.scrollTo({ left: on.offsetLeft - strip$.clientWidth / 2 + on.clientWidth / 2, behavior: 'smooth' });
    };
    panel.onclick = e => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-i],[data-d],#mv-auto'); if (!t) return;
      stop();
      if (t.id === 'mv-auto') { k = k >= s.before.length ? 0 : k; show(k); timer = setInterval(() => { if (!alive()) return stop(); if (k >= s.before.length) return stop(); show(k + 1); }, 750); return; }
      show(t.dataset.i ? Number(t.dataset.i) : k + Number(t.dataset.d));
    };
    show(0);
    timer = setInterval(() => { if (!alive()) return stop(); if (k >= s.before.length) return stop(); show(k + 1); }, 750); // plays itself once, then waits
  };
  const step2 = () => {
    draw(s.fen, [arrow(s.played, 'red')]);
    const g = s.grade;
    panel.innerHTML = `<div class="mv-played"><span class="mv-piece">${GLYPH[s.played.piece]}</span><b>${esc(s.played.san)}</b>${g ? `<span class="grade ${g.grade}">${esc(g.label)} ${esc(g.mark)}</span>` : ''}</div>`;
  };
  const step3 = () => {
    const show = () => { const r = s.reasons[picked] ?? s.reasons[0]; draw(s.fen, [arrow(s.played, 'blue'), ...r.squares.map(q => ring(q, 'yellow'))]); panel.querySelectorAll('.rs').forEach((b, i) => b.classList.toggle('on', i === picked)); };
    panel.innerHTML = `<div class="mv-reasons" role="group" aria-label="Likely reasons">${s.reasons.map((r, i) => `<button type="button" class="rs" data-i="${i}"><b>${esc(r.icon)}</b>${esc(r.label)}</button>`).join('')}</div>`;
    panel.onclick = e => { const t = (e.target as HTMLElement).closest<HTMLElement>('[data-i]'); if (t) { picked = Number(t.dataset.i); show(); } };
    picked = 0; show();
  };
  const step4 = () => {
    const a = s.after, shapes: Shape[] = [...a.threatened.map(q => ring(q, 'red'))];
    if (a.reply) shapes.push(arrow(a.reply, 'red'));
    draw(afterPlayedFen(), shapes, [s.played.from, s.played.to]);
    const loss = a.mine !== undefined && a.line !== undefined ? a.line - a.mine : undefined;
    panel.innerHTML = (a.mine !== undefined ? `<div class="mv-row"><span>You</span><div class="mv-bar"><i style="width:${winPct(a.mine).toFixed(1)}%"></i>${a.line !== undefined && loss! > 0 ? `<u style="left:${winPct(a.mine).toFixed(1)}%;width:${Math.max(0, winPct(a.line) - winPct(a.mine)).toFixed(1)}%"></u>` : ''}</div><b>${fmt(a.mine)}</b></div>` : '')
      + `<div class="mv-reply">${a.reply ? `<span class="rs on"><b>${GLYPH[a.reply.piece]}</b>${esc(a.reply.san)}</span>` : ''}${a.lost.length ? `<span class="mv-lost">you lose ${a.lost.map(p => GLYPH[p]).join(' ')}</span>` : ''}${loss !== undefined && loss > 0 ? `<span class="mv-drop">−${loss.toFixed(1)}</span>` : ''}</div>`
      + (a.mine === undefined ? '<p class="muted">No engine data for this position yet.</p>' : '');
  };
  const step5 = () => {
    const b = s.better, shapes: Shape[] = [arrow(b.move, 'green'), ...b.controls.map(q => ring(q, 'green'))];
    if (b.top) shapes.push(arrow(b.top.move, 'blue'));
    draw(s.fen, shapes);
    const played = s.after.mine;
    panel.innerHTML = `<div class="mv-played"><span class="mv-piece">${GLYPH[b.move.piece]}</span><b>${esc(b.move.san)}</b>${b.top ? `<span class="rs"><b>${GLYPH[b.top.move.piece]}</b>${esc(b.top.move.san)} engine</span>` : ''}</div>`
      + (b.mine !== undefined ? bar(b.mine, 'Line', 'good') : '') + (played !== undefined ? bar(played, 'You', 'bad') : '')
      + `<div class="row"><a class="btn primary" href="${esc(ctx.practiceHref)}">Try it from here</a></div>`;
  };
  const steps = [step1, step2, step3, step4, step5];
  const go = (n: number) => {
    stop(); step = Math.max(0, Math.min(steps.length - 1, n)); panel.onclick = null;
    dots.forEach((d, i) => d.classList.toggle('on', i <= step));
    title.textContent = `${step + 1} / ${steps.length} · ${STEPS[step]}`;
    prev.disabled = step === 0; next.hidden = step === steps.length - 1;
    steps[step]();
  };
  prev.onclick = () => go(step - 1); next.onclick = () => go(step + 1);
  go(0);
}
