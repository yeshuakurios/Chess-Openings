const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export const winPct = (pawns: number) => 50 + 50 * (2 / (1 + Math.exp(-0.368 * pawns)) - 1);
export function setEval(pawns: number) {
  $('eval-fill').style.width = `${winPct(pawns).toFixed(1)}%`;
  $('eval-label').textContent = pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
}
export function setProgress(frac: number) { $('bar-fill').style.width = `${Math.round(frac * 100)}%`; }
export function setMessage(html: string, done = false) {
  const el = $('msg'); el.innerHTML = html; el.classList.toggle('done', done);
}
export const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Shared play screen shell: header, progress, message card, eval bar, board, controls. */
export function screenShell(title: string, subtitle: string, controls: string): string {
  return `
  <header class="top"><a class="back" href="#/" id="back" data-goback aria-label="Back">←</a>
    <div class="title"><b>${title}</b><span>${subtitle}</span></div></header>
  <div class="bar"><div id="bar-fill"></div></div>
  <div class="msg" id="msg" role="status" aria-live="polite"></div>
  <div class="eval"><div id="eval-fill"></div><span id="eval-label">0.2</span></div>
  <div class="board-wrap"><div id="board" class="cg-wrap" aria-label="Chess board"></div></div>
  <nav class="controls">${controls}</nav>`;
}
