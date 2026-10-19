import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { openings, findOpening, findVariation, key } from './content.ts';
import { addQuestion, awardLineBonus, clearFlags, dueKeys, exportProgress, getProgress, grantBadges, hasToken, importProgress, isLearned, isShelved, loadProgress, logAttempt, markLearned, review, setBestCombo, setGames, setShelved, setToken, syncNow, type SyncStatus } from './store.ts';
import { moveLabel, playLine, walkLine, type Ui } from './play.ts';
import { fenAfter, staticBoard } from './board.ts';
import { lineViewerSlot, mountLineViewer } from './lineview.ts';
import { LEVELS, hadSpotCheckToday, lineMastery, pickSpotCheck } from './mastery.ts';
import { troubleSpots } from './mistakes.ts';
import { analyzeGames, gameAttempts, gameMistakeText, gradeOf, mergeImports, IMPORT_VERSION } from './games.ts';
import { fmtEval } from './grade.ts';
import { fetchGames, FIRST_GAMES, LATER_GAMES, USERNAME } from './chesscom.ts';
import { aiExplain } from './ai.ts';
import { lineReach, reachText } from './stats.ts';
import { earnedNow, levelFor, totalXp } from './gamify.ts';
import { esc, screenShell } from './ui.ts';
import { goTo, installNavLinks, trackEntry } from './nav.ts';
import { answers } from './answers.ts';
import type { Opening, PlanBoard, Variation } from './types.ts';

const GEAR = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
const DEFAULT_CC_USER = 'bibleoverthinker'; // the owner's chess.com name, prefilled in Settings
const DRILL_CAP = 5; // lines per Drill session; a short, relaxed sitting. The rest stay due for next time
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
/** Words come first; a board is one tap away for when a picture really helps. */
const boardFold = (id: string, b?: PlanBoard, label = 'Show on the board') => (b
  ? `<details class="more" id="${id}-fold"><summary>${label}</summary><div class="board-wrap hero"><div id="${id}" class="cg-wrap"></div></div></details>` : '');
