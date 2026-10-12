/** In-app Back. Every history entry is numbered so Back knows whether the app has a previous page to return to. */
let depth = -1;
const trail: string[] = []; // hash of each entry in this session, by depth

/** Call at the start of every route(). New entries get the next number; entries we return to keep theirs. */
export function trackEntry() {
  const d = (history.state as { d?: number } | null)?.d;
  if (typeof d === 'number') depth = d;
  else { depth += 1; history.replaceState({ d: depth }, ''); }
  trail[depth] = location.hash || '#/';
  trail.length = depth + 1;
}

/** Go to the previous page; with no previous page (opened from the home screen icon or after a reload) go to `fallback`. */
export function goBack(fallback: string, render: () => void) {
  if (depth > 0) history.back();
  else { history.replaceState({ d: 0 }, '', fallback); render(); }
}

/** Go to a page, reusing the earlier history entry for it when there is one so Back does not lead into a loop. */
export function goTo(hash: string) {
  for (let i = depth - 1; i >= 0; i--) if (trail[i] === hash) { history.go(i - depth); return; }
  location.hash = hash;
}

/** Links marked data-goback return to the previous page (their href is the fallback); data-goto links use goTo. */
export function installNavLinks(render: () => void) {
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const a = (e.target as Element).closest?.('a[data-goback],a[data-goto]');
    if (!a) return;
    e.preventDefault();
    const to = a.getAttribute('href') ?? '#/';
    if (a.hasAttribute('data-goback')) goBack(to, render); else goTo(to);
  });
}
