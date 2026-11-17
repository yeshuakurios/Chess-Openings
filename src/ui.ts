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

/** Shared play screen shell: header, progress, message card, eval bar, board, controls.
 * `menu`, when given, turns the title into a tappable mode switcher (Learn/Practice/…) for this line. */
export function screenShell(title: string, subtitle: string, controls: string, menu?: { label: string; href: string; active?: boolean; stat?: string }[]): string {
  const titleHtml = menu && menu.length
    ? `<button class="modebtn" id="modebtn" type="button" aria-haspopup="true" aria-expanded="false">${esc(title)}<svg class="chev" viewBox="0 0 20 20" width="12" height="12" aria-hidden="true"><path d="M5 7l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
       <div class="modemenu" id="modemenu" hidden role="menu">${menu.map(m => `<a href="${m.href}" class="modeitem${m.active ? ' on' : ''}" role="menuitem"><span>${esc(m.label)}</span>${m.stat ? `<b>${esc(m.stat)}</b>` : ''}</a>`).join('')}</div>`
    : `<b>${esc(title)}</b>`;
  return `
  <header class="top"><a class="back" href="#/" id="back" data-goback aria-label="Back">←</a>
    <div class="title">${titleHtml}<span>${esc(subtitle)}</span></div><span class="combo" id="combo" hidden aria-label="Moves in a row"></span></header>
  <div class="bar"><div id="bar-fill"></div></div>
  <div class="msg" id="msg" role="status" aria-live="polite"></div>
  <div class="eval"><div id="eval-fill"></div><span id="eval-label">0.2</span></div>
  <div class="board-wrap"><div id="board" class="cg-wrap" aria-label="Chess board"></div></div>
  <nav class="controls">${controls}</nav>`;
}

// One delegated listener handles every screenShell's mode menu, however often the shell is replaced.
// Guarded: some test scripts import this module under Node, with no document.
if (typeof document !== 'undefined') document.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const btn = t.closest<HTMLButtonElement>('#modebtn');
  const menu = document.getElementById('modemenu');
  if (btn && menu) {
    const open = menu.hidden;
    menu.hidden = !open; btn.setAttribute('aria-expanded', String(open));
    return;
  }
  if (menu && !menu.hidden && !t.closest('#modemenu')) { menu.hidden = true; document.getElementById('modebtn')?.setAttribute('aria-expanded', 'false'); }
});