/** Draw the folded board the first time it is opened (Chessground needs a visible, sized element). */
function drawOnOpen(id: string, o: Opening, v: Variation | undefined, b?: PlanBoard) {
  const d = document.getElementById(`${id}-fold`) as HTMLDetailsElement | null;
  if (!d || !v || !b) return;
  d.addEventListener('toggle', () => { if (d.open && !document.getElementById(id)!.firstChild) drawBoard(id, o, v, b); });
}
/** First sentence of a text, for the one-line takeaway under a hero board; the rest goes behind a fold. */
const splitLead = (text: string): [string, string] => {
  const m = text.match(/^(.+?[.!?])(\s+|$)/s);
  return m ? [m[1], text.slice(m[0].length)] : [text, ''];
};
const fold = (rest: string, list: string[], label: string) => (rest || list.length)
  ? `<details class="more"><summary>${label}</summary>${rest ? `<p>${esc(rest)}</p>` : ''}${list.length ? `<ul>${list.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}</details>` : '';
/** The move-by-move picture of a line, folded away until asked for; it is drawn the first time it opens. */
const viewFold = (id: string) => `<details class="more" id="${id}-fold"><summary>Walk the line on the board</summary>${lineViewerSlot(id)}</details>`;
function mountOnOpen(id: string, o: Opening, v: Variation) {
  const d = document.getElementById(`${id}-fold`) as HTMLDetailsElement | null, host = document.getElementById(id);
  if (d && host) d.addEventListener('toggle', () => { if (d.open && !host.firstChild) mountLineViewer(host, o, v); });
}
const goalVariation = (o: Opening) => o.variations.find(v => v.id === o.goal.board?.variation);
const masteryOf = (o: Opening, v: Variation) => {
  const p = getProgress(), k = key(o, v);
  return lineMastery(k, o.color, v.moves.length, [...p.attempts, ...gameAttempts(p.games, k)], p.cards[k]);
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
  const waiting = getProgress().questions.filter(q => !answers[q.id]).length;
  const fromGames = gameSpots().length;
  refreshBadges(); // still earned quietly in the background
  const prog = getProgress(), lv = levelFor(totalXp(prog.xp));
  let levelUp = false; // best effort: the last level shown is kept on this device only
  try { const seen = Number(localStorage.getItem('level-seen') ?? 0); levelUp = seen > 0 && lv.n > seen; localStorage.setItem('level-seen', String(lv.n)); } catch { /* storage unavailable */ }
  const progressCard = `<div class="quiet"><span>${esc(lv.title)}</span>${levelUp ? '<span class="tag">Level up!</span>' : ''}
    <div class="goal"><i style="width:${lv.span ? Math.round((lv.into / lv.span) * 100) : 100}%"></i></div></div>`;
  const saved = openings.filter(o => isShelved(o.id));
  app.innerHTML = `
  <main class="page">
    <div class="row between head"><h1>Opening Goals</h1><a class="gear" href="${href('settings')}" aria-label="Settings">${GEAR}</a></div>
    <p class="muted">Learn the plan first, then the line.</p>
    ${progressCard}
    <a class="btn primary big" href="${href('drill')}">${due ? 'Play a few lines' : 'Nothing to review. Enjoy your day.'}</a>
    <div class="row links"><a href="${href('mistakes')}">Tricky spots${trouble ? ` (${trouble})` : ''}</a><a href="${href('ask')}">Questions${waiting ? ` (${waiting})` : ''}</a>${fromGames ? `<a href="${href('games')}">From your games (${fromGames})</a>` : ''}</div>
    <h2>Openings</h2>
    ${openings.filter(o => !isShelved(o.id)).map(o => {
      const done = o.variations.filter(v => isLearned(key(o, v))).length;
      const solid = o.variations.filter(v => LEVELS.indexOf(masteryOf(o, v).level) >= 3).length;
      return `<div class="card opening"><a class="link" href="${href('o', o.id)}">
        <span class="dot ${o.color}"></span><div><b>${esc(o.name)}</b>
        <div class="muted">${esc(o.summary)}</div>
        <div class="tag">${o.color === 'white' ? 'White' : 'Black'} · ${done}/${o.variations.length} learned${solid ? ` · ${solid} solid` : ''}${o.status === 'draft' ? ' · draft' : ''}</div></div></a>
        <div class="row"><button class="pill" type="button" data-later="${o.id}">Save for later</button></div></div>`;
    }).join('')}
    ${saved.length ? `<details class="more saved"><summary>Saved for later · ${saved.length}</summary>
      ${saved.map(o => `<div class="saved-row"><a href="${href('o', o.id)}"><b>${esc(o.name)}</b><span class="muted"> · ${o.color === 'white' ? 'White' : 'Black'}</span></a>
        <button class="pill" type="button" data-back="${o.id}">Bring back</button></div>`).join('')}
      <p class="muted">Saved openings are hidden here and left out of Drill and Mistakes. Your progress on them is kept.</p></details>` : ''}
  </main>`;
  app.querySelectorAll<HTMLButtonElement>('[data-later]').forEach(b => { b.onclick = () => { setShelved(b.dataset.later!, true); route(); }; });
  app.querySelectorAll<HTMLButtonElement>('[data-back]').forEach(b => { b.onclick = () => { setShelved(b.dataset.back!, false); route(); }; });
}

/** The flagged moves as readable lines, newest first. Each carries the stable id (`opening/line#ply`) that HANDOFF.md and the content files use. */
function flaggedMoves() {
  return Object.entries(getProgress().flags).sort((x, y) => y[1] - x[1]).flatMap(([fk]) => {
    const [k, ply] = fk.split('#'), found = lookup(k), p = Number(ply), m = found?.[1].moves[p];
    if (!found || !m) return [];
    const [o, v] = found;
    return [{ fk, label: `${o.name} · ${v.name} · ${moveLabel(p, m.san)} (${fk}): ${m.note}` }];
  });
}

