import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { openings, findOpening, findVariation, key } from './content.ts';
import { awardLineBonus, dueKeys, exportProgress, getProgress, grantBadges, hasToken, importProgress, isLearned, isShelved, loadProgress, logAttempt, markLearned, review, setBestCombo, setShelved, setToken, syncNow, type SyncStatus } from './store.ts';
import { playLine, walkLine, type Ui } from './play.ts';
import { fenAfter, staticBoard } from './board.ts';
import { LEVELS, hadSpotCheckToday, lineMastery, pickSpotCheck } from './mastery.ts';
import { troubleSpots } from './mistakes.ts';
import { aiExplain } from './ai.ts';
import { lineReach, reachText } from './stats.ts';
import { BADGES, DAILY_GOAL, dayKey, earnedNow, levelFor, streaks, totalXp } from './gamify.ts';
import { esc, screenShell } from './ui.ts';
import type { Opening, PlanBoard, Variation } from './types.ts';

const GEAR = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
const DRILL_CAP = 10; // lines per Drill session; the rest stay due for the next one
/** Tell the user a new version is ready instead of reloading under them; applying it is their tap. */
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    const bar = document.createElement('div');
    bar.className = 'update'; bar.setAttribute('role', 'status');
    bar.innerHTML = '<span>A new version is ready.</span><button class="btn primary" type="button">Reload</button>';
    bar.querySelector('button')!.onclick = () => void updateSW(true);
    document.body.append(bar);
  }
});
const app = document.getElementById('app')!;
let token = 0; // cancels in-flight line playback when the screen changes

