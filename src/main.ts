import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { openings, findOpening, findVariation, key } from './content.ts';
import { dueKeys, exportProgress, getProgress, hasToken, importProgress, isLearned, loadProgress, logAttempt, markLearned, review, setBestCombo, setToken, syncNow, type SyncStatus } from './store.ts';
import { playLine, walkLine, type Ui } from './play.ts';
import { fenAfter, staticBoard } from './board.ts';
import { esc, screenShell } from './ui.ts';
import type { Opening, PlanBoard, Variation } from './types.ts';

registerSW({ immediate: true });
const app = document.getElementById('app')!;
let token = 0; // cancels in-flight line playback when the screen changes

const href = (...p: string[]) => `#/${p.join('/')}`;
/** Placeholder markup for a shapes board; call drawBoard afterwards. */
const boardSlot = (id: string, b?: PlanBoard) => (b ? `<div class="board-wrap small"><div id="${id}" class="cg-wrap"></div></div>` : '');
function drawBoard(id: string, o: Opening, v: Variation, b?: PlanBoard) {
  const el = document.getElementById(id);
  if (el && b) staticBoard(el, o.color, fenAfter(v.moves.map(m => m.san), b.ply), b.shapes);
}
const goalVariation = (o: Opening) => o.variations.find(v => v.id === o.goal.board?.variation);
const goalKey = (o: Opening) => `goal:${o.id}`;
const lookup = (k: string): [Opening, Variation] | undefined => {
  const [oid, vid] = k.split('/'); const o = findOpening(oid); const v = o && findVariation(o, vid);
  return o && v ? [o, v] : undefined;
};

const SYNC_TEXT: Record<SyncStatus, string> = {
  off: 'Sync is off.', ok: 'Synced.', unauthorized: 'Wrong token. Tap Set up sync again.', offline: 'Could not reach the server.'
};
let syncText = '';
async function runSync(rerender: boolean) {
  const status = await syncNow();
  syncText = SYNC_TEXT[status];
  if (status === 'unauthorized') await setToken('');
  if (rerender && !location.hash.slice(2)) route();
  else { const el = document.getElementById('sync-msg'); if (el) el.textContent = syncText; }
}

function home() {
  const due = dueKeys().filter(k => lookup(k)).length;
  app.innerHTML = `
  <main class="page">
    <h1>Opening Goals</h1>
    <p class="muted">Learn the plan first, then the line.</p>
    <a class="btn primary big" href="${href('drill')}">Drill ${due ? `· ${due} due` : '· nothing due'}</a>
    <h2>Openings</h2>
    ${openings.map(o => {
      const done = o.variations.filter(v => isLearned(key(o, v))).length;
      return `<a class="card link" href="${href('o', o.id)}">
        <span class="dot ${o.color}"></span><div><b>${esc(o.name)}</b>
        <div class="muted">${esc(o.summary)}</div>
        <div class="tag">${o.color === 'white' ? 'White' : 'Black'} · ${done}/${o.variations.length} learned${o.status === 'draft' ? ' · draft' : ''}</div></div></a>`;
    }).join('')}
    <h2>Backup &amp; sync</h2>
    <div class="row"><button class="btn" id="sync">${hasToken() ? 'Sync now' : 'Set up sync'}</button><span class="muted" id="sync-msg">${esc(syncText)}</span></div>
    <div class="row"><button class="btn" id="exp">Export progress</button><button class="btn" id="imp">Import</button></div>
  </main>`;
  document.getElementById('sync')!.onclick = async () => {
    if (!hasToken()) {
      const t = prompt('Paste your sync token (the SYNC_TOKEN you set on the Worker):');
      if (!t) return;
      await setToken(t);
    }
    await runSync(true);
  };
  document.getElementById('exp')!.onclick = async () => {
    const data = exportProgress();
    try { await navigator.clipboard.writeText(data); alert('Progress copied to the clipboard. Paste it somewhere safe.'); }
    catch { prompt('Copy your progress:', data); }
  };
  document.getElementById('imp')!.onclick = () => {
    const raw = prompt('Paste exported progress:');
    if (raw) { try { importProgress(raw); route(); } catch { alert('That is not valid progress data.'); } }
  };
}

function openingPage(o: Opening) {
  app.innerHTML = `
  <main class="page"><a class="back" href="#/">← Openings</a>
    <h1>${esc(o.name)}</h1>
    <div class="card"><div class="tag">Positional goal</div><h3>${esc(o.goal.title)}</h3><p>${esc(o.goal.text)}</p>
      ${boardSlot('goal-board', o.goal.board)}
      <ul>${o.goal.plans.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
    <h2>Variations</h2>
    ${o.variations.map(v => `<div class="card"><b>${esc(v.name)}</b>
      <p class="muted">${esc(v.strategy)}</p>
      <div class="row"><a class="btn primary" href="${href('learn', o.id, v.id)}">Learn</a>
      <a class="btn" href="${href('practice', o.id, v.id)}">Practice</a>
      <span class="tag">${isLearned(key(o, v)) ? '✓ learned' : 'new'}</span></div></div>`).join('')}
  </main>`;
  const gv = goalVariation(o); if (gv) drawBoard('goal-board', o, gv, o.goal.board);
}