/** What the last chess.com import found, as readable lines (the worst spots first). */
function gameFindings() {
  const g = getProgress().games;
  if (!g?.games) return '';
  const seen = new Set<string>(); // one position can sit in several lines of an opening; list it once
  const rows = g.mistakes.flatMap(x => {
    const found = lookup(x.k), id = `${found?.[0].id}#${x.p}#${x.s}`;
    if (!found || seen.has(id)) return [];
    seen.add(id);
    return [`<li>${esc(found[0].name)} · ${esc(found[1].name)} · move ${Math.floor(x.p / 2) + 1}: you played <b>${esc(x.s)}</b> ${x.n}× (${x.w} won, ${x.d} drawn, ${x.l} lost)</li>`];
  }).slice(0, 8);
  return `<p class="muted">${g.games} games read for ${esc(g.user)} on ${esc(new Date(g.at).toLocaleDateString())}. You left your line on your own move in ${g.left} and followed it until the opponent left in ${g.kept}. Each import adds only games you have not imported yet. Practice and Drill now show these mistakes instead of the hand-written ones, on every move that has one.</p>
    ${rows.length ? `<ul>${rows.join('')}</ul><div class="row"><a class="btn primary" href="${href('games')}">Practice these</a></div>` : '<p class="muted">No deviations found. The hand-written mistakes stay.</p>'}`;
}