const href = (...p: string[]) => `#/${p.join('/')}`;
/** Placeholder markup for a shapes board; call drawBoard afterwards. */
const boardSlot = (id: string, b?: PlanBoard, hero = false) => (b ? `<div class="board-wrap ${hero ? 'hero' : 'small'}"><div id="${id}" class="cg-wrap"></div></div>` : '');
function drawBoard(id: string, o: Opening, v: Variation, b?: PlanBoard) {
  const el = document.getElementById(id);
  if (el && b) staticBoard(el, o.color, fenAfter(v.moves.map(m => m.san), b.ply), b.shapes);
}
/** First sentence of a text, for the one-line takeaway under a hero board; the rest goes behind a fold. */
const splitLead = (text: string): [string, string] => {
  const m = text.match(/^(.+?[.!?])(\s+|$)/s);
  return m ? [m[1], text.slice(m[0].length)] : [text, ''];
};
const fold = (rest: string, list: string[], label: string) => (rest || list.length)
  ? `<details class="more"><summary>${label}</summary>${rest ? `<p>${esc(rest)}</p>` : ''}${list.length ? `<ul>${list.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}</details>` : '';
const goalVariation = (o: Opening) => o.variations.find(v => v.id === o.goal.board?.variation);
const masteryOf = (o: Opening, v: Variation) => {
  const p = getProgress(), k = key(o, v);
  return lineMastery(k, o.color, v.moves.length, p.attempts, p.cards[k]);
};
/** Check every badge against the current state and store the new ones. Returns the ids that were just earned. */
const refreshBadges = () => grantBadges(earnedNow({
  xp: getProgress().xp, levels: openings.flatMap(o => o.variations.map(v => masteryOf(o, v).level))
}));
const goalKey = (o: Opening) => `goal:${o.id}`;
const lookup = (k: string): [Opening, Variation] | undefined => {
  const [oid, vid] = k.split('/'); const o = findOpening(oid); const v = o && findVariation(o, vid);
  return o && v && !isShelved(o.id) ? [o, v] : undefined; // saved-for-later openings stay out of Drill and Mistakes
};

const SYNC_TEXT: Record<SyncStatus, string> = {
  off: 'Sync is off.', ok: 'Synced.', unauthorized: 'Wrong token. Tap Set up sync again.', offline: 'Could not reach the server.'
};
let syncText = '';
async function runSync(rerender: boolean) {
  const status = await syncNow();
  syncText = SYNC_TEXT[status];
  if (status === 'unauthorized') await setToken('');
  const screen = location.hash.slice(2);
  if (rerender && (!screen || screen === 'settings')) route();
  else { const el = document.getElementById('sync-msg'); if (el) el.textContent = syncText; }
}

function home() {
  const due = dueKeys().filter(k => lookup(k)).length;
  const trouble = troubleSpots(getProgress().attempts, lookup).length;
  const fresh = refreshBadges(), prog = getProgress();
  const streak = streaks(prog.xp), today = prog.xp[dayKey()] ?? 0, next = BADGES.find(b => !prog.badges[b.id]);
  const lv = levelFor(totalXp(prog.xp));
  let levelUp = false; // best effort: the last level shown is kept on this device only
  try { const seen = Number(localStorage.getItem('level-seen') ?? 0); levelUp = seen > 0 && lv.n > seen; localStorage.setItem('level-seen', String(lv.n)); } catch { /* storage unavailable */ }
  const progressCard = `<div class="card">
    <div class="row between"><b>Level ${lv.n} · ${esc(lv.title)}</b>${levelUp ? '<span class="tag">Level up!</span>' : ''}</div>
    <div class="goal"><i style="width:${lv.span ? Math.round((lv.into / lv.span) * 100) : 100}%"></i></div>
    <div class="muted">${lv.next ? `${lv.span - lv.into} XP to ${esc(lv.next)}` : 'Top title reached'}</div>
    <div class="row between"><b>${streak.current}-day streak</b><span class="muted">Best ${streak.best} · ${totalXp(prog.xp)} XP</span></div>
    <div class="goal"><i style="width:${Math.min(100, Math.round((today / DAILY_GOAL) * 100))}%"></i></div>
    <div class="muted">Today ${today} / ${DAILY_GOAL} XP${today >= DAILY_GOAL ? ' · goal reached' : ''}</div>
    <div class="row">${BADGES.filter(b => prog.badges[b.id]).map(b => `<span class="tag">${esc(b.name)}${fresh.includes(b.id) ? ' · new' : ''}</span>`).join('')}</div>
    ${next ? `<div class="muted">Next badge: ${esc(next.name)}. ${esc(next.hint)}</div>` : ''}</div>`;
  const saved = openings.filter(o => isShelved(o.id));
  app.innerHTML = `
  <main class="page">
    <div class="row between head"><h1>Opening Goals</h1><a class="gear" href="${href('settings')}" aria-label="Settings">${GEAR}</a></div>
    <p class="muted">Learn the plan first, then the line.</p>
    ${progressCard}
    <a class="btn primary big" href="${href('drill')}">Drill ${due ? `· ${due} due` : '· nothing due'}</a>
    <a class="btn big" href="${href('mistakes')}">Mistakes${trouble ? ` · ${trouble}` : ''}</a>
    <h2>Openings</h2>
    ${openings.filter(o => !isShelved(o.id)).map(o => {
      const done = o.variations.filter(v => isLearned(key(o, v))).length;
      const solid = o.variations.filter(v => LEVELS.indexOf(masteryOf(o, v).level) >= 3).length;
      return `<div class="card opening"><a class="link" href="${href('o', o.id)}">
        <span class="dot ${o.color}"></span><div><b>${esc(o.name)}</b>
        <div class="muted">${esc(o.summary)}</div>
        <div class="tag">${o.color === 'white' ? 'White' : 'Black'} · ${done}/${o.variations.length} learned${solid ? ` · ${solid} solid` : ''}${o.status === 'draft' ? ' · draft' : ''}</div></div></a>
        <div class="row"><button class="chip" type="button" data-later="${o.id}">Save for later</button></div></div>`;
    }).join('')}
    ${saved.length ? `<details class="more saved"><summary>Saved for later · ${saved.length}</summary>
      ${saved.map(o => `<div class="saved-row"><a href="${href('o', o.id)}"><b>${esc(o.name)}</b><span class="muted"> · ${o.color === 'white' ? 'White' : 'Black'}</span></a>
        <button class="chip" type="button" data-back="${o.id}">Bring back</button></div>`).join('')}
      <p class="muted">Saved openings are hidden here and left out of Drill and Mistakes. Your progress on them is kept.</p></details>` : ''}
  </main>`;
  app.querySelectorAll<HTMLButtonElement>('[data-later]').forEach(b => { b.onclick = () => { setShelved(b.dataset.later!, true); route(); }; });
  app.querySelectorAll<HTMLButtonElement>('[data-back]').forEach(b => { b.onclick = () => { setShelved(b.dataset.back!, false); route(); }; });
}

function settingsPage() {
  app.innerHTML = `<main class="page"><a class="back" href="#/">← Home</a><h1>Settings</h1>
    <h2>Backup &amp; sync</h2>
    <div class="card"><p class="muted">Your progress lives on this device. Sync copies it to your own Cloudflare Worker so another device can pick it up; export keeps a copy you can paste somewhere safe.</p>
    <div class="row"><button class="btn" id="sync">${hasToken() ? 'Sync now' : 'Set up sync'}</button><span class="muted" id="sync-msg">${esc(syncText)}</span></div>
    <div class="row"><button class="btn" id="exp">Export progress</button><button class="btn" id="imp">Import</button></div></div>
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