function learn(o: Opening, v: Variation) {
  const steps = [
    ...(isLearned(goalKey(o)) ? [] : [{ tag: 'Step 1 · Positional goal', title: o.goal.title, body: o.goal.text, list: o.goal.plans, board: o.goal.board, from: goalVariation(o) }]),
    { tag: 'Strategy for this variation', title: v.name, body: v.strategy, list: [] as string[], board: v.board, from: v }
  ];
  let i = 0;
  const showStep = () => {
    window.scrollTo(0, 0);
    const s = steps[i];
    app.innerHTML = `<main class="page"><a class="back" href="${href('o', o.id)}">← ${esc(o.name)}</a>
      <div class="card big"><div class="tag">${s.tag}</div><h2>${esc(s.title)}</h2><p>${esc(s.body)}</p>
      ${boardSlot('step-board', s.board)}
      ${s.list.length ? `<ul>${s.list.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}</div>
      <button class="btn primary big" id="go">${i === steps.length - 1 ? 'Show me the line' : 'Next: the strategy'}</button></main>`;
    if (s.from) drawBoard('step-board', o, s.from, s.board);
    document.getElementById('go')!.onclick = () => {
      if (i === 0 && steps.length === 2) markLearned(goalKey(o));
      if (i < steps.length - 1) { i++; showStep(); } else walk();
    };
  };
  const walk = () => {
    app.innerHTML = screenShell('Learn', esc(o.name), `<button class="ctl" id="prev">‹</button><button class="btn primary" id="next">Next</button>`);
    walkLine(ui(), o, v, { next: btn('next'), prev: btn('prev') }, () => {
      markLearned(key(o, v)); location.hash = href('practice', o.id, v.id);
    });
  };
  showStep();
}

const btn = (id: string) => document.getElementById(id) as HTMLButtonElement;
const ui = (): Ui => ({ board: document.getElementById('board')!, hint: btn('hint'), prev: btn('prev'), fwd: btn('fwd') });
const hintBtn = `<button class="ctl" id="prev" aria-label="Back one move">‹</button><button class="ctl" id="hint">Hint</button><button class="ctl" id="fwd" aria-label="Forward one move">›</button>`;

async function practice(o: Opening, v: Variation) {
  const my = ++token;
  app.innerHTML = screenShell('Practice', esc(o.name), `${hintBtn}<button class="btn primary" id="again" hidden>Again</button>`);
  const run = async () => {
    btn('again').hidden = true;
    const mistakes = await playLine(ui(), o, v, { stopped: () => my !== token, onAttempt: a => logAttempt({ ...a, k: key(o, v), m: 'p' }) });
    if (my !== token) return;
    if (mistakes === 0) markLearned(key(o, v));
    btn('again').hidden = false;
    btn('again').onclick = () => { app.innerHTML = screenShell('Practice', esc(o.name), `${hintBtn}<button class="btn primary" id="again" hidden>Again</button>`); void run(); };
  };
  void run();
}

async function drill() {
  const my = ++token;
  const queue = dueKeys().filter(k => lookup(k));
  if (!queue.length) {
    const learned = Object.keys(getProgress().cards).length;
    app.innerHTML = `<main class="page"><a class="back" href="#/">← Home</a><h1>Drill</h1>
      <div class="card"><b>${learned ? 'Nothing is due right now.' : 'Nothing to drill yet.'}</b>
      <p class="muted">${learned ? 'Come back later; the scheduler will bring lines back just before you would forget them.' : 'Learn a variation first and it will appear here.'}</p></div></main>`;
    return;
  }
  let combo = 0;
  for (const k of queue) {
    const [o, v] = lookup(k)!;
    app.innerHTML = screenShell('Drill', `${esc(o.name)} · ${queue.indexOf(k) + 1}/${queue.length} · ×${combo}`, `${hintBtn}<button class="btn primary" id="nextline" hidden>Next</button>`);
    const mistakes = await playLine(ui(), o, v, { stopped: () => my !== token, onAttempt: a => logAttempt({ ...a, k: key(o, v), m: 'd' }) });
    if (my !== token) return;
    review(k, mistakes);
    combo = mistakes === 0 ? combo + 1 : 0; setBestCombo(combo);
    await new Promise<void>(res => { const b = btn('nextline'); b.hidden = false; b.onclick = () => res(); });
    if (my !== token) return;
  }
  app.innerHTML = `<main class="page"><h1>Drill complete</h1><div class="card"><b>Best combo: ×${getProgress().bestCombo}</b></div>
    <a class="btn primary big" href="#/">Done</a></main>`;
}

function route() {
  token++;
  const [, a, b, c] = location.hash.split('/');
  const o = b ? findOpening(b) : undefined; const v = o && c ? findVariation(o, c) : undefined;
  if (a === 'o' && o) openingPage(o);
  else if (a === 'learn' && o && v) learn(o, v);
  else if (a === 'practice' && o && v) void practice(o, v);
  else if (a === 'drill') void drill();
  else home();
  window.scrollTo(0, 0);
}
await loadProgress();
window.addEventListener('hashchange', route);
route();
if (hasToken()) void runSync(true).then(() => { if (!location.hash.slice(2)) route(); });