function settingsPage() {
  const flagged = flaggedMoves();
  app.innerHTML = `<main class="page"><a class="back" data-goback href="#/">← Home</a><h1>Settings</h1>
    <h2>Backup &amp; sync</h2>
    <div class="card"><p class="muted">Your progress lives on this device. Sync copies it to your own Cloudflare Worker so another device can pick it up; export keeps a copy you can paste somewhere safe.</p>
    <div class="row"><button class="btn" id="sync">${hasToken() ? 'Sync now' : 'Set up sync'}</button><span class="muted" id="sync-msg">${esc(syncText)}</span></div>
    <div class="row"><button class="btn" id="exp">Export progress</button><button class="btn" id="imp">Import</button></div></div>
    <h2>Your chess.com games</h2>
    <div class="card"><p class="muted">Reads your latest ${FIRST_GAMES} games from chess.com the first time, then only games you have not imported yet (looking at the newest ${LATER_GAMES}). It is free public data: no key, no password. Those mistakes then replace the hand-written ones in Practice and Drill. Nothing is sent anywhere but chess.com.</p>
    <input id="cc-user" type="text" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="chess.com username" aria-label="chess.com username" value="${esc(getProgress().games?.user ?? DEFAULT_CC_USER)}">
    <div class="row"><button class="btn primary" id="cc-go">${getProgress().games?.games ? 'Import new games' : 'Import games'}</button><button class="btn" id="cc-clear" ${getProgress().games?.games ? '' : 'disabled'}>Use hand-written again</button></div>
    <p class="muted" id="cc-msg" role="status"></p>${gameFindings()}</div>
    <h2>Flagged for more explanation</h2>
    <div class="card"><p class="muted">Moves you marked with "Need more explanation". Copy the list and paste it at the start of the next session (with sync on, they also travel with your progress) so the explanation gets written; clear it once handed over.</p>
    ${flagged.length ? `<ul>${flagged.map(f => `<li>${esc(f.label)}</li>`).join('')}</ul>` : '<p class="muted">Nothing flagged.</p>'}
    <div class="row"><button class="btn" id="fcopy" ${flagged.length ? '' : 'disabled'}>Copy list</button><button class="btn" id="fclear" ${flagged.length ? '' : 'disabled'}>Clear after hand-off</button></div></div>
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
  const ccMsg = (t: string) => { document.getElementById('cc-msg')!.textContent = t; };
  document.getElementById('cc-go')!.onclick = async () => {
    const user = (document.getElementById('cc-user') as HTMLInputElement).value.trim();
    if (!USERNAME.test(user)) return ccMsg('Type your chess.com username first.');
    if (!navigator.onLine) return ccMsg('You are offline. Try again with a connection.');
    const go = btn('cc-go'); go.disabled = true;
    try {
      const prev = getProgress().games, more = !!prev?.games && prev.ver === IMPORT_VERSION && prev.user.toLowerCase() === user.toLowerCase(); // same user again: only what is new (an import from before grading is read again in full)
      const raw = await fetchGames(user, { progress: ccMsg, max: more ? LATER_GAMES : FIRST_GAMES, months: more ? 2 : 6 });
      const fresh = more ? raw.filter(g => (g.end_time ?? 0) > prev!.last) : raw;
      if (!fresh.length) { ccMsg(more ? 'No new games since your last import.' : 'No games found for that user.'); go.disabled = false; return; }
      const result = analyzeGames(fresh, user, openings);
      if (!more && !result.games) { ccMsg(`Found ${raw.length} games but none were standard chess played by ${user}.`); go.disabled = false; return; }
      setGames(more ? mergeImports(prev!, result) : result); settingsPage();
    } catch (e) { ccMsg(e instanceof Error ? e.message : 'Could not read your games.'); go.disabled = false; }
  };
  document.getElementById('cc-clear')!.onclick = () => { if (confirm('Go back to the hand-written mistakes?')) { const g = getProgress().games; setGames({ user: g?.user ?? '', at: Date.now(), last: 0, games: 0, left: 0, kept: 0, mistakes: [] }); settingsPage(); } };
  document.getElementById('fcopy')!.onclick = async () => {
    const text = `Moves flagged "need more explanation":\n${flagged.map(f => `- ${f.label}`).join('\n')}`;
    try { await navigator.clipboard.writeText(text); alert('Copied. Paste it into the next session.'); } catch { prompt('Copy this list:', text); }
  };
  document.getElementById('fclear')!.onclick = () => { if (confirm('Clear all flagged moves? Do this after you handed the list over.')) { clearFlags(); settingsPage(); } };
  document.getElementById('imp')!.onclick = () => {
    const raw = prompt('Paste exported progress:');
    if (raw) { try { importProgress(raw); route(); } catch { alert('That is not valid progress data.'); } }
  };
}

/** Where a question was asked: opening, line and move, from the move id. */
function questionContext(k?: string) {
  if (!k) return 'General question';
  const [vk, ply] = k.split('#'), found = lookup(vk), p = Number(ply), m = found?.[1].moves[p];
  return found && m ? `${found[0].name} · ${found[1].name} · ${moveLabel(p, m.san)}` : 'A move that has since changed';
}
const when = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function askPage() {
  const list = [...getProgress().questions].reverse();
  app.innerHTML = `<main class="page"><a class="back" data-goback href="#/">← Home</a><h1>Ask a question</h1>
    <p class="muted">Anything about an opening, a line or a move. Questions are stored with your progress and reviewed once a day; the answer appears here after the next update. To ask about one move, use "Ask a question" while you learn or practice it.</p>
    ${hasToken() ? '' : '<div class="card"><b>Sync is off.</b><p class="muted">The daily review reads questions from your synced copy, so set up sync in Settings first or it will never see them.</p></div>'}
    <div class="card"><textarea id="qtext" rows="3" maxlength="500" placeholder="Your question" aria-label="Your question"></textarea>
    <div class="row"><button class="btn primary" id="qsend">Send</button><span class="muted" id="qmsg"></span></div></div>
    <h2>Your questions</h2>
    ${list.length ? list.map(q => { const a = answers[q.id]; return `<div class="card"><div class="tag">${esc(questionContext(q.k))} · ${esc(when(q.t))}</div>
      <p><b>${esc(q.q)}</b></p>${a ? `<p>${esc(a.a)}</p><div class="muted">Answered ${esc(when(a.t))}</div>` : '<p class="muted">Waiting for the daily review.</p>'}</div>`; }).join('')
      : '<div class="card"><p class="muted">No questions yet.</p></div>'}
  </main>`;
  document.getElementById('qsend')!.onclick = () => {
    const el = document.getElementById('qtext') as HTMLTextAreaElement;
    if (addQuestion(el.value)) askPage(); else document.getElementById('qmsg')!.textContent = 'Type a question first.';
  };
}

function mistakesPage() {
  const spots = troubleSpots(getProgress().attempts, lookup);
  const times = (n: number, what: string) => (n ? `${what} ${n}×` : '');
  app.innerHTML = `<main class="page"><a class="back" data-goback href="#/">← Home</a><h1>Mistakes</h1>
    <p class="muted">The positions that cost you the most in the last 30 days. The explanations come from the line itself and never show the answer.</p>
    ${spots.length ? spots.map((t, i) => { const [o, v] = lookup(t.k)!; return `<div class="card">
      <div class="tag">${esc(o.name)} · ${esc(v.name)}</div><b>Move ${Math.floor(t.p / 2) + 1}</b>
      <p id="trouble-text-${i}">${esc(t.last.text)}</p><span class="tag" id="trouble-ai-${i}" hidden>AI-generated explanation</span>
      ${boardFold('trouble-' + i, { ply: t.p, shapes: [] }, 'Show the position')}
      <div class="muted">${[times(t.count, 'Wrong'), times(t.hints, 'Hint'), times(t.slow, 'Slow')].filter(Boolean).join(' · ')}</div>
      <div class="row"><a class="btn primary" href="${href('practice', o.id, v.id)}">Practice this line</a></div></div>`; }).join('')
      : `<div class="card"><b>No trouble spots right now.</b><p class="muted">Mistakes, hints and slow moves from Practice and Drill show up here.</p></div>`}
  </main>`;
  spots.forEach((t, i) => { const [o, v] = lookup(t.k)!; drawOnOpen('trouble-' + i, o, v, { ply: t.p, shapes: [] }); });
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

/** The positions where the owner left their line in real games, most frequent first, one row per position and move (a position can sit in several lines). */
function gameSpots() {
  const seen = new Set<string>();
  return (getProgress().games?.mistakes ?? []).flatMap(x => {
    const found = lookup(x.k), id = `${found?.[0].id}#${x.p}#${x.s}`;
    if (!found || seen.has(id)) return [];
    seen.add(id);
    return [{ x, o: found[0], v: found[1] }];
  });
}

