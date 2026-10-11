import type { Level } from './mastery.ts';

/** Placeholder numbers; tune with real use. */
export const DAILY_GOAL = 50;   // XP per day
export const LINE_BONUS = 10;   // XP for finishing a line with no mistakes and no hints

export const dayKey = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA'); // local calendar day, YYYY-MM-DD

/** A correct move is worth 2 XP, 1 if a hint was used, a wrong move 0. */
export const xpForAttempt = (a: { ok: 0 | 1; h: 0 | 1 }) => (a.ok ? (a.h ? 1 : 2) : 0);

export const totalXp = (xp: Record<string, number>) => Object.values(xp).reduce((s, n) => s + n, 0);

/** Player titles earned by total XP. Placeholder thresholds; each step costs clearly more than the last (a flawless 10-move line is about 30 XP, the daily goal 50). */
export const TITLES: { xp: number; title: string }[] = [
  { xp: 0, title: 'Pawn Pusher' },
  { xp: 150, title: 'Gambit Rookie' },
  { xp: 400, title: 'Coffeehouse Hustler' },
  { xp: 800, title: 'Club Regular' },
  { xp: 1400, title: 'Fianchetto Fan' },
  { xp: 2200, title: 'Tactician' },
  { xp: 3300, title: 'Positional Player' },
  { xp: 4800, title: 'Candidate Master' },
  { xp: 6800, title: 'Endgame Wizard' },
  { xp: 9500, title: 'FIDE Master' },
  { xp: 13000, title: 'International Master' },
  { xp: 18000, title: 'Grandmaster' },
  { xp: 25000, title: 'Super Grandmaster' },
  { xp: 35000, title: 'World Challenger' },
  { xp: 50000, title: 'World Champion' }
];

export interface LevelInfo { n: number; title: string; into: number; span: number; next?: string }
/** Level (1-based) and title for a total XP, plus progress toward the next title. `span` is 0 at the top level. */
export function levelFor(xp: number): LevelInfo {
  let i = 0;
  while (i + 1 < TITLES.length && xp >= TITLES[i + 1].xp) i++;
  const next = TITLES[i + 1];
  return { n: i + 1, title: TITLES[i].title, into: xp - TITLES[i].xp, span: next ? next.xp - TITLES[i].xp : 0, ...(next ? { next: next.title } : {}) };
}

const dayNumber = (key: string) => Math.round(Date.parse(`${key}T00:00:00Z`) / 86_400_000);

/** Streaks count consecutive days with any XP. The current streak survives until the end of today if today has no XP yet. */
export function streaks(xp: Record<string, number>, today = dayKey()): { current: number; best: number } {
  const days = Object.keys(xp).filter(k => xp[k] > 0).map(dayNumber).sort((a, b) => a - b);
  let best = 0, run = 0, prev = -Infinity;
  for (const d of days) { run = d === prev + 1 ? run + 1 : 1; prev = d; best = Math.max(best, run); }
  const set = new Set(days), t = dayNumber(today);
  let cur = 0, d = set.has(t) ? t : t - 1;
  while (set.has(d)) { cur++; d--; }
  return { current: cur, best };
}

export interface BadgeState { xp: Record<string, number>; levels: Level[] }
export interface Badge { id: string; name: string; hint: string; test: (s: BadgeState) => boolean }
const atLeast = (s: BadgeState, lvl: Level) => {
  const order: Level[] = ['New', 'Learning', 'Familiar', 'Solid', 'Mastered'];
  return s.levels.some(l => order.indexOf(l) >= order.indexOf(lvl));
};
export const BADGES: Badge[] = [
  { id: 'first-points', name: 'First points', hint: 'Earn your first XP.', test: s => totalXp(s.xp) >= 1 },
  { id: 'daily-goal', name: 'Daily goal', hint: `Reach ${DAILY_GOAL} XP in one day.`, test: s => Object.values(s.xp).some(n => n >= DAILY_GOAL) },
  { id: 'streak-3', name: '3-day streak', hint: 'Practice three days in a row.', test: s => streaks(s.xp).best >= 3 },
  { id: 'streak-7', name: '7-day streak', hint: 'Practice seven days in a row.', test: s => streaks(s.xp).best >= 7 },
  { id: 'streak-30', name: '30-day streak', hint: 'Practice thirty days in a row.', test: s => streaks(s.xp).best >= 30 },
  { id: 'xp-500', name: '500 XP', hint: 'Earn 500 XP in total.', test: s => totalXp(s.xp) >= 500 },
  { id: 'xp-5000', name: '5,000 XP', hint: 'Earn 5,000 XP in total.', test: s => totalXp(s.xp) >= 5000 },
  { id: 'familiar', name: 'First familiar line', hint: 'Get a line to Familiar.', test: s => atLeast(s, 'Familiar') },
  { id: 'solid', name: 'First solid line', hint: 'Get a line to Solid.', test: s => atLeast(s, 'Solid') },
  { id: 'mastered', name: 'First mastered line', hint: 'Get a line to Mastered.', test: s => atLeast(s, 'Mastered') }
];

/** Ids of every badge the state qualifies for right now. Earned badges are stored, so they are never lost when a level drops. */
export const earnedNow = (s: BadgeState) => BADGES.filter(b => b.test(s)).map(b => b.id);