function mistakesPage() {
  const spots = troubleSpots(getProgress().attempts, lookup);
  const times = (n: number, what: string) => (n ? `${what} ${n}×` : '');
  app.innerHTML = `<main class="page"><a class="back" href="#/">← Home</a><h1>Mistakes</h1>
    <p class="muted">The positions that cost you the most in the last 30 days. The explanations come from the line itself and never show the answer.</p>
    ${spots.length ? spots.map((t, i) => { const [o, v] = lookup(t.k)!; return `<div class="card">
      <div class="tag">${esc(o.name)} · ${esc(v.name)}</div><b>Move ${Math.floor(t.p / 2) + 1}</b>
      ${boardSlot('trouble-' + i, { ply: t.p, shapes: [] })}
      <p id="trouble-text-${i}">${esc(t.last.text)}</p><span class="tag" id="trouble-ai-${i}" hidden>AI-generated explanation</span>
      <div class="muted">${[times(t.count, 'Wrong'), times(t.hints, 'Hint'), times(t.slow, 'Slow')].filter(Boolean).join(' · ')}</div>
      <div class="row"><a class="btn primary" href="${href('practice', o.id, v.id)}">Practice this line</a></div></div>`; }).join('')
      : `<div class="card"><b>No trouble spots right now.</b><p class="muted">Mistakes, hints and slow moves from Practice and Drill show up here.</p></div>`}
  </main>`;
  spots.forEach((t, i) => { const [o, v] = lookup(t.k)!; drawBoard('trouble-' + i, o, v, { ply: t.p, shapes: [] }); });
  // Optional: rephrase the rule-based text with Workers AI (only when sync is set up, so the Worker accepts us). Any failure keeps the rule-based text.
  if (!hasToken() || !navigator.onLine) return;
  const my = token;
  spots.forEach(async (t, i) => {
    const [o, v] = lookup(t.k)!;
    const text = await aiExplain({ opening: o.name, line: v.name, plan: o.goal.title, side: o.color, moveNumber: Math.floor(t.p / 2) + 1,
      kind: t.last.kind, ...(t.played ? { played: t.played } : {}), wrong: t.count, hints: t.hints, slow: t.slow, rule: t.last.text });
    const el = document.getElementById(`trouble-text-${i}`), tag = document.getElementById(`trouble-ai-${i}`);
    if (text && el && tag && my === token) { el.textContent = text; tag.hidden = false; }
  });
}