function gamesPage() {
  const all = gameSpots(), spots = all.slice(0, 20), g = getProgress().games;
  const graded = all.map(s => ({ ...s, gr: gradeOf(s.x, s.o.color) }));
  const count = (grade: string) => graded.filter(s => s.gr?.grade === grade).reduce((n, s) => n + s.x.n, 0);
  const summary = graded.some(s => s.gr)
    ? `<div class="card"><b>Report card</b><p class="muted">${g!.games} games read. Where you left your lines: ${count('blunder')} blunders, ${count('mistake')} mistakes, ${count('inaccuracy')} inaccuracies, ${count('good')} playable moves that were simply not your line.</p></div>` : '';
  const line = (s: (typeof graded)[number]) => {
    const own = s.v.moves[s.x.p], mine = own.eval * (s.o.color === 'white' ? 1 : -1), e = s.gr;
    const top = e && e.best.san !== own.san && e.best.mine - mine >= 0.2 ? ` The engine's top move here is ${esc(e.best.san)} (${fmtEval(e.best.mine)}).` : '';
    return `<p><b>Your line plays ${esc(own.san)}</b> <span class="muted">(${fmtEval(mine)} for you)</span><br>${esc(own.note)}${top}</p>`;
  };
  app.innerHTML = `<main class="page"><a class="back" data-goback href="#/">← Home</a><h1>From your games</h1>
    <p class="muted">Where you left your line in your own chess.com games, graded by the engine. Practice starts at that position, and the slip plays out if you repeat it.</p>
    ${summary}
    ${spots.length ? spots.map(({ x, o, v }, i) => { const s = graded.find(t => t.x === x)!; return `<div class="card"><div class="tag">${esc(o.name)} · ${esc(v.name)}</div>
      <b>Move ${Math.floor(x.p / 2) + 1}: you played ${esc(x.s)}${s.gr ? ` <span class="grade ${s.gr.grade}">${esc(s.gr.label)} ${esc(s.gr.mark)}</span>` : ''}</b>
      <p>${esc(gameMistakeText(x, s.gr))}</p>
      ${line(s)}
      ${x.line.length ? `<p class="muted">What followed in your game: ${esc(x.line.join(' '))}</p>` : ''}
      ${boardFold('game-' + i, { ply: x.p, shapes: [] }, 'Show the position')}
      <div class="row"><a class="btn primary" href="${href('practice', o.id, v.id, String(x.p))}">Practice from here</a>${x.u ? `<a class="btn" href="${esc(x.u)}" target="_blank" rel="noopener">Open the game</a>` : ''}</div></div>`; }).join('')
      : `<div class="card"><b>${g?.games ? 'No deviations found.' : 'No games imported yet.'}</b><p class="muted">${g?.games ? 'You followed your lines in the games read.' : 'Import your chess.com games in Settings.'}</p><div class="row"><a class="btn" href="${href('settings')}">Settings</a></div></div>`}
  </main>`;
  spots.forEach(({ x, o, v }, i) => drawOnOpen('game-' + i, o, v, { ply: x.p, shapes: [] }));
}

function openingPage(o: Opening) {
  app.innerHTML = `
  <main class="page"><a class="back" data-goback href="#/">← Openings</a>
    <h1>${esc(o.name)}</h1>
    <div class="row"><button class="pill" type="button" id="shelve">${isShelved(o.id) ? 'Bring back to Home' : 'Save for later'}</button></div>
    <div class="card hero-card"><div class="tag">Positional goal</div>
      <h3>${esc(o.goal.title)}</h3><p class="lead">${esc(splitLead(o.goal.text)[0])}</p>
      ${fold(splitLead(o.goal.text)[1], o.goal.plans, 'The full plan')}
      ${boardFold('goal-board', o.goal.board)}</div>
    <h2>Variations</h2>
    ${o.variations.map((v, i) => { const m = masteryOf(o, v), [lead, rest] = splitLead(v.strategy); return `<div class="card"><b>${esc(v.name)}</b>
      <p class="muted">${esc(lead)}</p>
      ${viewFold('lv-' + i)}
      ${fold(rest, [], 'Read the strategy')}
      ${lineReach(o, v) !== undefined ? `<p class="muted">${esc(reachText(lineReach(o, v)))}</p>` : ''}
      <div class="row"><a class="btn primary" href="${href('learn', o.id, v.id)}">Learn</a>
      <a class="btn" href="${href('practice', o.id, v.id)}">Practice</a>
      <span class="tag">${m.level}</span></div>
      <p class="muted">${m.hint}</p></div>`; }).join('')}
  </main>`;
  drawOnOpen('goal-board', o, goalVariation(o), o.goal.board);
  o.variations.forEach((v, i) => mountOnOpen('lv-' + i, o, v));
  document.getElementById('shelve')!.onclick = () => { setShelved(o.id, !isShelved(o.id)); goTo('#/'); };
}