function openingPage(o: Opening) {
  app.innerHTML = `
  <main class="page"><a class="back" href="#/">← Openings</a>
    <h1>${esc(o.name)}</h1>
    <div class="row"><button class="chip" type="button" id="shelve">${isShelved(o.id) ? 'Bring back to Home' : 'Save for later'}</button></div>
    <div class="card hero-card"><div class="tag">Positional goal</div>
      ${boardSlot('goal-board', o.goal.board, true)}
      <h3>${esc(o.goal.title)}</h3><p class="lead">${esc(splitLead(o.goal.text)[0])}</p>
      ${fold(splitLead(o.goal.text)[1], o.goal.plans, 'The full plan')}</div>
    <h2>Variations</h2>
    ${o.variations.map(v => { const m = masteryOf(o, v); return `<div class="card"><b>${esc(v.name)}</b>
      <p class="muted">${esc(v.strategy)}</p>
      ${lineReach(o, v) !== undefined ? `<p class="muted">${esc(reachText(lineReach(o, v)))}</p>` : ''}
      <div class="row"><a class="btn primary" href="${href('learn', o.id, v.id)}">Learn</a>
      <a class="btn" href="${href('practice', o.id, v.id)}">Practice</a>
      <span class="tag">${m.level}</span></div>
      <p class="muted">${m.hint}</p></div>`; }).join('')}
  </main>`;
  const gv = goalVariation(o); if (gv) drawBoard('goal-board', o, gv, o.goal.board);
  document.getElementById('shelve')!.onclick = () => { setShelved(o.id, !isShelved(o.id)); location.hash = '#/'; };
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
    const [lead, rest] = splitLead(s.body);
    const board = s.board ?? (s.from ? { ply: s.from.moves.length, shapes: [] } : undefined); // no hand-made board: show where the line ends
    app.innerHTML = `<main class="page learn"><a class="back" href="${href('o', o.id)}">← ${esc(o.name)}</a>
      <div class="steps" aria-hidden="true">${steps.map((_, n) => `<i class="${n <= i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="tag">${s.tag}</div>
      ${boardSlot('step-board', board, true)}
      <h2 class="hero-title">${esc(s.title)}</h2><p class="lead">${esc(lead)}</p>
      ${fold(rest, s.list, 'Read more')}
      <button class="btn primary big" id="go">${i === steps.length - 1 ? 'Show me the line' : 'Next: the strategy'}</button></main>`;
    if (s.from && board) drawBoard('step-board', o, s.from, board);
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

const endBtns = `<button class="btn primary" id="again" hidden>Again</button><button class="btn" id="done" hidden>Done</button>`;

async function practice(o: Opening, v: Variation) {
  const my = ++token;
  app.innerHTML = screenShell('Practice', esc(o.name), `${hintBtn}${endBtns}`);
  const run = async () => {
    btn('again').hidden = true; btn('done').hidden = true;
    const mistakes = await playLine(ui(), o, v, { stopped: () => my !== token, onAttempt: a => logAttempt({ ...a, k: key(o, v), m: 'p' }) });
    if (my !== token) return;
    if (mistakes === 0) { markLearned(key(o, v)); awardLineBonus(); }
    btn('again').hidden = false; btn('done').hidden = false;
    btn('done').onclick = () => { location.hash = href('o', o.id); };
    btn('again').onclick = () => { app.innerHTML = screenShell('Practice', esc(o.name), `${hintBtn}${endBtns}`); void run(); };
  };
  void run();
}

async function drill() {
  const my = ++token;
  const allDue = dueKeys().filter(k => lookup(k));
  const queue = allDue.slice(0, DRILL_CAP);
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
    if (mistakes === 0) awardLineBonus();
    combo = mistakes === 0 ? combo + 1 : 0; setBestCombo(combo);
    await new Promise<void>(res => { const b = btn('nextline'); b.hidden = false; b.onclick = () => res(); });
    if (my !== token) return;
    // Once a line is familiar, check it from the middle once a day. This feeds mastery only; it does not reschedule the line.
    const m = masteryOf(o, v), from = pickSpotCheck(m);
    if (LEVELS.indexOf(m.level) >= 2 && from !== undefined && !hadSpotCheckToday(k, getProgress().attempts)) {
      app.innerHTML = screenShell('Spot check', esc(o.name), `${hintBtn}<button class="btn primary" id="nextline" hidden>Next</button>`);
      await playLine(ui(), o, v, { stopped: () => my !== token, startPly: from, onAttempt: a => logAttempt({ ...a, k, m: 'd', o: 1 }) });
      if (my !== token) return;
      await new Promise<void>(res => { const b = btn('nextline'); b.hidden = false; b.onclick = () => res(); });
      if (my !== token) return;
    }
  }
  app.innerHTML = `<main class="page"><h1>Drill complete</h1><div class="card"><b>Best combo: ×${getProgress().bestCombo}</b>
    ${allDue.length > queue.length ? `<p class="muted">${allDue.length - queue.length} more ${allDue.length - queue.length === 1 ? 'line is' : 'lines are'} still due. Drill again when you are ready.</p>` : ''}</div>
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
  else if (a === 'mistakes') mistakesPage();
  else if (a === 'settings') settingsPage();
  else home();
  window.scrollTo(0, 0);
}
// iOS may evict site storage for rarely used apps; ask for durable storage so progress survives (best effort, a no-op where unsupported)
void navigator.storage?.persist?.().catch(() => {});
await loadProgress();
window.addEventListener('hashchange', route);
route();
if (hasToken()) void runSync(true).then(() => { if (!location.hash.slice(2)) route(); });