function learn(o: Opening, v: Variation) {
  const steps: { tag: string; title: string; body: string; list: string[]; board?: PlanBoard; from?: Variation; viewer?: boolean }[] = [
    ...(isLearned(goalKey(o)) ? [] : [{ tag: 'Step 1 · Positional goal', title: o.goal.title, body: o.goal.text, list: o.goal.plans, board: o.goal.board, from: goalVariation(o) }]),
    { tag: 'Strategy for this variation', title: v.name, body: v.strategy, list: [] as string[], board: v.board, from: v, viewer: true }
  ];
  let i = 0;
  const showStep = () => {
    window.scrollTo(0, 0);
    const s = steps[i];
    const [lead, rest] = splitLead(s.body);
    const board = s.board ?? (s.from ? { ply: s.from.moves.length, shapes: [] } : undefined); // no hand-made board: show where the line ends
    app.innerHTML = `<main class="page learn"><a class="back" data-goback href="${href('o', o.id)}">← ${esc(o.name)}</a>
      <div class="steps" aria-hidden="true">${steps.map((_, n) => `<i class="${n <= i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="tag">${s.tag}</div>
      <h2 class="hero-title">${esc(s.title)}</h2><p class="lead">${esc(lead)}</p>
      ${fold(rest, s.list, 'Read more')}
      ${s.viewer ? lineViewerSlot('step-view') : boardFold('step-board', s.from ? board : undefined)}
      <button class="btn primary big" id="go">${i === steps.length - 1 ? 'Show me the line' : 'Next: the strategy'}</button></main>`;
    if (s.viewer) mountLineViewer(document.getElementById('step-view')!, o, v); else drawOnOpen('step-board', o, s.from, board);
    document.getElementById('go')!.onclick = () => {
      if (i === 0 && steps.length === 2) markLearned(goalKey(o));
      if (i < steps.length - 1) { i++; showStep(); } else walk();
    };
  };
  const walk = () => {
    app.innerHTML = screenShell('Learn', esc(o.name), `<button class="ctl" id="prev">‹</button><button class="btn" id="trap" hidden>Common mistake</button><button class="btn primary" id="next">Next</button><button class="btn" id="flag">Need more explanation</button><button class="btn" id="ask">Ask a question</button>`);
    walkLine(ui(), o, v, { next: btn('next'), prev: btn('prev'), trap: btn('trap'), flag: btn('flag'), ask: btn('ask') }, () => {
      markLearned(key(o, v)); location.hash = href('practice', o.id, v.id);
    });
  };
  showStep();
}

const btn = (id: string) => document.getElementById(id) as HTMLButtonElement;
const ui = (): Ui => ({ board: document.getElementById('board')!, hint: btn('hint'), prev: btn('prev'), fwd: btn('fwd'), resume: (document.getElementById('resume') as HTMLButtonElement | null) ?? undefined, flag: (document.getElementById('flag') as HTMLButtonElement | null) ?? undefined, ask: (document.getElementById('ask') as HTMLButtonElement | null) ?? undefined });
const hintBtn = `<button class="ctl" id="prev" aria-label="Back one move">‹</button><button class="ctl" id="hint">Hint</button><button class="ctl" id="fwd" aria-label="Forward one move">›</button><button class="btn primary" id="resume" hidden>Back to the line</button><button class="btn" id="flag">Need more explanation</button><button class="btn" id="ask">Ask a question</button>`;

const endBtns = `<button class="btn primary" id="again" hidden>Again</button><button class="btn" id="done" hidden>Done</button>`;

async function practice(o: Opening, v: Variation, startPly?: number) {
  const my = ++token;
  app.innerHTML = screenShell('Practice', esc(o.name), `${hintBtn}${endBtns}`);
  const run = async () => {
    btn('again').hidden = true; btn('done').hidden = true;
    const mistakes = await playLine(ui(), o, v, { stopped: () => my !== token, ...(startPly ? { startPly } : {}), onAttempt: a => logAttempt({ ...a, k: key(o, v), m: 'p', ...(startPly ? { o: 1 as const } : {}) }) });
    if (my !== token) return;
    if (mistakes === 0 && !startPly) { markLearned(key(o, v)); awardLineBonus(); } // starting mid-line is a spot check, not a whole line
    btn('again').hidden = false; btn('done').hidden = false;
    btn('done').onclick = () => goTo(startPly ? href('games') : href('o', o.id));
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
    app.innerHTML = `<main class="page"><a class="back" data-goback href="#/">← Home</a><h1>Drill</h1>
      <div class="card"><b>${learned ? 'Nothing is due right now.' : 'Nothing to drill yet.'}</b>
      <p class="muted">${learned ? 'Come back later; the scheduler will bring lines back just before you would forget them.' : 'Learn a variation first and it will appear here.'}</p></div></main>`;
    return;
  }
  let combo = 0, played = 0;
  /** Wait for "Next" or "That's enough for today"; true means keep going. */
  const goOn = () => new Promise<boolean>(res => {
    const b = btn('nextline'), e = btn('enough');
    b.hidden = false; e.hidden = false;
    b.onclick = () => res(true); e.onclick = () => res(false);
  });
  for (const k of queue) {
    const [o, v] = lookup(k)!;
    app.innerHTML = screenShell('Drill', `${esc(o.name)}`, `${hintBtn}<button class="btn primary" id="nextline" hidden>Next</button><button class="btn" id="enough" hidden>That's enough for today</button>`);
    const mistakes = await playLine(ui(), o, v, { stopped: () => my !== token, onAttempt: a => logAttempt({ ...a, k: key(o, v), m: 'd' }) });
    if (my !== token) return;
    review(k, mistakes);
    if (mistakes === 0) awardLineBonus();
    combo = mistakes === 0 ? combo + 1 : 0; setBestCombo(combo);
    played++;
    const more = await goOn();
    if (my !== token) return;
    if (!more) break;
    // Once a line is familiar, check it from the middle once a day. This feeds mastery only; it does not reschedule the line.
    const m = masteryOf(o, v), from = pickSpotCheck(m);
    if (LEVELS.indexOf(m.level) >= 2 && from !== undefined && !hadSpotCheckToday(k, getProgress().attempts)) {
      app.innerHTML = screenShell('Spot check', esc(o.name), `${hintBtn}<button class="btn primary" id="nextline" hidden>Next</button><button class="btn" id="enough" hidden>That's enough for today</button>`);
      await playLine(ui(), o, v, { stopped: () => my !== token, startPly: from, onAttempt: a => logAttempt({ ...a, k, m: 'd', o: 1 }) });
      if (my !== token) return;
      if (!(await goOn())) break;
      if (my !== token) return;
    }
  }
  const left = allDue.length - played;
  app.innerHTML = `<main class="page"><h1>Nice work</h1><div class="card"><b>${played} ${played === 1 ? 'line' : 'lines'} played.</b>
    <p class="muted">${left > 0 ? 'The rest will be waiting whenever you feel like more.' : 'Everything is up to date. Come back whenever you like.'}</p></div>
    <a class="btn primary big" href="#/" data-goto>Done</a>${left > 0 ? `<a class="btn big" href="${href('drill')}">A few more</a>` : ''}</main>`;
}

function route() {
  trackEntry();
  token++;
  const [, a, b, c, d] = location.hash.split('/');
  const o = b ? findOpening(b) : undefined; const v = o && c ? findVariation(o, c) : undefined;
  if (a === 'o' && o) openingPage(o);
  else if (a === 'learn' && o && v) learn(o, v);
  else if (a === 'practice' && o && v) void practice(o, v, d && Number(d) > 0 && Number(d) < v.moves.length ? Number(d) : undefined);
  else if (a === 'games') gamesPage();
  else if (a === 'drill') void drill();
  else if (a === 'mistakes') mistakesPage();
  else if (a === 'ask') askPage();
  else if (a === 'settings') settingsPage();
  else home();
  window.scrollTo(0, 0);
}
// iOS may evict site storage for rarely used apps; ask for durable storage so progress survives (best effort, a no-op where unsupported)
void navigator.storage?.persist?.().catch(() => {});
await loadProgress();
window.addEventListener('hashchange', route);
installNavLinks(route);
route();
if (hasToken()) void runSync(true).then(() => { if (!location.hash.slice(2)) route(); });
